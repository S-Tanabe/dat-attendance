import { db } from "./database";
import log from "encore.dev/log";
import { api } from "encore.dev/api";
import { CronJob } from "encore.dev/cron";
import { secret } from "encore.dev/config";

export async function recordAdminAction(params: {
  actor_user_id?: string | null;
  actor_email?: string | null;
  action: string;
  target_type?: string | null;
  target_id?: string | null;
  payload?: any;
  success?: boolean;
  error_message?: string | null;
  severity?: 'info' | 'warning' | 'error' | 'critical';
}) {
  try {
    await db.exec`
      INSERT INTO dev_admin_audit_logs (
        actor_user_id, actor_email, action, target_type, target_id, payload,
        success, error_message, severity
      ) VALUES (
        ${params.actor_user_id || null}, ${params.actor_email || null}, ${params.action},
        ${params.target_type || null}, ${params.target_id || null}, ${JSON.stringify(params.payload || {})},
        ${params.success !== false}, ${params.error_message || null}, ${params.severity || 'info'}
      )
    `;
  } catch (e) {
    log.error("Failed to write dev audit log", { error: e, action: params.action });
  }
}

const RETENTION_SECRET = secret("DEVTOOLS_AUDIT_RETENTION_DAYS");

export const _cleanupAuditLogs = api({}, async () => {
  let days = 90;
  try {
    const v = parseInt(RETENTION_SECRET());
    if (Number.isFinite(v) && v > 0) days = v;
  } catch {}
  await db.exec`
    DELETE FROM dev_admin_audit_logs
    WHERE created_at < NOW() - (INTERVAL '1 day' * ${days})
  `;
  log.info("dev_tools audit cleanup executed", { retention_days: days });
});

const cleanupJob = new CronJob("dev-tools-audit-cleanup", {
  title: "Cleanup dev tools audit logs",
  every: "24h",
  endpoint: _cleanupAuditLogs,
});
