import type { UIError } from '$lib/errors/types'
import type { auth as AuthNS, BaseURL } from '$lib/generated/client'
import type { Cookies, RequestEvent } from '@sveltejs/kit'

import { goto } from '$app/navigation'
import { isAuthenticationError, isSystemError, transformApiError } from '$lib/errors/transformer'
import { SessionExpiredError } from '$lib/errors/types'
import Client, { Local } from '$lib/generated/client'
import { isSentryActive, reportError } from '$lib/monitoring/sentry'
import { setError } from '$lib/stores/error'

/**
 * ===========================================
 * エラーハンドリング統合機能
 * ===========================================
 */

export interface TokenSet {
	access_token: string | null
	refresh_token: string | null
}

export const ACCESS_COOKIE = 'acc_at'
export const REFRESH_COOKIE = 'acc_rt'

const DEFAULT_BASE_URL: BaseURL = Local

interface ProcessLike { env?: Record<string, string | undefined> }

function getNodeProcess(): ProcessLike | undefined {
	if (typeof globalThis === 'undefined')
		return undefined
	const global = globalThis as Record<string, unknown>
	const processKey = 'process'
	if (typeof global[processKey] === 'undefined')
		return undefined
	return global[processKey] as ProcessLike
}

const nodeProcess: ProcessLike | undefined = getNodeProcess()

const processEnv = (nodeProcess?.env ?? {})

function coerceBaseURL(source?: string | null): BaseURL | null {
	if (!source)
		return null
	const value = source.trim()
	if (!value)
		return null

	if (/^https?:\/\//i.test(value)) {
		return value
	}

	if (/^\d+$/.test(value)) {
		return `http://localhost:${value}`
	}

	if (/^[\w.-]+:\d+$/.test(value)) {
		return `http://${value}`
	}

	if (/^localhost$/i.test(value)) {
		return DEFAULT_BASE_URL
	}

	if (/^localhost(?!:\/\/)/i.test(value)) {
		return `http://${value}`
	}

	return value
}

function resolveBaseURL(): BaseURL {
	const importMetaEnv = (typeof import.meta !== 'undefined' ? (import.meta.env ?? {}) : {}) as Record<string, string | undefined>
	const isBrowser = typeof window !== 'undefined'

	const serverSideCandidates = [
		processEnv.ENCORE_BASE_URL,
		processEnv.VITE_ENCORE_BASE_URL,
		processEnv.PUBLIC_ENCORE_BASE_URL,
		processEnv.ENCORE_API_ORIGIN,
		processEnv.ENCORE_API_URL,
		processEnv.ENCORE_API_HOST,
		processEnv.ENCORE_API_PORT,
	]

	const browserSideCandidates = [
		importMetaEnv.VITE_ENCORE_BASE_URL,
		importMetaEnv.PUBLIC_ENCORE_BASE_URL,
	]

	const candidates = isBrowser
		? [...browserSideCandidates, ...serverSideCandidates]
		: [...serverSideCandidates]

	for (const candidate of candidates) {
		const resolved = coerceBaseURL(candidate)
		if (resolved) {
			return resolved
		}
	}

	return DEFAULT_BASE_URL
}

const BASE_URL = resolveBaseURL()

/**
 * ランタイム環境に応じて決定されたEncore APIのベースURLを返す。
 * - SvelteKit サーバーハンドラー等で直接 fetch する場合に利用。
 */
export function getApiBaseURL(): BaseURL {
	return BASE_URL
}

export function getTokensFromCookies(cookies: Cookies): TokenSet {
	return {
		access_token: cookies.get(ACCESS_COOKIE) ?? null,
		refresh_token: cookies.get(REFRESH_COOKIE) ?? null,
	}
}

export function setTokensToCookies(cookies: Cookies, tokens: { access_token: string, refresh_token: string, expires_in?: number }) {
	const isProd = processEnv.NODE_ENV === 'production'
	const maxAge = tokens.expires_in ?? 60 * 15 // fallback 15min
	const common = { path: '/', httpOnly: true as const, sameSite: 'lax' as const, secure: isProd }
	cookies.set(ACCESS_COOKIE, tokens.access_token, { ...common, maxAge })
	// refreshは長め（30日相当）: バックエンドの運用に合わせて変更可
	cookies.set(REFRESH_COOKIE, tokens.refresh_token, { ...common, maxAge: 60 * 60 * 24 * 30 })
}

export function clearTokens(cookies: Cookies) {
	const common = { path: '/' } as const
	cookies.delete(ACCESS_COOKIE, common)
	cookies.delete(REFRESH_COOKIE, common)
}

/**
 * サーバー側：SvelteKitの`event`からクライアントを生成（Authorization自動付与）
 */
