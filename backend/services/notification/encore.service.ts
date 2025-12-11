import { Service } from "encore.dev/service";
import { secret } from "encore.dev/config";
import { createSentryMiddleware } from "../../shared/monitoring";

/**
 * Notification Service
 *
 * 役割:
 * - 汎用通知の生成・保存を統括する。
 * - Pub/Sub を通じて delivery モジュールへ通知イベントを配信する。
 * - ユーザー／管理者向けの通知プリファレンスやエスカレーション設定を管理する。
 */

// Sentry DSNをシークレットとして取得
const sentryDsn = secret("SENTRY_DSN_BACKEND");

export default new Service("notification", {
  middlewares: [createSentryMiddleware("notification", sentryDsn)],
});
