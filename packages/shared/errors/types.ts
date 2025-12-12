/**
 * UI層で扱うエラーの統一型
 *
 * バックエンドの APIError から変換され、
 * コンポーネントで表示される
 */
export interface UIError {
	/** エラーコード（内部管理用） */
	code: string

	/** ユーザー表示用メッセージ */
	userMessage: string

	/** エラーの詳細情報 */
	details?: {
		/** ユーザーが再試行可能か */
		retryable: boolean

		/** UIが実行すべき推奨アクション */
		suggestedAction?: string

		/** 詳細な理由（開発者向け） */
		reason?: string

		/** 追加のメタデータ */
		metadata?: Record<string, unknown>
	}

	/** HTTPステータスコード */
	statusCode: number

	/** 元のエラーオブジェクト（デバッグ用） */
	originalError?: unknown
}

/**
 * 推奨アクションの種類（型定義）
 *
 * 注: 現在は文字列として直接使用されているため、
 * 将来的な型安全な使用のための定義として残しています
 */
export type SuggestedActionType
	= | 'relogin'
	| 'retry_later'
	| 'contact_support'
	| 'refresh_page'
	| 'check_permissions'
	| 'update_data'

/**
 * セッション期限切れを表す共通エラー
 * - SSR/CSR 双方で捕捉しやすいよう独自クラスとして公開
 */
export class SessionExpiredError extends Error {
	public readonly cause?: unknown

	constructor(message = 'セッションが期限切れです。再度ログインしてください。', options?: { cause?: unknown }) {
		super(message)
		this.name = 'SessionExpiredError'
		if (options?.cause !== undefined)
			this.cause = options.cause
	}
}

/**
 * APIError の共通インターフェース
 * Encore.dev の生成する APIError と互換性を持つ
 */
export interface APIErrorLike {
	code: string
	message: string
	details?: unknown
}
