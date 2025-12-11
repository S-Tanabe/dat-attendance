import { Service } from "encore.dev/service";
import { secret } from "encore.dev/config";
import { createSentryMiddleware } from "../../shared/monitoring";

/*
 * App Service (モジュラモノリス: アプリケーションユーザードメイン)
 *
 * 役割:
 * - アプリ固有のユーザープロファイル/ロール/表示名などの管理を担当。
 * - 認証基盤(auth)とはDBスキーマを分離し、同一UUIDでユーザーを関連付ける。
 * - 権限は app.roles が一次ソース。authは認証に専念。
 */

// Sentry DSNをシークレットとして取得
const sentryDsn = secret("SENTRY_DSN_BACKEND");

export default new Service("app", {
  middlewares: [createSentryMiddleware("app", sentryDsn)],
});
