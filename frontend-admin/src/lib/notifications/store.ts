import type {
	ConnectionStatus,
	NotificationEvent,
	NotificationItem,
	NotificationPayload,
	NotificationScope,
} from './types'
import { browser } from '$app/environment'

import { derived, get, writable } from 'svelte/store'
import { NotificationStream } from './client'

const STREAM_PATH = '/notifications/stream'
const MAX_ITEMS = 20

function createLocalId() {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID()
	}
	return `local-${Math.random().toString(36).slice(2)}`
}

function buildDedupeKey(payload: NotificationPayload): string {
	if (payload.id)
		return payload.id
	const meta = payload.metadata
	const notificationId = meta?.notificationId
	if (typeof notificationId === 'string' && notificationId.length > 0) {
		return notificationId
	}
	return `${payload.source}:${payload.message.slice(0, 48)}`
}

function createNotificationCenter() {
	const notifications = writable<NotificationItem[]>([])
	const status = writable<ConnectionStatus>('idle')
	const lastReceivedAt = writable<string | null>(null)
	const extraChannelsStore = writable<string[]>([])

	let stream: NotificationStream | null = null
	let unsubscribeStatus: (() => void) | null = null
	let unsubscribeMessage: (() => void) | null = null
	let subscribedChannels: string[] = []
	let currentUserId: string | null = null

	function destroyStream(closeCompletely = true) {
		unsubscribeStatus?.()
		unsubscribeStatus = null
		unsubscribeMessage?.()
		unsubscribeMessage = null
		if (stream) {
			stream.stop(closeCompletely)
			stream = null
		}
		status.set(closeCompletely ? 'closed' : 'idle')
	}

	const unreadCount = derived(notifications, (items) =>
		items.reduce((count, item) => (item.read ? count : count + 1), 0))

	function handleIncoming(message: NotificationEvent) {
		const receivedAt = new Date().toISOString()
		const { payload, channel } = message
		const dedupeKey = buildDedupeKey(payload)
		const entryId = payload.id ?? dedupeKey ?? createLocalId()
		const scope = classifyScope(channel, payload, currentUserId)

		notifications.update((items) => {
			const nextItems = [...items]
			const existingIndex = nextItems.findIndex((item) => item.dedupeKey === dedupeKey)

			if (existingIndex >= 0) {
				const existing = nextItems[existingIndex]
				const channelSet = new Set(existing.channels ?? [])
				channelSet.add(channel)
				const scopeSet = new Set(existing.scopes ?? [])
				scopeSet.add(scope)

				const updated: NotificationItem = {
					...existing,
					...payload,
					id: entryId,
					channel,
					channels: Array.from(channelSet),
					scopes: Array.from(scopeSet),
					dedupeKey,
					receivedAt,
					read: false,
				}

				nextItems.splice(existingIndex, 1)
				nextItems.unshift(updated)
				return nextItems.slice(0, MAX_ITEMS)
			}

			const next: NotificationItem = {
				...payload,
				id: entryId,
				channel,
				channels: [channel],
				scopes: [scope],
				dedupeKey,
				receivedAt,
				read: false,
			}
			nextItems.unshift(next)
			return nextItems.slice(0, MAX_ITEMS)
		})

		lastReceivedAt.set(receivedAt)
	}

	function ensureStream() {
		if (!browser)
			return
		if (stream)
			return

		stream = new NotificationStream(STREAM_PATH, {
			channels: subscribedChannels,
		})
		unsubscribeStatus = stream.onStatus((value) => {
			status.set(value)
		})
		unsubscribeMessage = stream.onMessage((message) => {
			handleIncoming(message)
		})
	}

	function start(options?: { channels?: string[], userId?: string }) {
		const normalized = normalizeChannels(options?.channels)
		const nextUserId = options?.userId ?? null

		const userChanged = nextUserId !== currentUserId
		currentUserId = nextUserId

		if (userChanged) {
			notifications.set([])
			lastReceivedAt.set(null)
		}

		if (!areArraysEqual(subscribedChannels, normalized) || userChanged) {
			subscribedChannels = normalized
			extraChannelsStore.set([...normalized])
			destroyStream(false)
		}

		ensureStream()
		stream?.start()
	}

	function stop() {
		destroyStream()
	}

	function reconnect() {
		destroyStream(false)
		ensureStream()
		stream?.start()
	}

	function markAllRead() {
		notifications.update((items) =>
			items.map((item) => ({ ...item, read: true })),
		)
	}

	function clear() {
		notifications.set([])
		lastReceivedAt.set(null)
	}

	function dispose() {
		destroyStream()
		subscribedChannels = []
		currentUserId = null
		extraChannelsStore.set([])
	}

	function isConnected() {
		const current = get(status)
		return current === 'open'
	}

	return {
		start,
		stop,
		reconnect,
		markAllRead,
		clear,
		dispose,
		isConnected,
		notifications,
		unreadCount,
		status,
		lastReceivedAt,
		channels: extraChannelsStore,
	}
}

function normalizeChannels(channels?: string[]): string[] {
	if (!channels || channels.length === 0)
		return []
	const unique = Array.from(
		new Set(
			channels
				.map((channel) => channel.trim())
				.filter((channel) => channel.length > 0),
		),
	)
	unique.sort()
	return unique
}

function areArraysEqual(a: string[], b: string[]): boolean {
	if (a.length !== b.length)
		return false
	for (let i = 0; i < a.length; i += 1) {
		if (a[i] !== b[i])
			return false
	}
	return true
}

function classifyScope(
	channel: string,
	payload: NotificationPayload,
	currentUserId: string | null,
): NotificationScope {
	if (channel === 'all-users')
		return 'broadcast'
	if (channel === 'admin-dashboard')
		return 'admin'
	if (channel.startsWith('user-')) {
		const targetId = channel.slice('user-'.length)
		const targetUsers = Array.isArray(payload.targetUsers)
			? (payload.targetUsers)
			: []
		const metadataTargets = Array.isArray(payload.metadata?.targetUsers)
			? (payload.metadata?.targetUsers as string[])
			: []

		if (
			currentUserId
			&& (targetId === currentUserId
				|| targetUsers.includes(currentUserId)
				|| metadataTargets.includes(currentUserId))
		) {
			return 'self'
		}
		const metadataTarget = payload.metadata?.targetUser
		if (metadataTarget && typeof metadataTarget === 'string' && metadataTarget === currentUserId) {
			return 'self'
		}
		return 'user'
	}
	return 'other'
}

export const notificationCenter = createNotificationCenter()
export default notificationCenter
