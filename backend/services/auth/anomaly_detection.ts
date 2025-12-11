/*
 * Anomaly Detection
 *
 * 概要:
 * - ログイン等のリクエストコンテキスト（IP/UA/Geo/時間）を用いて、
 *   代表的な6種の異常を検出します。
 *   1) impossible_travel（不可能な移動）
 *   2) new_location（未知の場所）
 *   3) suspicious_time（怪しい時間帯）
 *   4) brute_force（総当たり）
 *   5) concurrent_sessions（同時セッション過多）
 *   6) device_anomaly（デバイス信頼度・失敗率・新規性）
 *
 * 使い方:
 * - detectAnomalies(user_id, session_id, device_id, RawRequest) を呼び、複数の結果を返します。
 * - 結果は `auth_anomaly_logs` へ記録される（slimテンプレでは通知連携は未提供）。
 *
 * 既知のギャップ:
 * - auth.ts の login/refresh は RawRequest を受け取っていないため、現状ここは未連携。
 *   → 将来: エンドポイントをRawRequest対応に改修し、critical検出時は即セッション失効/deny。
 */
import { api, APIError, RawRequest } from "encore.dev/api";
import log from "encore.dev/log";
import { db } from "./database";
import { getAuthData } from "~encore/auth";
import { 
  getGeoLocationFromIP, 
  calculateDistance, 
  isPossibleTravel, 
  extractRequestInfo,
  calculateGeoRiskScore,
  GeoLocation 
} from "./geo_location";
import { 
  calculatePatternDeviation, 
  learnUserPattern,
  update_device_trust 
} from "./trust_scoring";

// 異常検知の種類
export type AnomalyType = 
  | "impossible_travel" 
  | "new_location" 
  | "suspicious_time" 
  | "brute_force" 
  | "concurrent_sessions"
  | "device_anomaly";

// 深刻度レベル
export type SeverityLevel = "low" | "medium" | "high" | "critical";

// 異常検知結果
export interface AnomalyResult {
  is_anomalous: boolean;
  anomaly_type: AnomalyType | null;
  severity: SeverityLevel | null;
  risk_score: number;
  details: any;
  auto_block: boolean;
  explanation: string;
}

// メインの異常検知関数
export async function detectAnomalies(
  user_id: string,
  session_id: string | null,
  device_id: string | null,
  req: RawRequest
): Promise<AnomalyResult[]> {
  const { ip_address, user_agent } = extractRequestInfo(req);
  const anomalies: AnomalyResult[] = [];

  if (!ip_address) {
    return anomalies; // IPアドレスがない場合はスキップ
  }

  // 地理情報を取得
  const currentGeo = await getGeoLocationFromIP(ip_address);
  const currentTime = new Date();

  // 1. 不可能な移動の検出
  const travelAnomaly = await detectImpossibleTravel(user_id, currentGeo, currentTime);
  if (travelAnomaly.is_anomalous) {
    anomalies.push(travelAnomaly);
  }

  // 2. 新しい場所からのアクセス検出
  const locationAnomaly = await detectNewLocation(user_id, currentGeo);
  if (locationAnomaly.is_anomalous) {
    anomalies.push(locationAnomaly);
  }

  // 3. 怪しい時間帯のアクセス検出
  const timeAnomaly = await detectSuspiciousTime(user_id, currentTime);
  if (timeAnomaly.is_anomalous) {
    anomalies.push(timeAnomaly);
  }

  // 4. ブルートフォース攻撃の検出
  const bruteForceAnomaly = await detectBruteForce(user_id, ip_address);
  if (bruteForceAnomaly.is_anomalous) {
    anomalies.push(bruteForceAnomaly);
  }

  // 5. 同時セッション数の異常検出
  const concurrentAnomaly = await detectConcurrentSessions(user_id);
  if (concurrentAnomaly.is_anomalous) {
    anomalies.push(concurrentAnomaly);
  }

  // 6. デバイス固有の異常検出
  if (device_id) {
    const deviceAnomaly = await detectDeviceAnomaly(user_id, device_id, user_agent);
    if (deviceAnomaly.is_anomalous) {
      anomalies.push(deviceAnomaly);
    }
  }

  // 検出された異常をログに記録
  for (const anomaly of anomalies) {
    await logAnomaly(user_id, session_id, device_id, anomaly, {
      ip_address,
      user_agent,
      geo_location: currentGeo,
    });

    // デバイス信頼度を更新
    if (device_id) {
      await update_device_trust({
        device_id,
        event_type: "anomaly_detected",
        metadata: {
          anomaly_type: anomaly.anomaly_type,
          severity: anomaly.severity,
          details: anomaly.details,
        },
      });
    }
  }

  // slimテンプレでは外部通知を行わない

  return anomalies;
}

