import * as Sentry from "@sentry/node";
import { middleware } from "encore.dev/api";
import { APIError } from "encore.dev/api";
import type { APICallMeta } from "encore.dev";
import { appMeta } from "encore.dev";
import type { BusinessErrorDetails } from "../errors/types";
import { createSentryConfig } from "../../config/sentry.config";

/**
 * Sentry DSNの有効性をチェック
 * プレースホルダーや無効な形式のDSNを検出する
 *
 * 対応形式:
 * - Sentry.io (クラウド): https://<key>@o<orgid>.ingest[.<region>].sentry.io/<project>
 *   例: https://key@o123.ingest.sentry.io/456
 *       https://key@o123.ingest.us.sentry.io/456
 *       https://key@o123.ingest.de.sentry.io/456
 * - Self-hosted: https://<key>@<your-domain>/<project>
 *   例: https://key@sentry.example.com/1
 */
function isValidSentryDSN(dsn: string): boolean {
  if (!dsn || typeof dsn !== "string") {
    return false;
  }

  // プレースホルダーを検出（部分一致で安全なもののみ）
  const placeholders = [
    "example-dsn",
    "your-actual-dsn",
    "your-local-dsn",
    "your-backend-dsn",
  ];

  for (const placeholder of placeholders) {
    if (dsn.includes(placeholder)) {
      return false;
    }
  }

  // exampleファイルの完全なDSNパターンを検出（完全一致）
  // NOTE: "o123456"は実在し得る組織IDなので、部分一致ではチェックしない
  if (dsn === "https://example-dsn@o123456.ingest.sentry.io/123456") {
    return false;
  }

  // 最低限の形式チェック
  if (!dsn.startsWith("https://")) {
    return false;
  }

  // Sentry DSNの基本形式: https://<key>@<host>/<project>
  if (!dsn.includes("@")) {
    return false;
  }

  // DSNパターンの検証: https://<key>@<host>/<project>
  // <host>部分とプロジェクトIDの存在を確認
  try {
    const url = new URL(dsn);

    // ホスト名が存在することを確認
    if (!url.hostname) {
      return false;
    }

    // パス名が存在し、プロジェクトIDを含むことを確認
    // パスは "/" で始まり、少なくとも1つの文字が続く必要がある
    if (!url.pathname || url.pathname === "/" || url.pathname.length < 2) {
      return false;
    }

    // ユーザー名（公開キー）が存在することを確認
    if (!url.username) {
      return false;
    }

    return true;
  } catch {
    // URL解析に失敗した場合は無効なDSN
    return false;
  }
}

/**
 * Sentry ミドルウェアを作成
 *
 * 各サービスで secret() を使用してDSNを取得し、このファクトリに渡します。
 *
 * @example
 * ```typescript
 * import { secret } from "encore.dev/config";
 * import { createSentryMiddleware } from "../../shared/monitoring";
 *
 * const sentryDsn = secret("SENTRY_DSN_BACKEND");
 *
 * export default new Service("myservice", {
 *   middlewares: [createSentryMiddleware("myservice", sentryDsn)],
 * });
 * ```
 */
