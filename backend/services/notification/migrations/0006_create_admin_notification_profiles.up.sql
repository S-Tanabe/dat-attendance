CREATE TABLE IF NOT EXISTS admin_notification_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_key TEXT NOT NULL UNIQUE,
  description TEXT,
  channel_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  priority_threshold TEXT NOT NULL DEFAULT 'normal',
  escalation_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