// 1. 不可能な移動の検出
async function detectImpossibleTravel(
  user_id: string,
  currentGeo: GeoLocation,
  currentTime: Date
): Promise<AnomalyResult> {
  if (!currentGeo.latitude || !currentGeo.longitude) {
    return {
      is_anomalous: false,
      anomaly_type: null,
      severity: null,
      risk_score: 0,
      details: { reason: "No coordinates available" },
      auto_block: false,
      explanation: "座標情報がないため、移動距離を計算できません",
    };
  }

  // 最近のセッションの地理情報を取得（1時間以内）
  const recentSessions = await db.query<{
    geo_latitude: number;
    geo_longitude: number;
    created_at: Date;
    ip_address: string;
  }>`
    SELECT geo_latitude, geo_longitude, created_at, ip_address
    FROM auth_sessions
    WHERE user_id = ${user_id}
      AND geo_latitude IS NOT NULL
      AND geo_longitude IS NOT NULL
      AND created_at > ${new Date(currentTime.getTime() - 6 * 60 * 60 * 1000)} -- 6時間以内
    ORDER BY created_at DESC
    LIMIT 5
  `;

  for await (const session of recentSessions) {
    const distance = calculateDistance(
      session.geo_latitude,
      session.geo_longitude,
      currentGeo.latitude,
      currentGeo.longitude
    );

    const timeDiffMinutes = (currentTime.getTime() - session.created_at.getTime()) / (1000 * 60);
    const isPossible = isPossibleTravel(distance, timeDiffMinutes);

    if (!isPossible && distance > 100) { // 100km以上の移動のみ対象
      return {
        is_anomalous: true,
        anomaly_type: "impossible_travel",
        severity: distance > 5000 ? "critical" : distance > 1000 ? "high" : "medium",
        risk_score: Math.min(90, distance / 100),
        details: {
          distance_km: distance,
          time_diff_minutes: timeDiffMinutes,
          from_location: `${session.geo_latitude}, ${session.geo_longitude}`,
          to_location: `${currentGeo.latitude}, ${currentGeo.longitude}`,
          previous_ip: session.ip_address,
        },
        auto_block: distance > 5000, // 5000km以上は自動ブロック
        explanation: `${Math.round(distance)}km離れた場所から${Math.round(timeDiffMinutes)}分以内にアクセスがありました`,
      };
    }
  }

  return {
    is_anomalous: false,
    anomaly_type: null,
    severity: null,
    risk_score: 0,
    details: {},
    auto_block: false,
    explanation: "移動パターンに異常はありません",
  };
}

