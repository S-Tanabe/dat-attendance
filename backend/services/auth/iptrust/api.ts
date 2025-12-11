import { api, APIError } from "encore.dev/api";
import { db } from "../database";
import { getEffectiveTrustConfig } from "./settings";

type Severity = 'low'|'medium'|'high'|'critical'

function toSeverity(score: number | null | undefined): Severity {
  const t = getEffectiveTrustConfig().thresholds
  const s = Number(score ?? 0)
  if (s >= t.critical) return 'critical'
  if (s >= t.high) return 'high'
  if (s >= t.medium) return 'medium'
  return 'low'
}

export const ip_trust_summary = api<{ hours?: number }, {
  window_hours: number;
  total_events: number;
  severity_counts: Record<Severity, number>;
  by_flag: Array<{ flag: string; count: number }>;
  top_ips: Array<{ ip: string; count: number; avg_score: number; severity: Severity }>;
  country_distribution: Array<{ country: string|null; count: number }>;
  recent: Array<{
    created_at: string;
    user_id: string;
    endpoint: string | null;
    ip_address: string | null;
    score: number | null;
    severity: Severity;
    flags: string[];
    decision_source: string | null;
    country: string | null;
    city: string | null;
  }>;
}>(
  { method: 'GET', path: '/auth/security/ip-trust/summary', expose: true, auth: true },
  async ({ hours = 24 }) => {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000)
    // 安全に存在チェック
    try {
      const reg = await db.queryRow<{ exists: string | null }>`
        SELECT to_regclass('auth_realtime_activities') as exists
      `
      if (!reg?.exists) {
        return { window_hours: hours, total_events: 0, severity_counts: { low:0, medium:0, high:0, critical:0 }, by_flag: [], top_ips: [], country_distribution: [], recent: [] }
      }
    } catch {
      return { window_hours: hours, total_events: 0, severity_counts: { low:0, medium:0, high:0, critical:0 }, by_flag: [], top_ips: [], country_distribution: [], recent: [] }
    }

    // 直近イベント取得
    const rows = db.query<{
      created_at: Date; user_id: string; endpoint: string | null; ip_address: string | null; risk_score: number | null; metadata: any; geo_location: any;
    }>`
      SELECT created_at, user_id, endpoint, ip_address, risk_score, metadata, geo_location
      FROM auth_realtime_activities
      WHERE created_at > ${since}
      ORDER BY created_at DESC
      LIMIT 1000
    `

    const recent: Array<{ created_at: string; user_id: string; endpoint: string|null; ip_address: string|null; score:number|null; severity:Severity; flags:string[]; decision_source:string|null; country:string|null; city:string|null; }> = []
    const flagCount = new Map<string, number>()
    const ipAgg = new Map<string, { count:number; sum:number; severity:Severity }>()
    const countryAgg = new Map<string|null, number>()
    let total = 0
    const sevCounts: Record<Severity, number> = { low:0, medium:0, high:0, critical:0 }

    for await (const r of rows) {
      total++
      const trust = r.metadata?.ip_trust || {}
      const flags: string[] = Array.isArray(trust.flags) ? trust.flags : []
      for (const f of flags) flagCount.set(f, (flagCount.get(f) || 0) + 1)
      const sev = toSeverity(r.risk_score)
      sevCounts[sev]++
      const ip = r.ip_address || 'unknown'
      const agg = ipAgg.get(ip) || { count:0, sum:0, severity:sev }
      agg.count += 1
      agg.sum += Number(r.risk_score ?? 0)
      // keep highest severity
      const order: Severity[] = ['low','medium','high','critical']
      agg.severity = order.indexOf(sev) > order.indexOf(agg.severity) ? sev : agg.severity
      ipAgg.set(ip, agg)
      const country = r.geo_location?.country ?? null
      countryAgg.set(country, (countryAgg.get(country) || 0) + 1)

      recent.push({
        created_at: r.created_at.toISOString(),
        user_id: r.user_id,
        endpoint: r.endpoint,
        ip_address: r.ip_address,
        score: r.risk_score,
        severity: sev,
        flags,
        decision_source: trust.decision_source || null,
        country,
        city: r.geo_location?.city ?? null,
      })
    }

    const by_flag = Array.from(flagCount.entries()).map(([flag,count])=>({flag,count})).sort((a,b)=>b.count-a.count)
    const top_ips = Array.from(ipAgg.entries()).map(([ip,agg])=>({ ip, count: agg.count, avg_score: agg.count ? Math.round((agg.sum/agg.count)*10)/10 : 0, severity: agg.severity }))
      .sort((a,b)=>b.count - a.count).slice(0,20)
    const country_distribution = Array.from(countryAgg.entries()).map(([country, count])=>({ country, count })).sort((a,b)=>b.count-a.count)

    return {
      window_hours: hours,
      total_events: total,
      severity_counts: sevCounts,
      by_flag,
      top_ips,
      country_distribution,
      recent: recent.slice(0,100),
    }
  }
)

