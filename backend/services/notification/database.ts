import { SQLDatabase } from "encore.dev/storage/sqldb";

/**
 * 通知サービス専用データベース定義。
 * - `notifications` / `notification_deliveries` などのテーブルを管理。
 * - マイグレーションは `services/notification/migrations` 配下に配置する。
 */
export const db = new SQLDatabase("notification", {
  migrations: "./migrations",
});
