// 通知関連でフロントエンドが共有する型定義。

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'
export type NotificationStatus = 'pending' | 'processing' | 'delivered' | 'failed' | 'escalated'
export type NotificationCategory
	= | 'system'
		| 'user_action'
		| 'schedule'
		| 'realtime'

export interface NotificationPayload {
	id?: string
	category: NotificationCategory
	source: string
	userId?: string
	targetUsers?: string[]
	channelIds: string[]
	templateId?: string
	subject?: string
	message: string
	variables?: Record<string, unknown>
	priority: NotificationPriority
	status?: NotificationStatus
	metadata?: Record<string, unknown>
	scheduledAt?: string
	expiresAt?: string
	retryCount?: number
}

export type ConnectionStatus
	= | 'idle'
		| 'connecting'
		| 'open'
		| 'reconnecting'
		| 'error'
		| 'closed'

export type NotificationScope
	= | 'self'
		| 'user'
		| 'broadcast'
		| 'admin'
		| 'other'

export interface NotificationEvent {
	channel: string
	payload: NotificationPayload
}

export interface NotificationItem extends NotificationPayload {
	id: string
	receivedAt: string
	read: boolean
	dedupeKey: string
	channel: string
	channels: string[]
	scopes: NotificationScope[]
}
