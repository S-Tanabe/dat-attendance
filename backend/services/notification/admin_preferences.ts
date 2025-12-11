/**
 * ソース（例: `admin`, `workflow` など）ごとの管理者向け通知プロファイル。
 * ユーザープリファレンスが無い場合のフォールバックとして利用する。
 */
import { db } from "./database";
import type { ChannelPreference } from "./preferences";
import type { NotificationPriority } from "./types";

export interface AdminNotificationProfile {
  profileKey: string;
  channelPreferences: Record<string, ChannelPreference>;
  priorityThreshold: NotificationPriority;
  escalationPolicy: Record<string, unknown>;
}

/** プロファイルを取得。未設定の場合は既定値を返す。 */
export async function getAdminPreferences(source: string): Promise<AdminNotificationProfile> {
  const result = await db.query<{
    profile_key: string;
    channel_preferences: Record<string, ChannelPreference> | null;
    priority_threshold: NotificationPriority | null;
    escalation_policy: Record<string, unknown>;
  }>`
    SELECT profile_key, channel_preferences, priority_threshold, escalation_policy
    FROM admin_notification_profiles
    WHERE profile_key = ${source}
  `;

  const row = await result.next();
  if (!row.value) {
    return {
      profileKey: source,
      channelPreferences: {},
      priorityThreshold: "normal",
      escalationPolicy: {},
    };
  }

  return {
    profileKey: row.value.profile_key,
    channelPreferences: row.value.channel_preferences ?? {},
    priorityThreshold: row.value.priority_threshold ?? "normal",
    escalationPolicy: row.value.escalation_policy ?? {},
  };
}
