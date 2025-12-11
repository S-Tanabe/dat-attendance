-- Dev Tools audit logs
CREATE TABLE IF NOT EXISTS dev_admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID,
  actor_email TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  payload JSONB,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  severity TEXT DEFAULT 'info',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dev_audit_created ON dev_admin_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_dev_audit_action ON dev_admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_dev_audit_actor ON dev_admin_audit_logs(actor_user_id);

