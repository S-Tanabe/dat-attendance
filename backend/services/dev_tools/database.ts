import { SQLDatabase } from "encore.dev/storage/sqldb";

// Dev Tools 専用データベース
export const db = new SQLDatabase("dev_tools", {
  migrations: "./migrations",
});

