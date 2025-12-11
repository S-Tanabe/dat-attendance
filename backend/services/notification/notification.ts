/**
 * 通知生成APIおよび共通ユーティリティ。
 *
 * エンドポイント `POST /notifications` は全サービス共通の入り口となり、
 * 入力バリデーション → DB 保存 → Pub/Sub への publish を一貫して行う。
 * 外部システム連携は行わず、純粋な汎用通知生成に特化する。
 */
import { api, APIError } from "encore.dev/api";
import log from "encore.dev/log";
import { getAuthData } from "~encore/auth";

import { notificationTopic } from "./topics";
import type { NotificationPayload, NotificationPriority } from "./types";
import {
  CHANNEL_ALL_USERS,
  collectUserTargets,
  makeUserChannel,
  normalizeChannelId,
  sanitizeChannelList,
} from "./channels";
import { saveNotificationToDB, type NotificationRecord } from "./repository";

export interface CreateNotificationRequest {
  category?: NotificationPayload["category"];
  source?: string;
  userId?: string;
  targetUserIds?: string[];
  channelIds?: string[];
  templateId?: string;
  subject?: string;
  message: string;
  variables?: Record<string, unknown>;
  priority?: NotificationPriority;
  metadata?: Record<string, unknown>;
  scheduledAt?: string;
  expiresAt?: string;
}

export interface CreateNotificationResponse {
  id: string;
  status: string;
  success: boolean;
}

function toNotificationPayload(record: NotificationRecord): NotificationPayload {
  return {
    id: record.id,
    category: record.category as NotificationPayload["category"],
    source: record.source,
    userId: record.user_id ?? undefined,
    targetUsers: Array.isArray(record.metadata?.targetUsers)
      ? (record.metadata.targetUsers as unknown[])
          .map((value) => String(value))
          .filter((value) => value.length > 0)
      : undefined,
    templateId: record.template_id ?? undefined,
    subject: record.subject ?? undefined,
    message: record.message,
    priority: record.priority as NotificationPriority,
    status: record.status as NotificationPayload["status"],
    channelIds: record.channels ?? [],
    variables: record.variables ?? {},
    metadata: record.metadata ?? {},
    scheduledAt: record.scheduled_at?.toISOString(),
    expiresAt: record.expires_at?.toISOString(),
    retryCount: record.retry_count,
  };
}

export async function enqueueNotification(
  payload: NotificationPayload
): Promise<{ record: NotificationRecord; publishedPayload: NotificationPayload }> {
  // DB 保存後に Pub/Sub に流す共通処理。エンドポイント・Webhook 双方から利用。
  const record = await saveNotificationToDB(payload);
  const publishedPayload = toNotificationPayload(record);
  await notificationTopic.publish(publishedPayload);
  return { record, publishedPayload };
}

/**
 * `POST /notifications`
 *
 * - チャネル指定・メッセージ本文などを受け取り通知を生成。
 * - 認証中のユーザーIDを自動補完し、`metadata.initiatedBy` として記録する。
 * - 保存後に Pub/Sub へ流し、delivery レイヤー経由で通知を配信する。
 */
export const createNotification = api(
  {
    method: "POST",
    path: "/notifications",
    expose: true,
    auth: true,
  },
  async (request: CreateNotificationRequest): Promise<CreateNotificationResponse> => {
    // 優先度とカテゴリはデフォルト値を補完する。
    const priority: NotificationPriority = request.priority ?? "normal";
    const category = request.category ?? "system";
    const source = normalizeSource(request.source);
    const auth = getAuthData();

    const resolvedUserId = request.userId ?? auth?.userID ?? undefined;
    const { channels: channelIds, userTargets } = resolveChannels(
      request.channelIds,
      request.targetUserIds,
      resolvedUserId
    );

    // 誰が通知を生成したか追跡しやすいよう metadata に付加。
    const metadata = {
      ...(request.metadata ?? {}),
      initiatedBy: auth?.userID ?? null,
      targetUser:
        resolvedUserId ?? (userTargets.length === 1 ? userTargets[0] : null),
      targetUsers: userTargets,
    };

    // 通知ペイロードを構築し共通 enqueue 処理へ渡す。
    const payload: NotificationPayload = {
      category,
      source,
      userId: resolvedUserId,
      channelIds,
      templateId: request.templateId,
      subject: request.subject,
      message: request.message,
      variables: request.variables,
      priority,
      metadata,
      scheduledAt: request.scheduledAt,
      expiresAt: request.expiresAt,
    };

    const { record, publishedPayload } = await enqueueNotification(payload);

    log.info("notification.created", {
      notification_id: record.id,
      category,
      priority,
      channels: channelIds,
      source,
    });

    return {
      id: record.id,
      status: record.status,
      success: true,
    };
  }
);

function normalizeSource(source: string | undefined): string {
  if (!source) return "system";
  const trimmed = source.trim();
  return trimmed.length > 0 ? trimmed : "system";
}

function resolveChannels(
  original: string[] | undefined,
  targetUserIds: string[] | undefined,
  fallbackUserId: string | undefined
): { channels: string[]; userTargets: string[] } {
  const channelSet = new Set<string>();

  if (Array.isArray(targetUserIds)) {
    for (const userId of targetUserIds) {
      const channel = makeUserChannel(userId);
      if (channel) {
        channelSet.add(channel);
      }
    }
  }

  if (Array.isArray(original)) {
    for (const entry of original) {
      const normalized = normalizeChannelId(entry);
      if (!normalized) {
        throw APIError.invalidArgument(`unsupported channelId: ${entry}`);
      }
      channelSet.add(normalized);
    }
  }

  if (channelSet.size === 0 && fallbackUserId) {
    const fallbackChannel = makeUserChannel(fallbackUserId);
    if (fallbackChannel) {
      channelSet.add(fallbackChannel);
    }
  }

  if (channelSet.size === 0) {
    channelSet.add(CHANNEL_ALL_USERS);
  }

  const channels = sanitizeChannelList(channelSet);
  const userTargets = collectUserTargets(channels);

  return { channels, userTargets };
}
