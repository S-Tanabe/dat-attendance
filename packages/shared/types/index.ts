/**
 * 共通型定義 (shared package)
 *
 * 各frontendで共通して使用する型定義をエクスポート
 */

// エラー関連の型
export type {
	APIErrorLike,
	SuggestedActionType,
	UIError,
} from '../errors/types'

export { SessionExpiredError } from '../errors/types'

// 認証関連の型
export type {
	TokenResponse,
	TokenSet,
} from '../auth/types'

export {
	ACCESS_COOKIE,
	REFRESH_COOKIE,
	SESSION_EXPIRED_MESSAGE,
} from '../auth/types'
