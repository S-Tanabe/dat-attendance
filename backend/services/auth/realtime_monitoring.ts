/*
 * Realtime Monitoring (slim build)
 * - DBへの活動記録(recordActivity)と、通知ユーティリティのみ提供。
 * - 公開API（SSE/統計/履歴）は削除済み。
 */
import log from "encore.dev/log";
import { db } from "./database";
import type { AnomalyResult } from "./anomaly_detection";

export type ActivityType =
  | "login"
  | "logout"
  | "refresh"
  | "api_call"
  | "failed_attempt"
  | "anomaly_detected";

function devGeoEnabled(): boolean {
  const v = (process.env.DEV_GEO_ENABLED ?? 'true').toLowerCase();
  return !(v === 'false' || v === '0' || v === 'off');
}

function devGeoSampling(): number {
  const v = parseFloat(process.env.DEV_GEO_SAMPLING ?? '1');
  return Number.isNaN(v) ? 1 : Math.min(Math.max(v, 0), 1);
}

export async function recordActivity(
  user_id: string,
  session_id: string | null,
  device_id: string | null,
  activity_type: ActivityType,
  metadata: {
    endpoint?: string;
    ip_address?: string | null;
    user_agent?: string | null;
    geo_location?: any;
    risk_score?: number;
    response_time_ms?: number;
    additional_data?: any;
  }
): Promise<void> {
  if (!devGeoEnabled()) return;
  const sampling = devGeoSampling();
  if (sampling < 1 && Math.random() > sampling) return;

  await db.exec`
    INSERT INTO auth_realtime_activities (
      user_id, session_id, device_id, activity_type, endpoint,
      ip_address, geo_location, risk_score, response_time_ms, metadata
    ) VALUES (
      ${user_id}, ${session_id}, ${device_id}, ${activity_type}, ${metadata.endpoint || null},
      ${metadata.ip_address || null}, ${JSON.stringify(metadata.geo_location || {})},
      ${metadata.risk_score || null}, ${metadata.response_time_ms || null},
      ${JSON.stringify({ user_agent: metadata.user_agent, ...metadata.additional_data })}
    )
  `;

  log.debug("activity recorded", { user_id, activity_type, endpoint: metadata.endpoint });
}

// no-op broadcaster in slim build
async function broadcastToUser(_user_id: string, _event: any): Promise<void> { /* noop */ }

export async function notifyAnomalyDetected(user_id: string, anomalies: AnomalyResult[]): Promise<void> {
  for (const anomaly of anomalies) {
    await broadcastToUser(user_id, {
      type: "anomaly",
      data: {
        anomaly_type: anomaly.anomaly_type,
        severity: anomaly.severity,
        risk_score: anomaly.risk_score,
        explanation: anomaly.explanation,
        auto_block: anomaly.auto_block,
        details: anomaly.details,
      },
      timestamp: new Date(),
    });
  }
}

