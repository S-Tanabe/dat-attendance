/**
 * エラーハンドリングシステム (shared package)
 *
 * このモジュールは、フロントエンド全体で統一されたエラー処理を提供します。
 *
 * 使用例:
 * ```typescript
 * import { transformApiError } from "@dat-attendance/shared/errors";
 *
 * try {
 *   await apiClient.user.create({ ... });
 * } catch (error) {
 *   const uiError = transformApiError(error);
 *   // handle error
 * }
 * ```
 */

export * from './error-codes'
export * from './error-messages'
export * from './transformer'
export * from './types'
