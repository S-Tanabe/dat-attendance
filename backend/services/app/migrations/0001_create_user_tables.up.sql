-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  level INT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create app_users table
-- Note: id is NOT auto-generated, it matches auth_users.id
CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY,
  display_name TEXT,
  avatar_url TEXT,
  role_id UUID REFERENCES roles(id),
  first_name TEXT,
  last_name TEXT,
  first_name_romaji TEXT,
  last_name_romaji TEXT,
  avatar_bucket_key TEXT,
  timezone TEXT DEFAULT 'Asia/Tokyo',
  language TEXT DEFAULT 'ja',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users(role_id);
CREATE INDEX IF NOT EXISTS idx_app_users_name ON app_users(first_name, last_name);

-- Insert initial roles
INSERT INTO roles (name, level, description) VALUES
  ('super_admin', 1, 'スーパー管理者'),
  ('admin', 2, 'クライアント管理者'),
  ('user', 3, '一般ユーザー')
ON CONFLICT (name) DO NOTHING;