// 2. 新しい場所からのアクセス検出
async function detectNewLocation(
  user_id: string,
  currentGeo: GeoLocation
): Promise<AnomalyResult> {
  if (!currentGeo.country || !currentGeo.city) {
    return {
      is_anomalous: false,
      anomaly_type: null,
      severity: null,
      risk_score: 0,
      details: { reason: "Location information incomplete" },
      auto_block: false,
      explanation: "地理情報が不完全です",
    };
  }

  // ユーザーの過去のログイン履歴を取得
  const loginHistory = await db.query<{
    geo_country: string;
    geo_city: string;
    count: number;
  }>`
    SELECT geo_country, geo_city, COUNT(*) as count
    FROM auth_sessions
    WHERE user_id = ${user_id}
      AND geo_country IS NOT NULL
      AND geo_city IS NOT NULL
    GROUP BY geo_country, geo_city
    ORDER BY count DESC
  `;

  const historyArray: any[] = [];
  for await (const location of loginHistory) {
    historyArray.push(location);
  }

  // 地理的リスクスコアを計算
  const geoRiskScore = calculateGeoRiskScore(currentGeo, historyArray);

  // 新しい国からのアクセス
  const isNewCountry = !historyArray.some(loc => loc.geo_country === currentGeo.country);
  // 新しい都市からのアクセス
  const isNewCity = !historyArray.some(loc => 
    loc.geo_country === currentGeo.country && loc.geo_city === currentGeo.city
  );

  let severity: SeverityLevel | null = null;
  let riskScore = geoRiskScore;

  if (isNewCountry) {
    severity = currentGeo.risk_level === "malicious" ? "critical" : 
               currentGeo.risk_level === "suspicious" ? "high" : "medium";
    riskScore += 30;
  } else if (isNewCity) {
    severity = "low";
    riskScore += 10;
  }

  if (isNewCountry || isNewCity) {
    return {
      is_anomalous: true,
      anomaly_type: "new_location",
      severity,
      risk_score: Math.min(riskScore, 100),
      details: {
        is_new_country: isNewCountry,
        is_new_city: isNewCity,
        country: currentGeo.country,
        city: currentGeo.city,
        geo_risk_factors: {
          is_vpn: currentGeo.is_vpn,
          is_proxy: currentGeo.is_proxy,
          is_tor: currentGeo.is_tor,
          risk_level: currentGeo.risk_level,
        },
        login_history_count: historyArray.length,
      },
      auto_block: currentGeo.risk_level === "malicious" && isNewCountry,
      explanation: isNewCountry 
        ? `新しい国（${currentGeo.country}）からのアクセスです`
        : `新しい都市（${currentGeo.city}）からのアクセスです`,
    };
  }

  return {
    is_anomalous: false,
    anomaly_type: null,
    severity: null,
    risk_score: riskScore,
    details: { geo_risk_score: riskScore },
    auto_block: false,
    explanation: "既知の場所からのアクセスです",
  };
}

// 3. 怪しい時間帯のアクセス検出
async function detectSuspiciousTime(
  user_id: string,
  currentTime: Date
): Promise<AnomalyResult> {
  const hour = currentTime.getHours();
  const dayOfWeek = currentTime.getDay(); // 0=日曜日

  // パターンからの逸脱度を計算
  const deviationScore = await calculatePatternDeviation(
    user_id,
    hour,
    dayOfWeek,
    null, // geo は別途処理
    null
  );

  let severity: SeverityLevel | null = null;
  let isAnomalous = false;

  // 深夜帯の強制チェック（2-5時）
  const isLateNight = hour >= 2 && hour <= 5;
  // 早朝の強制チェック（5-7時）
  const isEarlyMorning = hour >= 5 && hour <= 7;

  if (deviationScore > 70) {
    isAnomalous = true;
    severity = "high";
  } else if (deviationScore > 40 || isLateNight) {
    isAnomalous = true;
    severity = isLateNight ? "medium" : "low";
  }

  if (isAnomalous) {
    return {
      is_anomalous: true,
      anomaly_type: "suspicious_time",
      severity,
      risk_score: Math.max(deviationScore, isLateNight ? 35 : 0),
      details: {
        access_hour: hour,
        day_of_week: dayOfWeek,
        deviation_score: deviationScore,
        is_late_night: isLateNight,
        is_early_morning: isEarlyMorning,
        time_category: isLateNight ? "深夜" : isEarlyMorning ? "早朝" : "通常時間外",
      },
      auto_block: false,
      explanation: isLateNight 
        ? `深夜（${hour}時）のアクセスです。通常パターンからの逸脱度: ${deviationScore}%`
        : `通常と異なる時間帯（${hour}時）のアクセスです。逸脱度: ${deviationScore}%`,
    };
  }

  return {
    is_anomalous: false,
    anomaly_type: null,
    severity: null,
    risk_score: deviationScore,
    details: { 
      access_hour: hour, 
      day_of_week: dayOfWeek, 
      deviation_score: deviationScore 
    },
    auto_block: false,
    explanation: "通常の時間帯のアクセスです",
  };
}

