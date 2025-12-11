/**
 * ユーザー通知プリファレンス取得ロジック。
 * - web/email などチャネル単位の有効/無効
 * - 優先度の閾値
 * - ミュート期間
 */
import { db } from "./database";

export interface ChannelPreference {
  enabled: boolean;
  minPriority: "low" | "normal" | "high" | "urgent";
}

export interface UserNotificationPreferences {
  userId: string;
  channelPreferences: Record<string, ChannelPreference>;
  priorityThreshold: "low" | "normal" | "high" | "urgent";
  mutedUntil?: string;
}

/**
 * ユーザーIDから通知プリファレンスを取得する。
 * データが存在しない場合は既定値（チャネル制限なし、priority=normal）を返す。
 */
export async function getUserPreferences(userId: string): Promise<UserNotificationPreferences> {
  const result = await db.query<{
    channel_preferences: Record<string, ChannelPreference>;
    priority_threshold: "low" | "normal" | "high" | "urgent";
    muted_until: Date | null;
  }>`
    SELECT channel_preferences, priority_threshold, muted_until
    FROM user_notification_preferences
    WHERE user_id = ${userId}
  `;

  const row = await result.next();
  if (!row.value) {
    return {
      userId,
      channelPreferences: {},
      priorityThreshold: "normal",
    };
  }

  return {
    userId,
    channelPreferences: row.value.channel_preferences ?? {},
    priorityThreshold: row.value.priority_threshold ?? "normal",
    mutedUntil: row.value.muted_until?.toISOString(),
  };
}
