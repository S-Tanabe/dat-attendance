-- Consolidated Auth Schema (0001)

-- Users
CREATE TABLE IF NOT EXISTS auth_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sessions
CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  refresh_token_family UUID,
  user_agent TEXT,
  ip_address TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  device_id UUID,
  device_name TEXT,
  last_activity_at TIMESTAMPTZ DEFAULT now(),
  session_type TEXT DEFAULT 'web',
  is_suspicious BOOLEAN DEFAULT false,
  geo_country TEXT,
  geo_city TEXT,
  geo_region TEXT,
  geo_latitude DOUBLE PRECISION,
  geo_longitude DOUBLE PRECISION,
  geo_timezone TEXT,
  risk_score INTEGER DEFAULT 0,
  risk_factors JSONB DEFAULT '{}'
);

-- Session audit logs
CREATE TABLE IF NOT EXISTS auth_session_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID,
  user_id UUID,
  action TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  device_id UUID,
  device_name TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User devices
CREATE TABLE IF NOT EXISTS auth_user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  device_id UUID NOT NULL UNIQUE,
  device_name TEXT NOT NULL,
  device_fingerprint TEXT,
  trusted BOOLEAN DEFAULT false,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trust_score INTEGER DEFAULT 50,
  successful_logins INTEGER DEFAULT 0,
  failed_attempts INTEGER DEFAULT 0,
  risk_events JSONB DEFAULT '[]',
  geo_locations JSONB DEFAULT '[]',
  usual_time_pattern JSONB DEFAULT '{}'
);

-- Cleanup stats
CREATE TABLE IF NOT EXISTS auth_cleanup_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expired_sessions_deleted INTEGER NOT NULL DEFAULT 0,
  revoked_sessions_deleted INTEGER NOT NULL DEFAULT 0,
  audit_logs_archived INTEGER NOT NULL DEFAULT 0,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Anomaly logs
CREATE TABLE IF NOT EXISTS auth_anomaly_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  session_id UUID,
  device_id UUID,
  anomaly_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  risk_score INTEGER NOT NULL DEFAULT 0,
  details JSONB NOT NULL,
  ip_address TEXT,
  geo_location JSONB,
  user_agent TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  auto_blocked BOOLEAN DEFAULT false,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_notes TEXT
);

-- Realtime activities
CREATE TABLE IF NOT EXISTS auth_realtime_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  session_id UUID,
  device_id UUID,
  activity_type TEXT NOT NULL,
  endpoint TEXT,
  ip_address TEXT,
  geo_location JSONB,
  risk_score INTEGER,
  response_time_ms INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- IP reputation
CREATE TABLE IF NOT EXISTS auth_ip_reputation (
  ip_address TEXT PRIMARY KEY,
  risk_level TEXT NOT NULL,
  risk_score INTEGER NOT NULL DEFAULT 0,
  threat_types JSONB DEFAULT '[]',
  country TEXT,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  reports_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- Indexes
CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);
CREATE INDEX IF NOT EXISTS idx_auth_users_active ON auth_users(is_active);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON auth_sessions(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_device ON auth_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON auth_sessions(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON auth_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_revoked ON auth_sessions(revoked_at);
CREATE INDEX IF NOT EXISTS idx_sessions_family ON auth_sessions(refresh_token_family);
CREATE INDEX IF NOT EXISTS idx_sessions_risk_score ON auth_sessions(risk_score);
CREATE INDEX IF NOT EXISTS idx_sessions_geo_country ON auth_sessions(geo_country);
CREATE INDEX IF NOT EXISTS idx_audit_logs_session ON auth_session_audit_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON auth_session_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON auth_session_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_user_devices_user ON auth_user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_device ON auth_user_devices(device_id);
CREATE INDEX IF NOT EXISTS idx_cleanup_stats_created ON auth_cleanup_stats(created_at);
CREATE INDEX IF NOT EXISTS idx_anomaly_logs_user ON auth_anomaly_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_anomaly_logs_severity ON auth_anomaly_logs(severity);
CREATE INDEX IF NOT EXISTS idx_anomaly_logs_detected ON auth_anomaly_logs(detected_at);
CREATE INDEX IF NOT EXISTS idx_anomaly_logs_unresolved ON auth_anomaly_logs(resolved, severity);
CREATE INDEX IF NOT EXISTS idx_realtime_activities_user ON auth_realtime_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_realtime_activities_session ON auth_realtime_activities(session_id);
CREATE INDEX IF NOT EXISTS idx_realtime_activities_created ON auth_realtime_activities(created_at);
CREATE INDEX IF NOT EXISTS idx_realtime_activities_type ON auth_realtime_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_ip_reputation_risk ON auth_ip_reputation(risk_level);
