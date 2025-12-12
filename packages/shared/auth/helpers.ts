import { SessionExpiredError } from '../errors/types'
import { SESSION_EXPIRED_MESSAGE, type TokenResponse } from './types'

/**
 * HTTPステータスコードをエラーオブジェクトから取得
 */
export function getStatusCodeFromError(error: unknown): number | undefined {
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

/**
 * 401エラーかどうか判定
 */
export function isUnauthorizedError(error: unknown): boolean {
	return getStatusCodeFromError(error) === 401
}

/**
 * セッション期限切れエラーを作成
 */
export function createSessionExpiredError(cause?: unknown) {
	return new SessionExpiredError(SESSION_EXPIRED_MESSAGE, { cause })
}

/**
 * 共通：401時に1回だけリフレッシュして再試行する安全呼び出し
 */
export async function withAutoRefresh<T>(params: {
	exec: () => Promise<T>
	refresh: () => Promise<TokenResponse>
	onRefreshed: (tokens: TokenResponse) => void
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
