/**
 * エラーコード定数
 *
 * エラー判定関数で使用するエラーコードを定数として管理
 * 新しいエラーコードを追加する際は、このファイルのみ修正すれば良い
 */

/**
 * 認証エラーコード
 * ログインが必要、トークンが無効など
 */
export const AUTH_ERROR_CODES = new Set([
	'unauthenticated', // Encore標準: 認証されていない
	'ERR_AUTH_001', // ビジネス: ログインが必要
	'ERR_AUTH_002', // ビジネス: トークンが無効
	'ERR_AUTH_003', // ビジネス: トークンの有効期限切れ
	'ERR_AUTH_004', // ビジネス: セッションタイムアウト
]) as ReadonlySet<string>

/**
 * 権限エラーコード
 * アクセス権限がない、ロールが不足など
 */
export const PERMISSION_ERROR_CODES = new Set([
	'permission_denied', // Encore標準: 権限がない
	'ERR_USER_007', // ビジネス: ロール不足
	'ERR_DEVTOOLS_001', // ビジネス: 開発ツールへのアクセス権限なし
]) as ReadonlySet<string>

/**
 * システムエラーのHTTPステータスコード
 * サーバー側のエラー
 */
export const SYSTEM_ERROR_STATUS_CODES = new Set([
	500, // Internal Server Error
	502, // Bad Gateway
	503, // Service Unavailable
	504, // Gateway Timeout
]) as ReadonlySet<number>

/**
 * 一時的なエラーコード（再試行可能）
 * ネットワークエラー、タイムアウトなど
 */
export const RETRYABLE_ERROR_CODES = new Set([
	'unavailable', // Encore標準: サービス利用不可
	'deadline_exceeded', // Encore標準: タイムアウト
	'ERR_NOTIFICATION_002', // ビジネス: 通知送信失敗（再試行可能）
]) as ReadonlySet<string>

/**
 * バリデーションエラーコード
 * 入力値が不正など
 */
export const VALIDATION_ERROR_CODES = new Set([
	'invalid_argument', // Encore標準: 引数が無効
	'failed_precondition', // Encore標準: 前提条件が満たされていない
	'ERR_USER_001', // ビジネス: メールアドレスが既に登録済み
	'ERR_USER_002', // ビジネス: 無効なメールアドレス形式
	'ERR_USER_003', // ビジネス: パスワードの要件を満たしていない
	'ERR_USER_004', // ビジネス: ユーザー名が既に使用されている
]) as ReadonlySet<string>

/**
 * リソース未検出エラーコード
 */
export const NOT_FOUND_ERROR_CODES = new Set([
	'not_found', // Encore標準: リソースが見つからない
	'ERR_USER_006', // ビジネス: ユーザーが見つからない
]) as ReadonlySet<string>

/**
 * 競合エラーコード
 */
export const CONFLICT_ERROR_CODES = new Set([
	'already_exists', // Encore標準: 既に存在する
]) as ReadonlySet<string>
