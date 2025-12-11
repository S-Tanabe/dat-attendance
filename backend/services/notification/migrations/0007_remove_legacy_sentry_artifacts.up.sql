-- 外部連携撤去に伴い、過去に作成されたカラム・インデックス・設定テーブルを削除する。
ALTER TABLE notifications
  DROP COLUMN IF EXISTS sentry_event_id,
  DROP COLUMN IF EXISTS sentry_issue_url,
  DROP COLUMN IF EXISTS sentry_project_name,
  DROP COLUMN IF EXISTS sentry_environment;

DROP INDEX IF EXISTS idx_notifications_sentry_event;
DROP INDEX IF EXISTS idx_notifications_sentry_project_env;
DROP TABLE IF EXISTS sentry_notification_config;