// 4. ブルートフォース攻撃の検出
async function detectBruteForce(
  user_id: string,
  ip_address: string
): Promise<AnomalyResult> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // 過去1時間のログイン試行回数
  const hourlyAttempts = await db.queryRow<{ count: number }>`
    SELECT COUNT(*) as count
    FROM auth_realtime_activities
    WHERE user_id = ${user_id}
      AND activity_type = 'failed_attempt'
      AND created_at > ${oneHourAgo}
  `;

  // 過去24時間のログイン試行回数
  const dailyAttempts = await db.queryRow<{ count: number }>`
    SELECT COUNT(*) as count
    FROM auth_realtime_activities
    WHERE user_id = ${user_id}
      AND activity_type = 'failed_attempt'
      AND created_at > ${oneDayAgo}
  `;

  // 同一IPからの試行回数
  const ipAttempts = await db.queryRow<{ count: number }>`
    SELECT COUNT(*) as count
    FROM auth_realtime_activities
    WHERE ip_address = ${ip_address}
      AND activity_type = 'failed_attempt'
      AND created_at > ${oneHourAgo}
  `;

  const hourlyCount = hourlyAttempts?.count || 0;
  const dailyCount = dailyAttempts?.count || 0;
  const ipCount = ipAttempts?.count || 0;

  let isAnomalous = false;
  let severity: SeverityLevel | null = null;
  let riskScore = 0;
  let autoBlock = false;

  // ブルートフォースの閾値チェック
  if (hourlyCount >= 10 || ipCount >= 15) {
    isAnomalous = true;
    severity = "critical";
    riskScore = 90;
    autoBlock = true;
  } else if (hourlyCount >= 5 || dailyCount >= 20 || ipCount >= 8) {
    isAnomalous = true;
    severity = "high";
    riskScore = 70;
    autoBlock = false;
  } else if (hourlyCount >= 3 || dailyCount >= 10 || ipCount >= 5) {
    isAnomalous = true;
    severity = "medium";
    riskScore = 50;
    autoBlock = false;
  }

  if (isAnomalous) {
    return {
      is_anomalous: true,
      anomaly_type: "brute_force",
      severity,
      risk_score: riskScore,
      details: {
        hourly_attempts: hourlyCount,
        daily_attempts: dailyCount,
        ip_attempts: ipCount,
        threshold_exceeded: {
          hourly: hourlyCount >= 3,
          daily: dailyCount >= 10,
          ip: ipCount >= 5,
        },
      },
      auto_block: autoBlock,
      explanation: `ブルートフォース攻撃の可能性：過去1時間で${hourlyCount}回、過去24時間で${dailyCount}回の試行`,
    };
  }

  return {
    is_anomalous: false,
    anomaly_type: null,
    severity: null,
    risk_score: Math.min(hourlyCount * 5, 30),
    details: { 
      hourly_attempts: hourlyCount, 
      daily_attempts: dailyCount,
      ip_attempts: ipCount 
    },
    auto_block: false,
    explanation: "ログイン試行回数は正常範囲内です",
  };
}

