import * as Sentry from '@sentry/sveltekit'

/**
 * dev_toolsセクション共通の初期化処理
 * セクション全体にタグを設定
 */
export function load() {
	// ✅ dev_tools セクション全体にタグを設定
	Sentry.setTag('section', 'dev_tools')
	Sentry.setTag('template_type', 'developer-tools')
}
