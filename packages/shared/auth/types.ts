/**
 * 認証関連の型定義
 */

/**
 * トークンセット
 */
export interface TokenSet {
	access_token: string | null
	refresh_token: string | null
}

/**
 * トークンレスポンス（リフレッシュ・ログイン時）
 */
export interface TokenResponse {
	access_token: string
	refresh_token: string
	expires_in: number
}

/**
 * Cookie 名定数
 */
export const ACCESS_COOKIE = 'acc_at'
export const REFRESH_COOKIE = 'acc_rt'

/**
 * セッション期限切れメッセージ
 */
export const SESSION_EXPIRED_MESSAGE = 'セッションが期限切れです。再度ログインしてください。'
