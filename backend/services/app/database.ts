/*
 * App DB Wiring
 * - このDBは app サービス専用。テーブル: roles, app_users など。
 * - authサービスのDBとは別スキーマ。相互の直接参照は禁止（サービス越しに連携）。
 */
import { SQLDatabase } from "encore.dev/storage/sqldb";

export const db = new SQLDatabase("app", {
  migrations: "./migrations",
});
