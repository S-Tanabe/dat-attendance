import * as Sentry from '@sentry/sveltekit'

/**
 * 全ページ共通の初期化処理
 * Sentryのグローバルタグを設定
 */
export function load() {
	// ブラウザ情報をタグとして設定
	if (typeof window !== 'undefined') {
		Sentry.setTag('browser.viewport_width', window.innerWidth)
		Sentry.setTag('browser.viewport_height', window.innerHeight)
	}
}
