import type { RequestEvent } from '@sveltejs/kit'

import { ACCESS_COOKIE, getApiBaseURL } from '$lib/api/client'

const backendStreamUrl = `${getApiBaseURL().replace(/\/$/, '')}/notifications/stream`

/**
 * 通知ストリーム（SSE）のプロキシハンドラー
 *
 * フロントエンドからのSSE接続を受け取り、バックエンドの `/notifications/stream` へプロキシする。
 * Cookie からアクセストークンを読み取り、Authorization ヘッダーとして付与することで、
 * ブラウザからの同一オリジン接続を実現している。
 *
 * @param event - SvelteKit の RequestEvent
 * @returns SSE ストリームの Response
 */
export async function handleNotificationStream(event: RequestEvent): Promise<Response> {
	const accessToken = event.cookies.get(ACCESS_COOKIE)
	if (!accessToken) {
		return new Response('Unauthorized', { status: 401 })
	}

	const searchParams = event.url.searchParams
	const url = new URL(backendStreamUrl)
	for (const [key, value] of searchParams.entries()) {
		if (key === 'channel' && value) {
			url.searchParams.append('channel', value)
		}
	}

	const backendResponse = await event.fetch(url.toString(), {
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Accept: 'text/event-stream',
		},
	})

	if (!backendResponse.ok || !backendResponse.body) {
		const bodyText = await backendResponse.text().catch(() => '')
		return new Response(bodyText || 'Upstream error', {
			status: backendResponse.status,
		})
	}

	const headers = new Headers()
	headers.set('Content-Type', 'text/event-stream')
	headers.set('Cache-Control', 'no-cache')
	headers.set('Connection', 'keep-alive')

	return new Response(backendResponse.body, {
		status: 200,
		headers,
	})
}
