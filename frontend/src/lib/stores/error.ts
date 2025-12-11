import type { UIError } from '$lib/errors/types'
import { derived, writable } from 'svelte/store'

/**
 * グローバルエラー状態
 *
 * 使用例:
 * - トースト通知
 * - モーダルエラー表示
 * - ページ上部のエラーバナー
 */
export const globalError = writable<UIError | null>(null)

/**
 * エラーを設定
 *
 * @param error UIError オブジェクト
 * @param autoCloseMs 自動クリアまでの時間（ミリ秒）。0 = 自動クリアなし
 */
export function setError(error: UIError, autoCloseMs: number = 5000) {
	globalError.set(error)

	if (autoCloseMs > 0) {
		setTimeout(() => {
			globalError.set(null)
		}, autoCloseMs)
	}
}

/**
 * エラーをクリア
 */
export function clearError() {
	globalError.set(null)
}

/**
 * エラーが存在するか
 */
export const hasError = derived(globalError, ($error) => $error !== null)

/**
 * エラーが再試行可能か
 */
export const isRetryable = derived(
	globalError,
	($error) => $error?.details?.retryable ?? false,
)

/**
 * エラーの重要度（警告 or クリティカル）
 */
export const errorSeverity = derived(globalError, ($error) => {
	if (!$error)
		return null
	return $error.statusCode >= 500 ? 'critical' : 'warning'
})
