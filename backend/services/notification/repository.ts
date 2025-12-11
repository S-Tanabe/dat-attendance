/**
 * DB アクセス層：通知および配信ログに対する CRUD を提供する。
 */
import { db } from "./database";
import type { NotificationPayload } from "./types";

/** `notifications` テーブルの行を表現する型。 */
export interface NotificationRecord {
  id: string;
  category: string;
  source: string;
  user_id: string | null;
  template_id: string | null;
  subject: string | null;
  message: string;
  priority: string;
  status: string;
  channels: string[];
  variables: Record<string, unknown>;
  metadata: Record<string, unknown>;
  scheduled_at: Date;
  expires_at: Date | null;
  retry_count: number;
  max_retry: number;
  created_at: Date;
  updated_at: Date;
}

export interface DeliveryRecord {
  id: string;
  notification_id: string;
  channel: string;
  status: string;
  attempts: number;
  last_error: string | null;
  delivered_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * 通知レコードを挿入し、保存結果を返す。
 * - `variables` / `metadata` を JSONB として扱う。
 * - `max_retry` は優先度に応じて初期値を変化させる。
 */
export async function insertNotification(
  payload: NotificationPayload
): Promise<NotificationRecord> {
  const variables = payload.variables ?? {};
  const metadata = payload.metadata ?? {};
  const scheduledAt = payload.scheduledAt ?? new Date().toISOString();

  const result = await db.query<NotificationRecord>`
    INSERT INTO notifications (
      category,
      source,
      user_id,
      template_id,
      subject,
      message,
      priority,
      status,
      channels,
      variables,
      metadata,
      scheduled_at,
      expires_at,
      retry_count,
      max_retry
    ) VALUES (
      ${payload.category},
      ${payload.source},
      ${payload.userId ?? null},
      ${payload.templateId ?? null},
      ${payload.subject ?? null},
      ${payload.message},
      ${payload.priority},
      ${payload.status ?? "pending"},
      ${payload.channelIds},
      ${variables},
      ${metadata},
      ${scheduledAt},
      ${payload.expiresAt ?? null},
      ${payload.retryCount ?? 0},
      ${payload.priority === "urgent" ? 5 : 3}
    )
    RETURNING id, category, source, user_id, template_id, subject, message,
              priority, status, channels, variables, metadata, scheduled_at,
              expires_at, retry_count, max_retry, created_at, updated_at
  `;

  const row = await result.next();
  if (!row.value) {
    throw new Error("Failed to insert notification");
  }
  return row.value;
}

export const saveNotificationToDB = insertNotification;

/**
 * チャネルごとの delivery レコードを作成（重複時は更新）。
 * SSE などが状態を参照しやすいよう、初期ステータスを `queued` に設定する。
 */
export async function createDeliveryRecord(
  notificationId: string,
  channel: string
): Promise<void> {
  await db.exec`
    INSERT INTO notification_deliveries (notification_id, channel, status)
    VALUES (${notificationId}, ${channel}, 'queued')
    ON CONFLICT (notification_id, channel) DO UPDATE
      SET updated_at = now(), status = EXCLUDED.status
  `;
}

/** 通知全体のステータスを更新する。 */
export async function updateNotificationStatus(
  notificationId: string,
  status: string
): Promise<void> {
  await db.exec`
    UPDATE notifications
    SET status = ${status}, updated_at = now()
    WHERE id = ${notificationId}
  `;
}

/** delivery レコードのステータス更新およびエラーメッセージ記録を行う。 */
export async function updateDeliveryStatus(
  notificationId: string,
  channel: string,
  status: string,
  error?: string | null
): Promise<void> {
  await db.exec`
    UPDATE notification_deliveries
    SET status = ${status},
        last_error = ${error ?? null},
        delivered_at = CASE WHEN ${status} = 'delivered' THEN now() ELSE delivered_at END,
        updated_at = now()
    WHERE notification_id = ${notificationId}
      AND channel = ${channel}
  `;
}
