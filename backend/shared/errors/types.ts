/**
 * ビジネスエラーの詳細情報
 * Encore APIError の details フィールドに格納される
 */
export interface BusinessErrorDetails {
  /** ビジネス固有のエラーコード（例: ERR_AUTH_001） */
  errorCode: string;

  /** 詳細な理由（開発者向け、ログに記録） */
  reason: string;

  /** ユーザーが再試行可能か */
  retryable: boolean;

  /** UIが実行すべき推奨アクション（例: "relogin", "contact_support"） */
  suggestedAction?: string;

  /** エラーに関連するメタデータ（任意） */
  metadata?: Record<string, any>;
}

/**
 * エラーの重要度（Sentryタグ付けに使用）
 */
export enum ErrorSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

/**
 * エラーのカテゴリ（Sentryタグ付けに使用）
 */
export enum ErrorCategory {
  VALIDATION = "validation",
  BUSINESS = "business",
  AUTHENTICATION = "authentication",
  AUTHORIZATION = "authorization",
  SYSTEM = "system",
  EXTERNAL = "external",
}
