// Database wiring for Auth Service
// - マイグレーションは `./migrations` 配下。
// - 本DBはauthサービス専用のため、他サービスのテーブル参照はできません。
//   例: auth_handlerで `app_users` を参照すると実行時エラーになる点に注意。
import { SQLDatabase } from "encore.dev/storage/sqldb";

// 認証専用データベース
export const db = new SQLDatabase("auth", {
  migrations: "./migrations",
});
