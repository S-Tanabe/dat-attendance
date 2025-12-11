/**
 * 環境設定の一元管理
 *
 * フロントエンドの環境判定とサンプリングレート設定を統一管理します。
 * バックエンドのencoreのappMeta()と同等の役割を果たします。
 */

import { dev } from '$app/environment'

/**
 * 環境タイプ
 * - local: ローカル開発環境
 * - development: 開発環境
 * - production: 本番環境
 */
export type Environment = 'local' | 'development' | 'production'

/**
 * 現在の環境を取得
 *
 * 環境変数VITE_ENVIRONMENTが設定されている場合はその値を使用し、
 * 未設定の場合はSvelteKitのdev flagで判定します。
 *
 * @returns 現在の環境
 */
export function getEnvironment(): Environment {
	const envVar = import.meta.env.VITE_ENVIRONMENT as string | undefined

	// 環境変数が設定されている場合はそれを使用
	if (envVar === 'local' || envVar === 'development' || envVar === 'production') {
		return envVar
	}

	// フォールバック: SvelteKitのdev flagで判定
	// dev serverが動いている = local、そうでない = production
	return dev ? 'local' : 'production'
}

/**
 * ローカル開発環境かどうか
 */
export function isLocalDevelopment(): boolean {
	return getEnvironment() === 'local'
}

/**
 * 本番環境かどうか
 */
export function isProduction(): boolean {
	return getEnvironment() === 'production'
}

/**
 * 開発環境かどうか
 */
export function isDevelopment(): boolean {
	return getEnvironment() === 'development'
}

/**
 * Sentryの分散トレーシングサンプリングレートを取得
 *
 * 環境ごとに最適なサンプリングレートを返します。
 * バックエンドのgetTracesSampleRate()と同じロジックです。
 *
 * - local: 30% - ローカル開発でログ過多を防ぐ
 * - production: 10% - 本番で効率的なサンプリング
 * - development: 100% - 開発環境で完全トレース
 *
 * @param env - 環境名
 * @returns サンプリングレート (0.0 ~ 1.0)
 */
export function getTracesSampleRate(env: Environment): number {
	switch (env) {
		case 'local':
			return 0.3 // 30%
		case 'production':
			return 0.1 // 10%
		case 'development':
			return 1.0 // 100%
		default:
			return 0.5 // 50%
	}
}

/**
 * Sentryの Session Replay サンプリングレートを取得
 *
 * 環境ごとに最適なリプレイサンプリングレートを返します。
 *
 * - local: 10% - ローカル開発
 * - production: 5% - 本番環境
 * - development: 20% - 開発環境
 *
 * @param env - 環境名
 * @returns リプレイサンプリングレート (0.0 ~ 1.0)
 */
export function getReplaysSessionSampleRate(env: Environment): number {
	switch (env) {
		case 'local':
			return 0.1 // 10%
		case 'production':
			return 0.05 // 5%
		case 'development':
			return 0.2 // 20%
		default:
			return 0.1 // 10%
	}
}

/**
 * 環境情報をコンソールに出力
 */
export function logEnvironmentInfo() {
	const env = getEnvironment()
	console.log(`[Environment] Current: ${env}`)
	console.log(`[Environment] Traces sample rate: ${getTracesSampleRate(env) * 100}%`)
	console.log(`[Environment] Replay sample rate: ${getReplaysSessionSampleRate(env) * 100}%`)
}
