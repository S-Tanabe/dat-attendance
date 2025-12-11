import type { RequestHandler } from './$types'

import { handleNotificationStream } from '$lib/notifications/proxy'

/**
 * 通知ストリームエンドポイント
 *
 * GET /notifications/stream
 *
 * ブラウザからのSSE接続を受け付け、バックエンドへプロキシする。
 * 実際のロジックは lib/notifications/proxy.ts に実装されており、
 * ここはSvelteKitのルーティングのみを担当する。
 */
export const GET: RequestHandler = async (event) => {
	return handleNotificationStream(event)
}
