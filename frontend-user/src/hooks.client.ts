/**
 * SvelteKit Client Hooks
 *
 * このファイルはクライアントサイドで実行されます。
 * Sentry統合などの初期化処理を行います。
 */

import { initSentry } from '$lib/monitoring/sentry'
import { handleErrorWithSentry } from '@sentry/sveltekit'

// Sentry初期化
initSentry()

/**
 * グローバルエラーハンドラ
 *
 * SvelteKitのエラーハンドリングとSentryを統合
 */
export const handleError = handleErrorWithSentry()
