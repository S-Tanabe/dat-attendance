CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id UUID PRIMARY KEY,
  channel_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  priority_threshold TEXT NOT NULL DEFAULT 'normal',
  muted_until TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
