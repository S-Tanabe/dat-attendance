/** 通知優先度の定義。 */
export type NotificationPriority = "low" | "normal" | "high" | "urgent";
/** 通知ステータスの定義。 */
export type NotificationStatus =
  | "pending"
  | "processing"
  | "delivered"
  | "failed"
  | "escalated";

/** 通知カテゴリの定義。 */
export type NotificationCategory =
  | "system"
  | "user_action"
  | "schedule"
  | "realtime";

/** enqueue 前後で利用する通知ペイロード。 */
export interface NotificationPayload {
  id?: string;
  category: NotificationCategory;
  source: string;
  userId?: string;
  targetUsers?: string[];
  channelIds: string[];
  templateId?: string;
  subject?: string;
  message: string;
  variables?: Record<string, unknown>;
  priority: NotificationPriority;
  status?: NotificationStatus;
  metadata?: Record<string, unknown>;
  scheduledAt?: string;
  expiresAt?: string;
  retryCount?: number;
}

export interface DeliveryEvent {
  notificationId: string;
  channel: string;
  payload: NotificationPayload;
}
