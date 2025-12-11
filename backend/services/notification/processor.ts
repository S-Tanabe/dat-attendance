/**
 * notificationProcessor
 *
 * Pub/Sub に積まれた通知を取り出し、ユーザー/管理者のプリファレンスを評価して
 * deliveryTopic へ振り分ける。チャネルごとの delivery レコードを生成し、
 * SSE 実装などの下流コンポーネントが扱いやすいよう整形する役割を担う。
 */
import { Subscription } from "encore.dev/pubsub";
import log from "encore.dev/log";

import { deliveryTopic, notificationTopic } from "./topics";
import type { NotificationPayload, NotificationPriority } from "./types";
import { getUserPreferences, type UserNotificationPreferences } from "./preferences";
import { getAdminPreferences, type AdminNotificationProfile } from "./admin_preferences";
import {
  createDeliveryRecord,
  updateNotificationStatus,
} from "./repository";
import { extractUserId, isAdminChannel, isAllUsersChannel, isSupportedChannelId } from "./channels";

/**
 * 優先度を比較しやすいよう数値化するヘルパー。
 * `high` > `normal` > `low` のような相対評価を行うために使用する。
 */
export function priorityWeight(priority: NotificationPriority): number {
  switch (priority) {
    case "urgent":
      return 4;
    case "high":
      return 3;
    case "normal":
      return 2;
    default:
      return 1;
  }
}

/**
 * チャネルが配信可能かどうかをプリファレンスと照らし合わせて判定。
 * - グローバル閾値（priorityThreshold）
 * - チャネル個別設定（有効/無効 + 最低優先度）
 * - 一時ミュート（mutedUntil）
 */
export function isChannelAllowed(
  channelId: string,
  priority: NotificationPriority,
  preferences: {
    channelPreferences?: Record<string, { enabled: boolean; minPriority: NotificationPriority }>;
    priorityThreshold?: NotificationPriority;
    mutedUntil?: string | null;
  }
): boolean {
  if (preferences.mutedUntil) {
    const mutedUntil = new Date(preferences.mutedUntil);
    if (mutedUntil.getTime() > Date.now()) {
      return false;
    }
  }

  const globalThreshold = preferences.priorityThreshold ?? "normal";
  if (priorityWeight(priority) < priorityWeight(globalThreshold)) {
    return false;
  }

  const channelPref = preferences.channelPreferences?.[channelId];
  if (!channelPref) {
    return true;
  }
  if (!channelPref.enabled) {
    return false;
  }
  return priorityWeight(priority) >= priorityWeight(channelPref.minPriority ?? "normal");
}

type ChannelKind =
  | { type: "user"; userId: string }
  | { type: "broadcast" }
  | { type: "admin" }
  | { type: "unknown" };

function classifyChannel(channelId: string): ChannelKind {
  if (!channelId || channelId.length === 0) {
    return { type: "unknown" };
  }
  if (isAdminChannel(channelId)) {
    return { type: "admin" };
  }
  if (isAllUsersChannel(channelId)) {
    return { type: "broadcast" };
  }
  const userId = extractUserId(channelId);
  if (userId) {
    return { type: "user", userId };
  }
  return { type: "unknown" };
}

interface PreferenceSnapshot {
  channelPreferences?: Record<string, { enabled: boolean; minPriority: NotificationPriority }>;
  priorityThreshold?: NotificationPriority;
  mutedUntil?: string | null;
}

function toPreferenceSnapshot(
  input:
    | Pick<UserNotificationPreferences, "channelPreferences" | "priorityThreshold" | "mutedUntil">
    | Pick<AdminNotificationProfile, "channelPreferences" | "priorityThreshold">
    | PreferenceSnapshot
    | null
    | undefined
): PreferenceSnapshot | null {
  if (!input) return null;
  return {
    channelPreferences: input.channelPreferences ?? {},
    priorityThreshold: input.priorityThreshold ?? "normal",
    mutedUntil: "mutedUntil" in input ? input.mutedUntil ?? null : null,
  };
}

function preferenceAllowsChannel(
  channelId: string,
  priority: NotificationPriority,
  preferences: PreferenceSnapshot | null
): boolean {
  if (!preferences) {
    return true;
  }
  return isChannelAllowed(channelId, priority, preferences);
}

function isChannelSupported(channelId: string): boolean {
  return isSupportedChannelId(channelId);
}

export const notificationProcessor = new Subscription(
  notificationTopic,
  "process-notifications",
  {
    handler: async (payload: NotificationPayload) => {
      // enqueueNotification で付与される ID が無い場合は処理を継続できないので警告のみ残して終了。
      if (!payload.id) {
        log.error("notification.processor.missing_id", {
          source: payload.source,
        });
        return;
      }

      await updateNotificationStatus(payload.id, "processing");

      const adminProfile = await getAdminPreferences(payload.source);
      const adminPreferenceSnapshot = toPreferenceSnapshot(adminProfile as PreferenceSnapshot | null);

      const userPreferenceCache = new Map<string, PreferenceSnapshot | null>();
      const allowedChannels: string[] = [];

      for (const channelId of payload.channelIds) {
        if (!isChannelSupported(channelId)) {
          log.warn("notification.processor.unsupported_channel", {
            notification_id: payload.id,
            channel: channelId,
          });
          continue;
        }

        const classification = classifyChannel(channelId);
        if (classification.type === "unknown") {
          log.warn("notification.processor.unsupported_channel", {
            notification_id: payload.id,
            channel: channelId,
          });
          continue;
        }

        let preferenceSnapshot: PreferenceSnapshot | null = null;

        if (classification.type === "user") {
          const targetUserId = classification.userId;
          if (!userPreferenceCache.has(targetUserId)) {
            try {
              const userPrefs = await getUserPreferences(targetUserId);
              userPreferenceCache.set(targetUserId, toPreferenceSnapshot(userPrefs));
            } catch (error) {
              log.warn("notification.processor.user_pref_failed", {
                notification_id: payload.id,
                target_user: targetUserId,
                error,
              });
              userPreferenceCache.set(targetUserId, {
                channelPreferences: {},
                priorityThreshold: "normal",
                mutedUntil: null,
              });
            }
          }
          preferenceSnapshot = userPreferenceCache.get(targetUserId) ?? null;
        } else if (classification.type === "admin") {
          preferenceSnapshot = adminPreferenceSnapshot;
        } else {
          // broadcast / default
          preferenceSnapshot = null;
        }

        if (!preferenceAllowsChannel(channelId, payload.priority, preferenceSnapshot)) {
          continue;
        }

        allowedChannels.push(channelId);
      }

      if (allowedChannels.length === 0) {
        log.info("notification.processor.no_channels", {
          notification_id: payload.id,
          priority: payload.priority,
        });
        return;
      }

      await Promise.all(
        allowedChannels.map(async (channelId) => {
          // delivery レコードを作成し、deliveryTopic へ通知を転送。
          await createDeliveryRecord(payload.id!, channelId);
          await deliveryTopic.publish({
            notificationId: payload.id!,
            channel: channelId,
            payload,
          });
        })
      );

    },
  }
);
