/*
 * Trust Scoring (Device/User Behavior)
 *
 * 概要:
 * - デバイスごとの信頼度スコア（0-100）を簡易計算し、異常検知と連携します。
 * - ログイン成功/失敗や異常検出イベントに応じて、`auth_user_devices` を更新します。
 * - ユーザーの時間/地理パターンを簡易学習し、逸脱度の算出に利用します。
 *
 * 注意:
 * - 現状 `geo_consistency` / `time_consistency` は固定値（TODO）。将来は実測から算出。
 */
import { api, APIError } from "encore.dev/api";
import log from "encore.dev/log";
import { db } from "./database";
import { getAuthData } from "~encore/auth";

// 信頼度計算の要素
interface TrustFactors {
  device_age_days: number;        // デバイスの使用期間
  successful_logins: number;      // 成功したログイン回数
  failed_attempts: number;        // 失敗した試行回数
  geo_consistency: number;        // 地理的一貫性（0-100）
  time_consistency: number;       // 時間帯の一貫性（0-100）
  anomaly_count: number;          // 検出された異常の数
  last_anomaly_days_ago: number | null; // 最後の異常からの日数
}

/**
 * デバイス信頼度スコアを算出（0〜100）。
 *
 * 概要:
 * - 使用期間・成功/失敗回数・地理/時間一貫性・異常履歴からヒューリスティックに計算。
 * - 70点以上を概ね「信頼済み」の目安として利用（UI/ポリシーで調整可）。
 *
 * 入力: TrustFactors
 * 戻り: 0〜100 の整数（範囲外はクリップ）
 */
export function calculateDeviceTrustScore(factors: TrustFactors): number {
  let score = 50; // 基本スコア

  // デバイスの使用期間（最大+20点）
  if (factors.device_age_days > 0) {
    score += Math.min(factors.device_age_days / 10, 20);
  }

  // 成功したログイン（最大+30点）
  if (factors.successful_logins > 0) {
    score += Math.min(factors.successful_logins * 2, 30);
  }

  // 失敗した試行（マイナス点）
  score -= factors.failed_attempts * 5;

  // 地理的一貫性（最大+15点）
  score += (factors.geo_consistency / 100) * 15;

  // 時間帯の一貫性（最大+10点）
  score += (factors.time_consistency / 100) * 10;

  // 異常検出履歴（マイナス点）
  score -= factors.anomaly_count * 10;

  // 最近異常がない場合はボーナス
  if (factors.last_anomaly_days_ago !== null && factors.last_anomaly_days_ago > 30) {
    score += 10;
  }

  // スコアを0-100の範囲に正規化
  return Math.max(0, Math.min(100, Math.round(score)));
}