// 5. 同時セッション数の異常検出
async function detectConcurrentSessions(user_id: string): Promise<AnomalyResult> {
  // アクティブなセッション数を取得
  const activeSessions = await db.queryRow<{ count: number }>`
    SELECT COUNT(*) as count
    FROM auth_sessions
    WHERE user_id = ${user_id}
      AND revoked_at IS NULL
      AND expires_at > NOW()
  `;

  const sessionCount = activeSessions?.count || 0;

  // ユーザーの平均セッション数を取得
  const avgSessions = await db.queryRow<{ avg_sessions: number }>`
    SELECT COALESCE(CAST(AVG(session_count) AS DOUBLE PRECISION), 0) as avg_sessions
    FROM (
      SELECT COUNT(*) as session_count
      FROM auth_sessions
      WHERE user_id = ${user_id}
        AND created_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
    ) daily_sessions
  `;

  const avgSessionCount = avgSessions?.avg_sessions || 1;
  const threshold = Math.max(5, avgSessionCount * 3); // 平均の3倍または最低5セッション

  let isAnomalous = false;
  let severity: SeverityLevel | null = null;
  let riskScore = 0;

  if (sessionCount > threshold) {
    isAnomalous = true;
    if (sessionCount > 15) {
      severity = "high";
      riskScore = 80;
    } else if (sessionCount > 10) {
      severity = "medium";
      riskScore = 60;
    } else {
      severity = "low";
      riskScore = 40;
    }
  }

  if (isAnomalous) {
    return {
      is_anomalous: true,
      anomaly_type: "concurrent_sessions",
      severity,
      risk_score: riskScore,
      details: {
        current_sessions: sessionCount,
        average_sessions: avgSessionCount,
        threshold: threshold,
        excess_sessions: sessionCount - threshold,
      },
      auto_block: false,
      explanation: `異常な同時セッション数: 現在${sessionCount}個（閾値: ${Math.round(threshold)}）`,
    };
  }

  return {
    is_anomalous: false,
    anomaly_type: null,
    severity: null,
    risk_score: sessionCount > 3 ? 20 : 0,
    details: { current_sessions: sessionCount, average_sessions: avgSessionCount },
    auto_block: false,
    explanation: "同時セッション数は正常範囲内です",
  };
}

// 6. デバイス固有の異常検出
async function detectDeviceAnomaly(
  user_id: string,
  device_id: string,
  user_agent: string | null
): Promise<AnomalyResult> {
  // デバイス情報を取得
  const device = await db.queryRow<{
    trust_score: number;
    successful_logins: number;
    failed_attempts: number;
    created_at: Date;
  }>`
    SELECT trust_score, successful_logins, failed_attempts, created_at
    FROM auth_user_devices
    WHERE device_id = ${device_id}
  `;

  if (!device) {
    return {
      is_anomalous: true,
      anomaly_type: "device_anomaly",
      severity: "medium",
      risk_score: 50,
      details: { reason: "Unknown device" },
      auto_block: false,
      explanation: "未知のデバイスからのアクセスです",
    };
  }

  let isAnomalous = false;
  let severity: SeverityLevel | null = null;
  let riskScore = 100 - device.trust_score;

  // 信頼度スコアが低い
  if (device.trust_score < 30) {
    isAnomalous = true;
    severity = "high";
    riskScore = 80;
  } else if (device.trust_score < 50) {
    isAnomalous = true;
    severity = "medium";
    riskScore = 60;
  }

  // 失敗率が高い
  const totalAttempts = device.successful_logins + device.failed_attempts;
  const failureRate = totalAttempts > 0 ? (device.failed_attempts / totalAttempts) * 100 : 0;

  if (failureRate > 50 && totalAttempts > 5) {
    isAnomalous = true;
    severity = "high";
    riskScore = Math.max(riskScore, 75);
  }

  // 新しいデバイス（作成から24時間以内）
  const deviceAge = Date.now() - device.created_at.getTime();
  const isNewDevice = deviceAge < 24 * 60 * 60 * 1000;

  if (isNewDevice) {
    riskScore = Math.max(riskScore, 40);
    if (!isAnomalous) {
      isAnomalous = true;
      severity = "low";
    }
  }

  if (isAnomalous) {
    return {
      is_anomalous: true,
      anomaly_type: "device_anomaly",
      severity,
      risk_score: riskScore,
      details: {
        trust_score: device.trust_score,
        failure_rate: failureRate,
        total_attempts: totalAttempts,
        is_new_device: isNewDevice,
        device_age_hours: Math.round(deviceAge / (1000 * 60 * 60)),
      },
      auto_block: device.trust_score < 10,
      explanation: `デバイス信頼度が低い (${device.trust_score}/100)` +
                   (isNewDevice ? "、新しいデバイス" : "") +
                   (failureRate > 50 ? `、失敗率が高い (${failureRate.toFixed(1)}%)` : ""),
    };
  }

  return {
    is_anomalous: false,
    anomaly_type: null,
    severity: null,
    risk_score: Math.max(riskScore, 0),
    details: { trust_score: device.trust_score, failure_rate: failureRate },
    auto_block: false,
    explanation: "デバイスは正常です",
  };
}