export function createSentryMiddleware(serviceName: string, sentryDsnLoader: () => string) {
  let isSentryEnabled = false;

  // Sentry初期化
  try {
    const dsn = sentryDsnLoader();

    if (!dsn) {
      console.log(`[Sentry:${serviceName}] 未接続状態です（DSN未設定）`);
    } else if (!isValidSentryDSN(dsn)) {
      // 無効なDSN（プレースホルダーや形式エラー）を事前に弾く
      console.warn(`[Sentry:${serviceName}] 未接続状態です（DSNが無効: プレースホルダーまたは形式エラー）`);
      console.warn(`[Sentry:${serviceName}] .secrets.local.cue.exampleをコピーした場合は、実際のDSNに置き換えてください`);
      // デバッグ用: DSNの形式情報を出力（キーは隠す）
      if (process.env.NODE_ENV === "development") {
        const maskedDsn = dsn.replace(/(?<=https:\/\/)([^@]+)(?=@)/, "***");
        console.warn(`[Sentry:${serviceName}] 受け取ったDSN形式: ${maskedDsn}`);
      }
    } else {
      // ✅ 新しい設定システムを使用
      const config = createSentryConfig(serviceName, dsn);
      Sentry.init(config);

      const meta = appMeta();
      console.log(`[Sentry:${serviceName}] 接続完了 (environment: ${meta.environment.type}, cloud: ${meta.environment.cloud}, tracesSampleRate: ${config.tracesSampleRate})`);
      isSentryEnabled = true;
    }
  } catch (error) {
    // Sentry初期化エラーはアプリケーションの動作に影響を与えない
    // エラー詳細を表示して開発者がデバッグできるようにする
    console.warn(`[Sentry:${serviceName}] 初期化に失敗しました（監視機能は無効）`);
    console.warn(`[Sentry:${serviceName}] エラー詳細:`, error);
  }

  // ミドルウェアを返す
  return middleware(async (req, next) => {
    // requestMeta から method と path を取得（API call の場合のみ）
    const meta = req.requestMeta;
    const requestInfo = meta?.type === "api-call"
      ? { method: meta.method, path: meta.path }
      : { method: "UNKNOWN", path: "/unknown" };

    // リクエスト処理のコアロジック
    const processRequest = async () => {
      try {
        const response = await next(req);

        // Sentryが有効な場合、分散トレーシング用のヘッダーを追加
        // フロントエンドがバックエンドのトレースを継続できるようにする
        if (isSentryEnabled) {
          try {
            const traceData = Sentry.getTraceData();
            if (traceData["sentry-trace"]) {
              response.header.set("sentry-trace", traceData["sentry-trace"]);
            }
            if (traceData["baggage"]) {
              response.header.set("baggage", traceData["baggage"]);
            }
          } catch (sentryError) {
            // トレースヘッダーの追加に失敗してもアプリは継続
            console.warn(`[Sentry:${serviceName}] トレースヘッダー追加失敗:`, sentryError);
          }
        }

        return response;
      } catch (error) {
        // エラーをログに記録
        logError(error, requestInfo);

        // Sentry にエラー送信（有効な場合のみ）
        if (isSentryEnabled) {
          try {
            captureError(error, requestInfo);
          } catch (sentryError) {
            // Sentryへの送信に失敗してもアプリは継続
            console.warn(`[Sentry:${serviceName}] エラー送信失敗:`, sentryError);
          }
        }

        // エラーは必ず再スロー（Encoreのエラーハンドリングに委譲）
        throw error;
      }
    };

    // Sentryが有効な場合はスパンでラップ（v8 API）
    if (isSentryEnabled) {
      return await Sentry.startSpan(
        {
          name: `${requestInfo.method} ${requestInfo.path}`,
          op: "http.server",
        },
        processRequest
      );
    }

    // Sentry無効時は通常処理
    return await processRequest();
  });
}

/**
 * エラーをコンソールログに記録
 */
function logError(error: unknown, requestInfo: { method: string; path: string }) {
  if (error instanceof APIError) {
    const details = error.details as BusinessErrorDetails;

    console.error("[API Error]", {
      code: error.code,
      message: error.message,
      businessCode: details?.errorCode,
      reason: details?.reason,
      retryable: details?.retryable,
      endpoint: requestInfo.path,
      method: requestInfo.method,
    });
  } else {
    // 予期しないエラー
    console.error("[Unexpected Error]", {
      error,
      endpoint: requestInfo.path,
      method: requestInfo.method,
    });
  }
}

/**
 * エラーを Sentry にキャプチャ
 */
function captureError(error: unknown, requestInfo: { method: string; path: string }) {
  if (error instanceof APIError) {
    const details = error.details as BusinessErrorDetails;

    Sentry.captureException(error, {
      level: getSeverityLevel(error.code),
      tags: {
        error_code: error.code,
        business_code: details?.errorCode,
        retryable: details?.retryable?.toString(),
        endpoint: requestInfo.path,
        method: requestInfo.method,
      },
      extra: {
        reason: details?.reason,
        suggested_action: details?.suggestedAction,
        metadata: details?.metadata,
      },
    });
  } else {
    // 予期しないエラーは critical レベル
    Sentry.captureException(error, {
      level: "error",
      tags: {
        unexpected: "true",
        endpoint: requestInfo.path,
        method: requestInfo.method,
      },
    });
  }
}

/**
 * エラーコード → Sentry severity レベル
 */
function getSeverityLevel(errorCode: string): Sentry.SeverityLevel {
  const mapping: Record<string, Sentry.SeverityLevel> = {
    invalid_argument: "warning",
    not_found: "info",
    already_exists: "info",
    permission_denied: "warning",
    unauthenticated: "warning",
    failed_precondition: "warning",
    internal: "error",
    unavailable: "error",
    deadline_exceeded: "warning",
  };
  return mapping[errorCode] || "error";
}