export function serverClient(event: RequestEvent) {
	return new Client(BASE_URL, {
		// 常に最新のCookieからAuthorizationを生成する（トークン更新直後でも即反映）
		auth: () => {
			const at = event.cookies.get(ACCESS_COOKIE)
			return at ? ({ authorization: `Bearer ${at}` } as AuthNS.AuthParams) : {}
		},
	})
}

/**
 * クライアント側：アクセストークンを渡してクライアント生成
 */
export function browserClient(accessToken?: string | null) {
	return new Client(BASE_URL, {
		auth: () => (accessToken ? ({ authorization: `Bearer ${accessToken}` } as AuthNS.AuthParams) : {}),
	})
}

/**
 * サーバー側：エンドユーザーのUAとIPをフォワードして呼ぶクライアント
 * - login/refresh等でRawRequestに正しいUA/IPを渡すために使用
 */
export function serverClientWithForwardedHeaders(event: RequestEvent) {
	// 受信ヘッダから元のクライアントIP/UAを極力保存してEncoreへフォワード
	const clientIp = 'getClientAddress' in event && typeof event.getClientAddress === 'function'
		? event.getClientAddress()
		: undefined
	const h = event.request.headers
	const userAgent = h.get('user-agent') || undefined
	const xffIncoming = h.get('x-forwarded-for') || undefined
	const xriIncoming = h.get('x-real-ip') || undefined
	const cfIp = h.get('cf-connecting-ip') || undefined // Cloudflare等
	const trueClientIp = h.get('true-client-ip') || undefined // Akamai等
	const forwardedHeader = h.get('forwarded') || undefined // RFC 7239

	// XFFは既存チェインを維持しつつ、未設定ならSvelteKitの getClientAddress を末尾に付与
	let xffOut = xffIncoming
	if (!xffOut && clientIp)
		xffOut = clientIp

	const headersToForward: Record<string, string> = {}
	if (userAgent) {
		headersToForward['user-agent'] = userAgent
		headersToForward['x-client-user-agent'] = userAgent // backend側フォールバック用
	}
	if (xffOut)
		headersToForward['x-forwarded-for'] = xffOut
	if (xriIncoming || clientIp)
		headersToForward['x-real-ip'] = xriIncoming || clientIp!
	if (cfIp)
		headersToForward['cf-connecting-ip'] = cfIp
	if (trueClientIp)
		headersToForward['true-client-ip'] = trueClientIp
	if (forwardedHeader)
		headersToForward.forwarded = forwardedHeader

	return new Client(BASE_URL, { requestInit: { headers: headersToForward } })
}

/**
 * サーバー側：任意ヘッダを付与して呼ぶクライアント（Authorization付き）
 */
export function serverClientWithHeaders(event: RequestEvent, headers: Record<string, string>) {
	const at = event.cookies.get(ACCESS_COOKIE)
	const authHeader = at ? { authorization: `Bearer ${at}` } as AuthNS.AuthParams : {}
	return new Client(BASE_URL, {
		auth: () => authHeader,
		requestInit: { headers },
	})
}

const SESSION_EXPIRED_MESSAGE = 'セッションが期限切れです。再度ログインしてください。'

function getStatusCodeFromError(error: unknown): number | undefined {
	if (typeof error === 'object' && error !== null) {
		if ('status' in error && typeof (error as { status: unknown }).status === 'number') {
			return (error as { status: number }).status
		}
		if ('statusCode' in error && typeof (error as { statusCode: unknown }).statusCode === 'number') {
			return (error as { statusCode: number }).statusCode
		}
		if ('message' in error && typeof (error as { message: unknown }).message === 'string' && (error as { message: string }).message.includes('status 401')) {
			return 401
		}
	}
	return undefined
}

function isUnauthorizedError(error: unknown): boolean {
	return getStatusCodeFromError(error) === 401
}

function createSessionExpiredError(cause?: unknown) {
	return new SessionExpiredError(SESSION_EXPIRED_MESSAGE, { cause })
}

/**
 * 共通：401時に1回だけリフレッシュして再試行する安全呼び出し
 */
export async function withAutoRefresh<T>(params: {
	exec: () => Promise<T>
	refresh: () => Promise<{ access_token: string, refresh_token: string, expires_in: number }>
	onRefreshed: (tokens: { access_token: string, refresh_token: string, expires_in: number }) => void
}): Promise<T> {
	try {
		return await params.exec()
	} catch (error) {
		if (!isUnauthorizedError(error))
			throw error
		let tokens
		try {
			tokens = await params.refresh()
		} catch (refreshError) {
			throw createSessionExpiredError(refreshError)
		}
		params.onRefreshed(tokens)
		try {
			return await params.exec()
		} catch (postRefreshError) {
			if (isUnauthorizedError(postRefreshError))
				throw createSessionExpiredError(postRefreshError)
			throw postRefreshError
		}
	}
}

