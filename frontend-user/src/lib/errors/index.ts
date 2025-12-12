/**
 * エラーハンドリングシステム
 *
 * このモジュールは、フロントエンド全体で統一されたエラー処理を提供します。
 * 共通のエラー処理ロジックは @dat-attendance/shared から提供されます。
 */

// ローカルの stores から再エクスポート
export { clearError, errorSeverity, globalError, hasError, isRetryable, setError } from '$lib/stores/error'

// shared パッケージからの再エクスポート
export * from '@dat-attendance/shared/errors'