export const ip_trust_events = api<{
  hours?: number;
  user_id?: string;
  ip?: string;
  severity?: Severity;
}, {
  events: Array<{
    created_at: string;
    user_id: string;
    endpoint: string | null;
    ip_address: string | null;
    score: number | null;
    severity: Severity;
    flags: string[];
    decision_source: string | null;
    country: string | null;
    city: string | null;
    reputation?: {
      is_vpn?: boolean;
      is_proxy?: boolean;
      is_tor?: boolean;
      is_datacenter?: boolean;
      threat_types?: string[];
      risk_level?: string;
      risk_score?: number;
    } | null;
  }>;
}>(
  { method: 'GET', path: '/auth/security/ip-trust/events', expose: true, auth: true },
  async ({ hours = 24, user_id, ip, severity }) => {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000)
    const rows = db.query<{
      created_at: Date; user_id: string; endpoint: string | null; ip_address: string | null; risk_score: number | null; metadata: any; geo_location: any;
    }>`
      SELECT created_at, user_id, endpoint, ip_address, risk_score, metadata, geo_location
      FROM auth_realtime_activities
      WHERE created_at > ${since}
      ORDER BY created_at DESC
      LIMIT 5000
    `
    const out: any[] = []
    for await (const r of rows) {
      const sev = toSeverity(r.risk_score)
      if (severity && sev !== severity) continue
      const trust = r.metadata?.ip_trust || {}
      const rep = r.geo_location?.reputation || null
      const rec = {
        created_at: r.created_at.toISOString(),
        user_id: r.user_id,
        endpoint: r.endpoint,
        ip_address: r.ip_address,
        score: r.risk_score,
        severity: sev,
        flags: Array.isArray(trust.flags) ? trust.flags : [],
        decision_source: trust.decision_source || null,
        country: r.geo_location?.country ?? null,
        city: r.geo_location?.city ?? null,
        reputation: rep ? {
          is_vpn: !!rep.is_vpn,
          is_proxy: !!rep.is_proxy,
          is_tor: !!rep.is_tor,
          is_datacenter: !!rep.is_datacenter,
          threat_types: Array.isArray(rep.threat_types) ? rep.threat_types : undefined,
          risk_level: rep.risk_level,
          risk_score: typeof rep.risk_score === 'number' ? rep.risk_score : undefined,
        } : null,
      }
      if (user_id && rec.user_id !== user_id) continue
      if (ip && rec.ip_address !== ip) continue
      out.push(rec)
    }
    return { events: out }
  }
)

export const ip_trust_anomalies = api<{ hours?: number; type?: string }, {
  anomalies: Array<{
    anomaly_type: string;
    severity: Severity;
    risk_score: number;
    detected_at: string;
    user_id: string | null;
    details: any;
  }>;
}>(
  { method: 'GET', path: '/auth/security/ip-trust/anomalies', expose: true, auth: true },
  async ({ hours = 24, type }) => {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000)
    const rows = db.query<{
      anomaly_type: string; severity: string; risk_score: number; detected_at: Date; user_id: string | null; details: any;
    }>`
      SELECT anomaly_type, severity, risk_score, detected_at, user_id, details
      FROM auth_anomaly_logs
      WHERE detected_at > ${since}
      ORDER BY detected_at DESC
      LIMIT 2000
    `
    const out: any[] = []
    for await (const r of rows) {
      if (type && r.anomaly_type !== type) continue
      const sev = toSeverity(r.risk_score)
      out.push({ anomaly_type: r.anomaly_type, severity: sev, risk_score: r.risk_score || 0, detected_at: r.detected_at.toISOString(), user_id: r.user_id, details: r.details })
    }
    return { anomalies: out }
  }
)
