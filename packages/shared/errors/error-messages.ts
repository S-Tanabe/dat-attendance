/**
 * エラーコード → ユーザー向けメッセージのマッピング
 *
 * 多言語対応する場合は、この構造を維持したまま
 * i18n ライブラリと統合可能
 */

// ===== Encore 標準エラーコード =====
export const STANDARD_ERROR_MESSAGES: Record<string, string> = {
	// 入力系
	invalid_argument: '入力内容に誤りがあります。ご確認ください。',

	// リソース系
	not_found: '指定されたリソースが見つかりません。',
	already_exists: '既に登録されています。',

	// 権限系
	permission_denied: 'この操作を実行する権限がありません。',
	unauthenticated: 'ログインが必要です。再度ログインしてください。',

	// ビジネスロジック系
	failed_precondition: '現在この操作は実行できません。',

	// システムエラー
	internal: 'サーバーエラーが発生しました。しばらく待ってから再度お試しください。',
	unavailable: 'サービスが一時的に利用できません。しばらく待ってからお試しください。',
	deadline_exceeded: '処理がタイムアウトしました。再度お試しください。',

	// その他
	unknown: '予期しないエラーが発生しました。',
}

// ===== ビジネス固有エラーコード（既存サービス用） =====
export const BUSINESS_ERROR_MESSAGES: Record<string, string> = {
	// 認証系
	ERR_AUTH_001: '無効なトークンです。再度ログインしてください。',
	ERR_AUTH_002: 'トークンの有効期限が切れています。再度ログインしてください。',
	ERR_AUTH_003: 'リフレッシュトークンが無効です。再度ログインしてください。',
	ERR_AUTH_004: 'セッションが期限切れです。再度ログインしてください。',
	ERR_AUTH_005: 'メールアドレスまたはパスワードが正しくありません。',
	ERR_AUTH_006: 'アカウントがロックされています。しばらく待ってから再度お試しください。',
	ERR_AUTH_007: 'このIPアドレスからのアクセスがブロックされています。',
	ERR_AUTH_008: '不審なアクティビティが検出されました。セキュリティ確認が必要です。',

	// ユーザー系
	ERR_USER_001: 'このメールアドレスは既に登録されています。',
	ERR_USER_002: 'メールアドレスの形式が正しくありません。',
	ERR_USER_003: 'パスワードが脆弱です。より強力なパスワードを設定してください。',
	ERR_USER_004: 'アカウントが停止されています。サポートに連絡してください。',
	ERR_USER_005: 'ユーザーが見つかりません。',
	ERR_USER_006: 'ユーザーデータが無効です。',
	ERR_USER_007: 'この操作を実行する権限が不足しています。',

	// 通知系
	ERR_NOTIFICATION_001: '通知の送信に失敗しました。',
	ERR_NOTIFICATION_002: '無効な宛先が指定されています。',
	ERR_NOTIFICATION_003: '通知テンプレートが見つかりません。',
	ERR_NOTIFICATION_004: '通知の送信回数が制限を超えています。しばらく待ってから再度お試しください。',
	ERR_NOTIFICATION_005: '通知チャネルが利用できません。',

	// 開発ツール系
	ERR_DEVTOOLS_001: 'この機能へのアクセスは許可されていません。',
	ERR_DEVTOOLS_002: '無効な操作です。',
	ERR_DEVTOOLS_003: 'リソースがロックされています。',
	ERR_DEVTOOLS_004: '監査ログの記録に失敗しました。',
	ERR_DEVTOOLS_005: 'ストレージ操作に失敗しました。',

	// バリデーション系
	ERR_VALIDATION_001: '入力値が無効です。',
	ERR_VALIDATION_002: '必須フィールドが入力されていません。',
	ERR_VALIDATION_003: 'フォーマットエラーです。',
	ERR_VALIDATION_004: '値が範囲外です。',

	// 汎用エラー
	VALIDATION_ERROR: '入力内容に誤りがあります。ご確認ください。',
	RESOURCE_NOT_FOUND: '指定されたリソースが見つかりません。',
	PERMISSION_DENIED: 'この操作を実行する権限がありません。',
	EXTERNAL_SERVICE_ERROR: '外部サービスとの通信に失敗しました。しばらく待ってから再度お試しください。',
	INTERNAL_ERROR: 'サーバーエラーが発生しました。問題が解決しない場合はサポートに連絡してください。',
}

/**
 * エラーコードからユーザー向けメッセージを取得
 */
export function getErrorMessage(
	errorCode: string,
	businessCode?: string,
): string {
	// ビジネスコードが存在する場合、優先的に使用
	if (businessCode && BUSINESS_ERROR_MESSAGES[businessCode]) {
		return BUSINESS_ERROR_MESSAGES[businessCode]
	}

	// 標準エラーコードを使用
	if (STANDARD_ERROR_MESSAGES[errorCode]) {
		return STANDARD_ERROR_MESSAGES[errorCode]
	}

	// デフォルトメッセージ
	return 'エラーが発生しました。'
}
