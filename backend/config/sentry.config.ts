import * as Sentry from "@sentry/node";
import { appMeta } from "encore.dev";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * package.jsonからバージョンを取得
 * 環境変数VERSIONが設定されている場合はそちらを優先
 */
function getVersion(): string {
  try {
    const packageJsonPath = join(__dirname, "../package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    return packageJson.version || "dev";
  } catch {
    return "dev";
  }
}

/**
 * 環境別トレースサンプリングレート
 *
 * - local: 30% - ローカル開発でログ過多を防ぐ
 * - production: 20% - 本番で効率的なサンプリング
 * - development: 100% - 開発環境で完全トレース
 * - ephemeral: 50% - PRプレビューで適度なサンプリング
 */
function getTracesSampleRate(): number {
  const meta = appMeta();
  const envType = meta.environment.type;
  const envCloud = meta.environment.cloud;

  // ローカル開発: 30%（ログ過多を防ぐ）
  if (envCloud === "local") {
    return 0.3;
  }

  // 環境タイプ別
  switch (envType) {
    case "production":
      return 0.2; // 本番: 20%
    case "development":
      return 1.0; // 開発: 100%
    case "ephemeral":
      return 0.5; // PRプレビュー: 50%
    default:
      return 0.5; // デフォルト: 50%
  }
}

/**
 * 環境名の取得（Sentry用）
 *
 * ローカル開発は明示的に "local" として扱い、
 * それ以外は Encore の environment.type を使用
 */
function getSentryEnvironment(): string {
  const meta = appMeta();

  // ローカル開発は明示的に "local"
  if (meta.environment.cloud === "local") {
    return "local";
  }

  // それ以外は environment.type を使用
  return meta.environment.type;
}

/**
 * Sentry初期化設定を生成
 *
 * @param serviceName - サービス名（タグとログに使用）
 * @param dsn - Sentry DSN
 * @returns Sentry設定オブジェクト
 *
 * @example
 * ```typescript
 * const config = createSentryConfig("auth", sentryDsn());
 * Sentry.init(config);
 * ```
 */
export function createSentryConfig(serviceName: string, dsn: string): Sentry.NodeOptions {
  const meta = appMeta();
  const environment = getSentryEnvironment();
  const tracesSampleRate = getTracesSampleRate();
  const version = process.env.VERSION || getVersion();

  // バージョン情報をログ出力
  console.log(`[Sentry Config] Using version: ${version} for release tracking`);

  return {
    dsn,

    // ✅ 環境情報
    environment,

    // ✅ リリースバージョン（package.jsonを優先、環境変数をフォールバック）
    release: `backend@${version}`,

    // ✅ 環境別サンプリングレート
    tracesSampleRate,

    // ✅ エラーサンプリング（全環境で100%）
    sampleRate: 1.0,

    // ✅ グローバルタグとコンテキスト
    initialScope: {
      tags: {
        "app.type": "backend",
        "app.framework": "encore.dev",
        "app.service": serviceName,
        "node.version": process.version,
        "environment.cloud": meta.environment.cloud,
      },
    },

    // ✅ 統合設定（HTTPリクエストの自動トレーシング）
    integrations: [
      Sentry.httpIntegration(),
    ],

    // ✅ ブレッドクラム
    maxBreadcrumbs: 50,

    // ✅ 個人情報フィルタリング + デバッグ
    beforeSend(event, hint) {
      // ローカル開発時はコンソールに詳細出力
      if (meta.environment.cloud === "local") {
        console.log("[Sentry Debug]", {
          level: event.level,
          message: event.message,
          tags: event.tags,
        });
      }

      // 機密情報をマスク
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      if (event.request?.cookies) {
        delete event.request.cookies;
      }

      return event;
    },
  };
}

/**
 * サービス用のSentryヘルパー
 * 各サービスのAPI関数の先頭で呼び出してサービスタグを設定
 *
 * @param serviceName - サービス名
 * @param operation - 操作名（API関数名など）
 *
 * @example
 * ```typescript
 * export const signup = api(
 *   { expose: true, method: "POST", path: "/auth/signup" },
 *   async (params: SignupParams): Promise<SignupResponse> => {
 *     setSentryServiceContext("auth", "signup");
 *     // ... API implementation
 *   }
 * );
 * ```
 */
export function setSentryServiceContext(serviceName: string, operation: string) {
  Sentry.setTag("service", serviceName);
  Sentry.setTag("operation", operation);
}

/**
 * Sentryにユーザーコンテキストを設定
 *
 * ログイン後やトークン検証後に呼び出す
 *
 * @param userId - ユーザーID
 * @param email - ユーザーのメールアドレス（オプション）
 * @param username - ユーザー名（オプション）
 *
 * @example
 * ```typescript
 * const user = await getUserFromToken(token);
 * setSentryUser(user.id, user.email, user.username);
 * ```
 */
export function setSentryUser(userId: string, email?: string, username?: string) {
  Sentry.setUser({
    id: userId,
    email: email,
    username: username,
  });
}

/**
 * Sentryのユーザーコンテキストをクリア
 *
 * ログアウト時に呼び出す
 *
 * @example
 * ```typescript
 * await logout();
 * clearSentryUser();
 * ```
 */
export function clearSentryUser() {
  Sentry.setUser(null);
}
