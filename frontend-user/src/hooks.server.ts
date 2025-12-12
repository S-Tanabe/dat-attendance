/**
 * SvelteKit Server Hooks
 *
 * このファイルはサーバーサイドで実行されます。
 */

import type { Handle } from '@sveltejs/kit'

import process from 'node:process'

import { clearTokens } from '$lib/api/client'
import {
	getEnvironment,
	getTracesSampleRate,
} from '$lib/config/environment'
import { SessionExpiredError } from '@dat-attendance/shared/errors/types'
import { handleErrorWithSentry, sentryHandle } from '@sentry/sveltekit'
import * as Sentry from '@sentry/sveltekit'
import { redirect } from '@sveltejs/kit'
import { sequence } from '@sveltejs/kit/hooks'

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN_FRONTEND as string | undefined
const ENVIRONMENT = getEnvironment()
const VERSION = __APP_VERSION__ // package.jsonから注入される

/**
 * バックエンドAPIのベースURLを取得
 * 分散トレーシングのために使用
 */
function getBackendUrl(): string {
	// 環境変数から取得（優先度順）
	const backendUrl = (import.meta.env.VITE_ENCORE_BASE_URL as string | undefined)
		|| (import.meta.env.PUBLIC_ENCORE_BASE_URL as string | undefined)
		|| 'http://localhost:4000' // デフォルト

	return backendUrl
}

// Sentry初期化（サーバーサイド）
if (SENTRY_DSN) {
	const backendUrl = getBackendUrl()
	const tracesSampleRate = getTracesSampleRate(ENVIRONMENT)

	console.log('[Sentry Server Debug] Initializing with config:', {
		environment: ENVIRONMENT,
		version: VERSION,
		tracesSampleRate,
	})

	Sentry.init({
		dsn: SENTRY_DSN,

		// ✅ 環境情報
		environment: ENVIRONMENT,

		// ✅ リリースバージョン
		release: `frontend-user-server@${VERSION}`,

		// ✅ 環境別トレーシングサンプリング
		tracesSampleRate,

		// ✅ グローバルタグ
		initialScope: {
			tags: {
				'app.type': 'frontend-user-server',
				'app.framework': 'sveltekit',
				'node.version': process.version,
			},
		},

		// ✅ 分散トレーシング設定
		// SvelteKitサーバーからバックエンドAPIへのリクエストにsentry-traceとbaggageヘッダーを自動付与
		tracePropagationTargets: [
			'localhost', // デフォルト（localhost:任意ポート）
			/^\//, // 相対パス（/api/...など）
			backendUrl, // バックエンドAPI（環境変数から取得）
		],
	})
	console.log(`[Sentry Server] ✅ Initialized successfully`)
	console.log(`[Sentry Server] Environment: ${ENVIRONMENT}`)
	console.log(`[Sentry Server] Version: ${VERSION}`)
	console.log(`[Sentry Server] Trace propagation enabled for backend: ${backendUrl}`)
	console.log(`[Sentry Server] Sampling rate - traces: ${tracesSampleRate * 100}%`)
} else {
	console.log('[Sentry Server] DSN not configured, skipping initialization')
}

const sessionGuardHandle: Handle = async ({ event, resolve }) => {
	try {
		return await resolve(event)
	} catch (error) {
		if (error instanceof SessionExpiredError) {
			clearTokens(event.cookies)
			redirect(302, '/login?reason=session_expired')
		}
		throw error
	}
}

/**
 * リクエストハンドラ
 */
export const handle = sequence(sessionGuardHandle, sentryHandle())

/**
 * エラーハンドラ
 */
export const handleError = handleErrorWithSentry()