// 異常をログに記録
async function logAnomaly(
  user_id: string,
  session_id: string | null,
  device_id: string | null,
  anomaly: AnomalyResult,
  context: {
    ip_address: string | null;
    user_agent: string | null;
    geo_location: GeoLocation;
  }
): Promise<void> {
  await db.exec`
    INSERT INTO auth_anomaly_logs (
      user_id, session_id, device_id, anomaly_type, severity, 
      risk_score, details, ip_address, geo_location, user_agent, auto_blocked
    ) VALUES (
      ${user_id}, ${session_id}, ${device_id}, ${anomaly.anomaly_type}, 
      ${anomaly.severity}, ${anomaly.risk_score}, ${JSON.stringify(anomaly.details)},
      ${context.ip_address}, ${JSON.stringify(context.geo_location)}, 
      ${context.user_agent}, ${anomaly.auto_block}
    )
  `;

  log.warn("Security anomaly detected", {
    user_id,
    session_id,
    device_id,
    anomaly_type: anomaly.anomaly_type,
    severity: anomaly.severity,
    risk_score: anomaly.risk_score,
    auto_block: anomaly.auto_block,
    explanation: anomaly.explanation,
    ip_address: context.ip_address,
    geo: {
      country: context.geo_location.country,
      city: context.geo_location.city,
    },
  });
}

// 異常検知を手動実行するAPI（テスト・デバッグ用）
export const detect_anomalies_manual = api<{
  user_id: string;
  session_id?: string;
  device_id?: string;
}, { anomalies: AnomalyResult[] }>({
  method: "POST",
  path: "/auth/internal/detect-anomalies",
  expose: false,
}, async ({ user_id, session_id, device_id }) => {
  // Create a mock RawRequest for this manual endpoint
  const mockReq = {
    body: Buffer.from(''),
    req: {} as any,
    _url: new URL('http://localhost/'),
    _headersDistinct: {},
    _method: 'POST',
    _path: '/auth/internal/detect-anomalies'
  } as unknown as RawRequest;
  
  const anomalies = await detectAnomalies(user_id, session_id || null, device_id || null, mockReq);
  return { anomalies };
});

// 過去の異常ログを取得
export const get_anomaly_history = api<{
  user_id?: string;
  severity?: SeverityLevel;
  limit?: number;
}, {
  anomalies: Array<{
    id: string;
    user_id: string;
    anomaly_type: string;
    severity: string;
    risk_score: number;
    detected_at: Date;
    auto_blocked: boolean;
    resolved: boolean;
    details: any;
  }>;
}>({
  method: "GET",
  path: "/auth/anomalies",
  auth: true,
}, async ({ user_id, severity, limit = 50 }) => {
  const authData = getAuthData();
  if (!authData) throw APIError.unauthenticated("authentication required");

  // 管理者以外は自分の異常ログのみ取得可能
  const targetUserId = user_id && authData.userID === user_id ? user_id : authData.userID;

  let anomalies: any;

  if (severity) {
    anomalies = await db.query`
      SELECT id, user_id, anomaly_type, severity, risk_score, 
             detected_at, auto_blocked, resolved, details
      FROM auth_anomaly_logs
      WHERE user_id = ${targetUserId} AND severity = ${severity}
      ORDER BY detected_at DESC 
      LIMIT ${limit}
    `;
  } else {
    anomalies = await db.query`
      SELECT id, user_id, anomaly_type, severity, risk_score, 
             detected_at, auto_blocked, resolved, details
      FROM auth_anomaly_logs
      WHERE user_id = ${targetUserId}
      ORDER BY detected_at DESC 
      LIMIT ${limit}
    `;
  }
  
  const result: any[] = [];
  for await (const anomaly of anomalies) {
    result.push(anomaly);
  }

  return { anomalies: result };
});;

