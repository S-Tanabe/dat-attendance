/**
 * ⚠️ 削除された関数: toMessage, mapStatusToTitle
 *
 * これらの関数は削除されました。
 * 新しいコードでは、統一エラーハンドリングシステムを使用してください。
 *
 * ## 移行ガイド
 *
 * ### 1. toMessage() の代替
 *
 * **旧:**
 * ```typescript
 * import { toMessage } from '$lib/errors'
 * const message = toMessage(error)
 * ```
 *
 * **新:**
 * ```typescript
 * import { transformApiError } from '$lib/errors'
 * const uiError = transformApiError(error)
 * const message = uiError.userMessage
 * ```
 *
 * ### 2. mapStatusToTitle() の代替
 *
 * **旧:**
 * ```typescript
 * import { mapStatusToTitle } from '$lib/errors'
 * const title = mapStatusToTitle(status)
 * ```
 *
 * **新:**
 * ```typescript
 * import { transformApiError } from '$lib/errors'
 * const uiError = transformApiError(error)
 * // uiError.userMessage にはエラーコード別の適切なメッセージが含まれます
 * ```
 *
 * ### 3. API呼び出しでのエラーハンドリング
 *
 * ```typescript
 * import { withErrorHandling } from '$lib/api/client'
 * import { setError } from '$lib/errors'
 *
 * // 自動エラートースト表示
 * const result = await withErrorHandling(
 *   () => client.app.someMethod(),
 *   { showGlobalError: true }
 * )
 *
 * // カスタムエラーハンドリング
 * const result = await withErrorHandling(
 *   () => client.app.someMethod(),
 *   {
 *     onError: (uiError) => {
 *       console.error('エラー:', uiError.userMessage)
 *       // カスタム処理
 *     }
 *   }
 * )
 * ```
 *
 * ## 新システムの利点
 *
 * - エラーコード別の適切な日本語メッセージ
 * - グローバルエラートースト表示
 * - 再試行可能性の判定
 * - 推奨アクションの提示
 * - Sentry統合による自動エラー監視
 * - 型安全なエラーハンドリング
 *
 * 詳細は ERROR_HANDLING.md を参照してください。
 */