// デバイスの信頼度を更新
export const update_device_trust = api<{
  device_id: string;
  event_type: "login_success" | "login_failure" | "anomaly_detected" | "anomaly_resolved";
  metadata?: any;
}, { trust_score: number }>(
  { method: "POST", path: "/auth/internal/device-trust", expose: false },
  async ({ device_id, event_type, metadata }) => {
    // 現在のデバイス情報を取得
    const device = await db.queryRow<{
      user_id: string;
      successful_logins: number;
      failed_attempts: number;
      created_at: Date;
      geo_locations: any;
      usual_time_pattern: any;
    }>`
      SELECT user_id, successful_logins, failed_attempts, created_at,
             geo_locations, usual_time_pattern
      FROM auth_user_devices
      WHERE device_id = ${device_id}
    `;

    if (!device) {
      throw APIError.notFound("Device not found");
    }

    // イベントに応じて更新
    switch (event_type) {
      case "login_success":
        await db.exec`
          UPDATE auth_user_devices
          SET successful_logins = successful_logins + 1,
              last_seen_at = NOW()
          WHERE device_id = ${device_id}
        `;
        break;
      case "login_failure":
        await db.exec`
          UPDATE auth_user_devices
          SET failed_attempts = failed_attempts + 1
          WHERE device_id = ${device_id}
        `;
        break;
      case "anomaly_detected":
        const riskEvents = await db.queryRow<{ risk_events: any[] }>`
          SELECT risk_events FROM auth_user_devices WHERE device_id = ${device_id}
        `;
        let events: any[] = [];
        try {
          events = Array.isArray(riskEvents?.risk_events) 
            ? riskEvents.risk_events 
            : JSON.parse(riskEvents?.risk_events || '[]');
        } catch (error) {
          console.warn("Failed to parse risk_events:", error);
          events = [];
        }
        events.push({
          type: metadata?.type || "unknown",
          timestamp: new Date(),
          details: metadata,
        });
        await db.exec`
          UPDATE auth_user_devices
          SET risk_events = ${JSON.stringify(events)}
          WHERE device_id = ${device_id}
        `;
        break;
    }

    // 最新の情報で信頼度スコアを再計算
    const updatedDevice = await db.queryRow<{
      successful_logins: number;
      failed_attempts: number;
      created_at: Date;
      risk_events: any[];
    }>`
      SELECT successful_logins, failed_attempts, created_at, risk_events
      FROM auth_user_devices
      WHERE device_id = ${device_id}
    `;

    if (!updatedDevice) {
      throw APIError.internal("Failed to update device");
    }

    // 異常検出の統計
    const anomalies = await db.queryRow<{
      anomaly_count: number;
      last_anomaly: Date | null;
    }>`
      SELECT COUNT(*) as anomaly_count,
             MAX(detected_at) as last_anomaly
      FROM auth_anomaly_logs
      WHERE device_id = ${device_id}
    `;

    const deviceAgeDays = Math.floor(
      (Date.now() - new Date(updatedDevice.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    const lastAnomalyDaysAgo = anomalies?.last_anomaly
      ? Math.floor((Date.now() - new Date(anomalies.last_anomaly).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const factors: TrustFactors = {
      device_age_days: deviceAgeDays,
      successful_logins: updatedDevice.successful_logins,
      failed_attempts: updatedDevice.failed_attempts,
      geo_consistency: 80, // TODO: 実際の地理的一貫性を計算
      time_consistency: 70, // TODO: 実際の時間帯一貫性を計算
      anomaly_count: anomalies?.anomaly_count || 0,
      last_anomaly_days_ago: lastAnomalyDaysAgo,
    };

    const trustScore = calculateDeviceTrustScore(factors);

    // 信頼度スコアを更新
    await db.exec`
      UPDATE auth_user_devices
      SET trust_score = ${trustScore}
      WHERE device_id = ${device_id}
    `;

    log.info("Device trust score updated", {
      device_id,
      event_type,
      trust_score: trustScore,
      factors,
    });

    return { trust_score: trustScore };
  }
);

// 信頼済みデバイスの取得
export const get_trusted_devices = api(
  { 
    method: "GET", 
    path: "/auth/devices/trusted",
    auth: true 
  },
  async (): Promise<{
    devices: Array<{
      device_id: string;
      device_name: string;
      trust_score: number;
      last_seen_at: Date;
      successful_logins: number;
      is_trusted: boolean;
    }>;
  }> => {
    const authData = getAuthData();
    if (!authData) throw APIError.unauthenticated("Not authenticated");

    const devices = await db.query<{
      device_id: string;
      device_name: string;
      trust_score: number;
      last_seen_at: Date;
      successful_logins: number;
    }>`
      SELECT device_id, device_name, trust_score, last_seen_at, successful_logins
      FROM auth_user_devices
      WHERE user_id = ${authData.userID}
        AND trust_score >= 60
      ORDER BY trust_score DESC, last_seen_at DESC
    `;

    const result: any[] = [];
    for await (const device of devices) {
      result.push({
        ...device,
        is_trusted: device.trust_score >= 70,
      });
    }

    return { devices: result };
  }
);

/**
 * 管理者用: デバイスのtrust設定を直接更新（内部API）
 * - dev_toolsからの利用を想定
 */
export const admin_set_device_trust = api<{
  device_id: string;
  trusted: boolean;
  trust_score?: number;
}, { success: boolean }>(
  { method: "POST", path: "/auth/internal/admin/device-trust", expose: false, auth: true },
  async ({ device_id, trusted, trust_score }) => {
    await db.exec`
      UPDATE auth_user_devices
      SET trusted = ${trusted}, trust_score = ${trust_score ?? 0}, last_seen_at = NOW()
      WHERE device_id = ${device_id}
    `;
    return { success: true };
  }
);

/**
 * ユーザーの通常パターン（時間帯/曜日・地理）を簡易学習し、auth_user_devicesに保存。
 *
 * 詳細:
 * - `usual_time_pattern` は `h{0..23}` / `d{0..6}` カウントを持つJSON。
 * - `geo_locations` は {country, city, count} の配列とし、既存要素があれば加算。
 * - 1ユーザー複数デバイスのうち、代表行（先頭1件）を更新する簡易実装。
 */
export async function learnUserPattern(
  user_id: string,
  hour: number,
  day_of_week: number,
  geo_country: string | null,
  geo_city: string | null
): Promise<void> {
  // 既存のパターンを取得
  const patterns = await db.queryRow<{ time_patterns: any; geo_patterns: any }>`
    SELECT 
      COALESCE(
        (SELECT usual_time_pattern FROM auth_user_devices 
         WHERE user_id = ${user_id} 
         LIMIT 1),
        '{}'::jsonb
      ) as time_patterns,
      COALESCE(
        (SELECT geo_locations FROM auth_user_devices 
         WHERE user_id = ${user_id} 
         LIMIT 1),
        '[]'::jsonb
      ) as geo_patterns
  `;

  // 時間パターンを更新
  let timePatterns: any = {};
  try {
    // JSONBデータが文字列の場合はパースする
    if (typeof patterns?.time_patterns === 'string') {
      timePatterns = JSON.parse(patterns.time_patterns);
    } else if (typeof patterns?.time_patterns === 'object' && patterns?.time_patterns !== null) {
      timePatterns = patterns.time_patterns;
    }
  } catch (error) {
    console.warn("Failed to parse time patterns:", error);
    timePatterns = {};
  }

  const hourKey = `h${hour}`;
  const dayKey = `d${day_of_week}`;
  
  timePatterns[hourKey] = (timePatterns[hourKey] || 0) + 1;
  timePatterns[dayKey] = (timePatterns[dayKey] || 0) + 1;

  // 地理パターンを更新
  const rawGeoPatterns = patterns?.geo_patterns;
  let geoPatterns: any[] = [];
  
  // JSONBデータが配列かどうかを確認
  if (Array.isArray(rawGeoPatterns)) {
    geoPatterns = rawGeoPatterns;
  } else if (rawGeoPatterns && typeof rawGeoPatterns === 'object') {
    // オブジェクト形式の場合は配列に変換
    geoPatterns = Object.values(rawGeoPatterns);
  }
  
  const geoEntry = { country: geo_country, city: geo_city, count: 1 };
  
  const existingGeo = geoPatterns.find(
    (g: any) => g && g.country === geo_country && g.city === geo_city
  );
  
  if (existingGeo) {
    existingGeo.count++;
  } else {
    geoPatterns.push(geoEntry);
  }

  // パターンを保存
  await db.exec`
    UPDATE auth_user_devices
    SET usual_time_pattern = ${JSON.stringify(timePatterns)},
        geo_locations = ${JSON.stringify(geoPatterns)}
    WHERE user_id = ${user_id}
  `;
}

/**
 * パターンからの逸脱度を計算（0〜100、高いほど異常）。
 *
 * 算出方針:
 * - 時間帯/曜日ごとの出現頻度を基準化し、低頻度ほど逸脱度を加算。
 * - 地理（国/都市）の既知性を参照し、新規値なら加点。
 * - 現状は単純合成。将来は移動速度・デバイス指紋等も加味可能。
 */
export async function calculatePatternDeviation(
  user_id: string,
  hour: number,
  day_of_week: number,
  geo_country: string | null,
  geo_city: string | null
): Promise<number> {
  const patterns = await db.queryRow<{ time_patterns: any; geo_patterns: any }>`
    SELECT 
      COALESCE(
        (SELECT usual_time_pattern FROM auth_user_devices 
         WHERE user_id = ${user_id} 
         LIMIT 1),
        '{}'::jsonb
      ) as time_patterns,
      COALESCE(
        (SELECT geo_locations FROM auth_user_devices 
         WHERE user_id = ${user_id} 
         LIMIT 1),
        '[]'::jsonb
      ) as geo_patterns
  `;

  let deviation = 0;

  // 時間パターンのチェック
  const timePatterns = patterns?.time_patterns || {};
  const hourKey = `h${hour}`;
  const dayKey = `d${day_of_week}`;
  
  const hourFreq = timePatterns[hourKey] || 0;
  const dayFreq = timePatterns[dayKey] || 0;
  
  // 頻度が低い時間帯/曜日の場合、逸脱度を上げる
  const totalHourAccess = Object.values(timePatterns)
    .filter((_, k) => k.toString().startsWith('h'))
    .reduce((sum: number, val: any) => sum + val, 0) as number;
  
  if (totalHourAccess > 0) {
    const hourRatio = hourFreq / totalHourAccess;
    if (hourRatio < 0.05) deviation += 30; // 5%未満の頻度
  }

  // 深夜アクセス（2-5時）は自動的に逸脱度を上げる
  if (hour >= 2 && hour <= 5) {
    deviation += 25; // より高い逸脱度を設定
  }

  // 地理パターンのチェック
  const rawGeoPatterns = patterns?.geo_patterns;
  let geoPatterns: any[] = [];
  
  // JSONBデータが配列かどうかを確認
  if (Array.isArray(rawGeoPatterns)) {
    geoPatterns = rawGeoPatterns;
  } else if (rawGeoPatterns && typeof rawGeoPatterns === 'object') {
    // オブジェクト形式の場合は配列に変換
    geoPatterns = Object.values(rawGeoPatterns);
  }
  
  const knownLocation = geoPatterns.find(
    (g: any) => g && g.country === geo_country && g.city === geo_city
  );
  
  if (!knownLocation && geoPatterns.length > 0) {
    deviation += 40; // 未知の場所
  }

  return Math.min(deviation, 100);
}