/** 管理者用: 異常履歴取得（内部API） */
export const admin_get_anomaly_history = api<{
  user_id?: string;
  severity?: SeverityLevel;
  limit?: number;
}, {
  anomalies: Array<{
    id: string;
    user_id: string | null;
    anomaly_type: string;
    severity: string;
    risk_score: number;
    detected_at: Date;
    auto_blocked: boolean;
    resolved: boolean;
    details: any;
  }>;
}>({ method: "GET", path: "/auth/internal/admin/anomalies", expose: false, auth: true }, async ({ user_id, severity, limit = 100 }) => {
  let anomalies: any;
  if (user_id && severity) {
    anomalies = await db.query`
      SELECT id, user_id, anomaly_type, severity, risk_score, 
             detected_at, auto_blocked, resolved, details
      FROM auth_anomaly_logs
      WHERE user_id = ${user_id} AND severity = ${severity}
      ORDER BY detected_at DESC 
      LIMIT ${limit}
    `;
  } else if (user_id) {
    anomalies = await db.query`
      SELECT id, user_id, anomaly_type, severity, risk_score, 
             detected_at, auto_blocked, resolved, details
      FROM auth_anomaly_logs
      WHERE user_id = ${user_id}
      ORDER BY detected_at DESC 
      LIMIT ${limit}
    `;
  } else if (severity) {
    anomalies = await db.query`
      SELECT id, user_id, anomaly_type, severity, risk_score, 
             detected_at, auto_blocked, resolved, details
      FROM auth_anomaly_logs
      WHERE severity = ${severity}
      ORDER BY detected_at DESC 
      LIMIT ${limit}
    `;
  } else {
    anomalies = await db.query`
      SELECT id, user_id, anomaly_type, severity, risk_score, 
             detected_at, auto_blocked, resolved, details
      FROM auth_anomaly_logs
      ORDER BY detected_at DESC 
      LIMIT ${limit}
    `;
  }

  const result: any[] = [];
  for await (const anomaly of anomalies) {
    result.push(anomaly);
  }
  return { anomalies: result };
});

// 異常を解決済みにマーク
export const resolve_anomaly = api<{
  anomaly_id: string;
  resolution_notes?: string;
}, { success: boolean }>({
  method: "POST",
  path: "/auth/anomalies/:anomaly_id/resolve",
  auth: true,
}, async ({ anomaly_id, resolution_notes }) => {
  const authData = getAuthData();
  if (!authData) throw APIError.unauthenticated("authentication required");

  // 異常ログが存在し、ユーザーが所有者かチェック
  const anomaly = await db.queryRow<{ user_id: string }>`
    SELECT user_id FROM auth_anomaly_logs 
    WHERE id = ${anomaly_id}
  `;

  if (!anomaly) {
    throw APIError.notFound("Anomaly not found");
  }

  if (anomaly.user_id !== authData.userID) {
    throw APIError.permissionDenied("Cannot resolve other user's anomaly");
  }

  await db.exec`
    UPDATE auth_anomaly_logs
    SET resolved = true,
        resolved_at = NOW(),
        resolved_by = ${authData.userID},
        resolution_notes = ${resolution_notes || ""}
    WHERE id = ${anomaly_id}
  `;

  return { success: true };
});
