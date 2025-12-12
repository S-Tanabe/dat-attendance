/**
 * Sentry統合（フロントエンド）
 *
 * Sentry DSNが設定されている場合のみ初期化されます。
 * 設定されていない場合はスキップされ、コンソールログのみが出力されます。
 */

import {
	getEnvironment,
	getReplaysSessionSampleRate,
	getTracesSampleRate,
} from '$lib/config/environment'

import * as Sentry from '@sentry/sveltekit'

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN_FRONTEND as string | undefined
const ENVIRONMENT = getEnvironment()
const VERSION = __APP_VERSION__ // package.jsonから注入される

let isSentryEnabled = false

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

/**
 * Sentry初期化
 */
export function initSentry() {
	// ✅ デバッグログ: DSN確認
	console.log('[Sentry Debug] DSN configured:', SENTRY_DSN ? 'YES' : 'NO')
	console.log('[Sentry Debug] Environment:', ENVIRONMENT)

	if (!SENTRY_DSN) {
		console.log('[Sentry] DSN not configured, skipping initialization')
		return false
	}

	try {
		const backendUrl = getBackendUrl()

		// ✅ 環境ごとのサンプリングレート取得
		const tracesSampleRate = getTracesSampleRate(ENVIRONMENT)
		const replaysSessionSampleRate = getReplaysSessionSampleRate(ENVIRONMENT)

		console.log('[Sentry Debug] Initializing with config:', {
			environment: ENVIRONMENT,
			version: VERSION,
			tracesSampleRate,
			replaysSessionSampleRate,
		})

		Sentry.init({
			dsn: SENTRY_DSN,

			// ✅ 環境情報
			environment: ENVIRONMENT,

			// ✅ リリースバージョン
			release: `frontend-user@${VERSION}`,

			// ✅ 環境別トレーシングサンプリング
			tracesSampleRate,

			// ✅ Session Replay（環境別サンプリング）
			replaysSessionSampleRate,
			replaysOnErrorSampleRate: 1.0, // エラー時は100%録画

			// ✅ 分散トレーシング設定
			// バックエンドAPIへのリクエストにsentry-traceとbaggageヘッダーを自動付与
			tracePropagationTargets: [
				'localhost', // デフォルト（localhost:任意ポート）
				/^\//, // 相対パス（/api/...など）
				backendUrl, // バックエンドAPI（環境変数から取得）
				/^https?:\/\/.*$/, // 全HTTPリクエスト（本番環境用）
			],

			// ✅ グローバルタグ
			initialScope: {
				tags: {
					'app.type': 'frontend-user',
					'app.framework': 'sveltekit',
					'browser.locale': typeof navigator !== 'undefined' ? navigator.language : 'unknown',
				},
			},

			// User Feedback Widget & Session Replay
			integrations: (defaultIntegrations) => {
				// カスタム統合機能
				const customIntegrations = [
					Sentry.feedbackIntegration({
						// 自動表示
						autoInject: true,

						// システムテーマに追従
						colorScheme: 'system',

						// Sentryブランディング非表示
						showBranding: false,

						// 日本語テキスト
						formTitle: 'フィードバックを送信',
						triggerLabel: 'フィードバック',
						submitButtonLabel: '送信',
						cancelButtonLabel: 'キャンセル',
						messagePlaceholder: 'ご意見をお聞かせください',

						// コールバック（デバッグ用）
						onFormOpen: () => {
							console.log('[Sentry Feedback] Form opened')
						},
						onSubmitSuccess: (data: unknown) => {
							console.log('[Sentry Feedback] Submitted:', data)
						},
						onSubmitError: (error: Error) => {
							console.error('[Sentry Feedback] Submit failed:', error)
						},
					}),
					Sentry.replayIntegration(),
					Sentry.browserTracingIntegration(),
				]

				// 開発・ローカル環境: Dedupeを無効化（全エラーを送信）
				if (ENVIRONMENT === 'local' || ENVIRONMENT === 'development') {
					console.log('[Sentry] Dedupe disabled for development')
					return defaultIntegrations
						.filter((integration) => integration.name !== 'Dedupe')
						.concat(customIntegrations)
				}

				// 本番環境: Dedupeを維持（ノイズ削減）
				console.log('[Sentry] Dedupe enabled for production')
				return defaultIntegrations.concat(customIntegrations)
			},

			// 個人情報フィルタリング + デバッグ出力
			beforeSend(event) {
				// ✅ 本番環境: エラーコードベースのカスタムフィンガープリント
				// 異なるエラーコードは別イベントとして記録される
				if (ENVIRONMENT === 'production') {
					if (event.tags?.errorCode && event.tags?.statusCode) {
						event.fingerprint = [
							String(event.tags.errorCode),
							String(event.tags.statusCode),
						]
					}
				}

				// ✅ 開発・ローカル環境でのデバッグ出力
				if (ENVIRONMENT === 'local' || ENVIRONMENT === 'development') {
					console.log('[Sentry Debug] Event sent:', {
						level: event.level,
						message: event.message,
						tags: event.tags,
						fingerprint: event.fingerprint || 'default',
						user: event.user || 'not set',
					})
				}

				// Cookie から JWT トークンを削除
				if (event.request?.cookies) {
					delete event.request.cookies
				}
				if (event.request?.headers?.authorization) {
					delete event.request.headers.authorization
				}
				return event
			},
		})

		console.log(`[Sentry] ✅ Initialized successfully`)
		console.log(`[Sentry] Environment: ${ENVIRONMENT}`)
		console.log(`[Sentry] Version: ${VERSION}`)
		console.log(`[Sentry] Trace propagation enabled for backend: ${backendUrl}`)
		console.log(`[Sentry] Sampling rates - traces: ${tracesSampleRate * 100}%, replay: ${replaysSessionSampleRate * 100}%`)
		isSentryEnabled = true
		return true
	} catch (error) {
		console.error('[Sentry] Failed to initialize:', error)
		return false
	}
}

/**
 * Sentryが有効かどうか
 */
export function isSentryActive(): boolean {
	return isSentryEnabled
}

/**
 * カスタムエラーをSentryにレポート
 */
export function reportError(
	error: Error,
	context?: {
		level?: Sentry.SeverityLevel
		tags?: Record<string, string>
		extra?: Record<string, unknown>
	},
) {
	if (!isSentryEnabled) {
		console.error('[Error Report]', error, context)
		return
	}

	Sentry.captureException(error, {
		level: context?.level || 'error',
		tags: context?.tags,
		extra: context?.extra,
	})
}

/**
 * Sentryにユーザーコンテキストを設定
 *
 * ログイン後やページロード時に呼び出す
 *
 * @param userId - ユーザーID
 * @param email - ユーザーのメールアドレス（オプション）
 * @param username - ユーザー名（オプション）
 *
 * @example
 * ```typescript
 * setSentryUser(user.id, user.email);
 * ```
 */
export function setSentryUser(userId: string, email?: string, username?: string) {
	if (!isSentryEnabled)
		return

	Sentry.setUser({
		id: userId,
		email,
		username,
	})
}

/**
 * Sentryのユーザーコンテキストをクリア
 *
 * ログアウト時に呼び出す
 *
 * @example
 * ```typescript
 * await logout();
 * clearSentryUser();
 * ```
 */
export function clearSentryUser() {
	if (!isSentryEnabled)
		return

	Sentry.setUser(null)
}
