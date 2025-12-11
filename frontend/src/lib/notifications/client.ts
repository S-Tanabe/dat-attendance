import type { ConnectionStatus, NotificationEvent } from './types'

import { browser } from '$app/environment'

type NotificationListener = (message: NotificationEvent) => void
type StatusListener = (status: ConnectionStatus) => void

const BASE_DELAY_MS = 3000
const MAX_DELAY_MS = 60000
const MAX_RETRY = 5

/**
 * SSE の接続を管理する軽量クラス。Reconnect や ping 応答をここで吸収する。
 */
export class NotificationStream {
	private readonly url: string
	private source: EventSource | null = null
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null
	private retryCount = 0
	private status: ConnectionStatus = 'idle'
	private readonly listeners = new Set<NotificationListener>()
	private readonly statusListeners = new Set<StatusListener>()

	constructor(baseUrl: string, options: { channels?: string[] } = {}) {
		this.url = NotificationStream.buildUrl(baseUrl, options.channels)
	}

	private static buildUrl(baseUrl: string, channels?: string[]): string {
		if (!channels || channels.length === 0) {
			return baseUrl
		}

		const params = new URLSearchParams()
		for (const channel of channels) {
			if (channel && channel.trim().length > 0) {
				params.append('channel', channel.trim())
			}
		}
		if (!params.toString()) {
			return baseUrl
		}
		const separator = baseUrl.includes('?') ? '&' : '?'
		return `${baseUrl}${separator}${params.toString()}`
	}

	start() {
		if (!browser)
			return
		if (this.source)
			return

		this.updateStatus('connecting')
		this.source = new EventSource(this.url, { withCredentials: true })

		this.source.addEventListener('open', () => {
			this.retryCount = 0
			this.updateStatus('open')
		})

		this.source.addEventListener('message', (event: MessageEvent) => {
			this.handleMessage(event)
		})

		this.source.addEventListener('ping', () => {
			// ping イベントは接続維持確認のみなので状態更新だけ行う。
			this.updateStatus('open')
		})

		this.source.addEventListener('error', () => {
			this.handleError()
		})
	}

	stop(closeCompletely = true) {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = null
		}
		if (this.source) {
			this.source.close()
			this.source = null
		}
		this.retryCount = 0
		if (closeCompletely) {
			this.updateStatus('closed')
		}
	}

	onMessage(listener: NotificationListener) {
		this.listeners.add(listener)
		return () => this.listeners.delete(listener)
	}

	onStatus(listener: StatusListener) {
		this.statusListeners.add(listener)
		listener(this.status)
		return () => this.statusListeners.delete(listener)
	}

	private handleMessage(event: MessageEvent) {
		if (!event.data || typeof event.data !== 'string')
			return
		try {
			const message = JSON.parse(event.data) as NotificationEvent
			if (!message || typeof message.channel !== 'string' || !message.payload) {
				console.error('[notifications] SSE message shape invalid', message)
				return
			}
			this.listeners.forEach((listener) => listener(message))
		} catch (error) {
			console.error('[notifications] SSE payload parse failed', error)
		}
	}

	private handleError() {
		if (this.retryCount >= MAX_RETRY) {
			this.stop()
			this.updateStatus('closed')
			return
		}

		this.updateStatus('reconnecting')
		const delay = Math.min(BASE_DELAY_MS * 2 ** this.retryCount, MAX_DELAY_MS)
		this.retryCount += 1

		if (this.reconnectTimer)
			return
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null
			this.stop(false)
			this.start()
		}, delay)
	}

	private updateStatus(status: ConnectionStatus) {
		this.status = status
		this.statusListeners.forEach((listener) => listener(status))
	}
}
