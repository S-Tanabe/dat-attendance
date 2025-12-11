/**
 * エラーハンドリングシステム
 *
 * このモジュールは、フロントエンド全体で統一されたエラー処理を提供します。
 *
 * 使用例:
 * ```typescript
 * import { transformApiError, setError } from "$lib/errors";
 *
 * try {
 *   await apiClient.user.create({ ... });
 * } catch (error) {
 *   const uiError = transformApiError(error);
 *   setError(uiError);
 * }
 * ```
 */

export { clearError, errorSeverity, globalError, hasError, isRetryable, setError } from '$lib/stores/error'
export * from './error-codes'
export * from './error-messages'
export * from './transformer'
export * from './types'