/**
 * API呼び出しを統一エラーハンドリングでラップ
 *
 * 機能:
 * - APIエラーをUIErrorに自動変換
 * - グローバルエラーストアへの自動セット
 * - 認証エラー時の自動リダイレクト（オプション）
 * - カスタムエラーハンドラのサポート
 *
 * 使用例:
 * ```typescript
 * const result = await withErrorHandling(
 *   () => client.user.getProfile(),
 *   {
 *     showGlobalError: true,
 *     redirectOnAuthError: true,
 *     onError: (uiError) => {
 *       console.log('Custom error handling:', uiError)
 *     }
 *   }
 * )
 * ```
 */
export async function withErrorHandling<T>(
	fn: () => Promise<T>,
	options?: {
		/** グローバルエラーストアに自動セットするか（デフォルト: true） */
		showGlobalError?: boolean
		/** 認証エラー時に自動リダイレクトするか（デフォルト: true） */
		redirectOnAuthError?: boolean
		/** 自動クリアまでの時間（ミリ秒）。0 = 自動クリアなし（デフォルト: 5000） */
		autoCloseMs?: number
		/** カスタムエラーハンドラ */
		onError?: (error: UIError) => void
		/** エラーをSentryに自動レポートするか（デフォルト: Sentryが有効な場合true） */
		reportToSentry?: boolean
	},
): Promise<T> {
	const {
		showGlobalError = true,
		redirectOnAuthError = true,
		autoCloseMs = 5000,
		onError,
		reportToSentry = isSentryActive(), // Sentryが有効な場合のみtrue
	} = options || {}

	try {
		return await fn()
	} catch (error) {
		// UIErrorに変換（セッション切れは特別扱い）
		let uiError: UIError
		if (error instanceof SessionExpiredError) {
			const errMessage = error instanceof Error ? error.message : SESSION_EXPIRED_MESSAGE
			uiError = {
				code: 'ERR_AUTH_004',
				userMessage: errMessage || SESSION_EXPIRED_MESSAGE,
				statusCode: 401,
				details: {
					retryable: false,
					suggestedAction: 'relogin',
				},
				originalError: error,
			}
		} else {
			uiError = transformApiError(error)
		}

		// Sentryへ自動レポート
		// システムエラー（500+）は常に送信
		// クライアントエラー（400-499）も監視のため送信（認証、権限、Not Foundなど）
		if (reportToSentry) {
			// エラーレベルの判定
			const level = isSystemError(uiError) ? 'error' : 'warning'

			reportError(new Error(uiError.userMessage), {
				level,
				tags: {
					errorCode: uiError.code,
					statusCode: String(uiError.statusCode),
					errorCategory: isSystemError(uiError) ? 'system' : 'client',
				},
				extra: {
					details: uiError.details,
					originalError: uiError.originalError,
				},
			})
		}

		// カスタムハンドラを実行
		if (onError) {
			onError(uiError)
		}

		// グローバルエラーにセット
		if (showGlobalError) {
			setError(uiError, autoCloseMs)
		}

		// 認証エラーの場合、自動リダイレクト（ブラウザのみ）
		if (redirectOnAuthError && isAuthenticationError(uiError) && typeof window !== 'undefined') {
			// 少し遅延させてエラーメッセージを見せる
			setTimeout(() => {
				void goto('/login')
			}, 1500)
		}

		// エラーを再スロー（呼び出し側で個別処理が必要な場合）
		throw uiError
	}
}

/**
 * API呼び出しを統一エラーハンドリング + 自動リフレッシュでラップ
 *
 * withAutoRefresh と withErrorHandling を組み合わせた便利関数
 *
 * 使用例:
 * ```typescript
 * const result = await withErrorHandlingAndRefresh({
 *   exec: () => client.user.getProfile(),
 *   refresh: () => client.auth.refreshToken({ refresh_token: rt }),
 *   onRefreshed: (tokens) => { setTokensToCookies(event.cookies, tokens) }
 * })
 * ```
 */
export async function withErrorHandlingAndRefresh<T>(params: {
	exec: () => Promise<T>
	refresh: () => Promise<{ access_token: string, refresh_token: string, expires_in: number }>
	onRefreshed: (tokens: { access_token: string, refresh_token: string, expires_in: number }) => void
	errorHandling?: {
		showGlobalError?: boolean
		redirectOnAuthError?: boolean
		autoCloseMs?: number
		onError?: (error: UIError) => void
		reportToSentry?: boolean
	}
}): Promise<T> {
	return withErrorHandling(
		async () => withAutoRefresh({
			exec: params.exec,
			refresh: params.refresh,
			onRefreshed: params.onRefreshed,
		}),
		params.errorHandling,
	)
}
