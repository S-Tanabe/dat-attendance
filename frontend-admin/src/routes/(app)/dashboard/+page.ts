import * as Sentry from '@sentry/sveltekit'

/**
 * Dashboardページのデータロード
 * Sentryタグを設定してページを追跡
 */
export function load() {
	// ✅ ページタグを設定
	Sentry.setTag('page', 'dashboard')
	Sentry.setTag('section', 'overview')

	// ✅ ページロードをトレース
	return Sentry.startSpan(
		{ name: 'Dashboard Load', op: 'pageload' },
		() => {
			// データ取得処理（将来的にAPIコールを追加可能）
			return {
				timestamp: Date.now(),
			}
		},
	)
}
