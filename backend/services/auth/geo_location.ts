/*
 * Geo Location & IP Reputation Utilities
 *
 * 概要:
 * - IPからの地理情報推定（本番は外部API想定、現状はモック/サンプル）
 * - 速度/距離ベースの移動妥当性判定（isPossibleTravel）
 * - リクエストからのIP/UA抽出（extractRequestInfo）
 * - IPレピュテーションDBの更新API（内部）
 *
 * 注意点:
 * - getGeoLocationFromIP はDB接続エラー時やプライベートIP/無効IPでフォールバック値（Tokyo, JP）を返します。
 *   セキュリティ監視上の誤検知を避けるための緩和策です。
 * - `databaseError` フラグは現状未使用ですが、DB健全性チェックの意図が見て取れます。
 */
import { api, APIError } from "encore.dev/api";
import log from "encore.dev/log";
import { db } from "./database";

// 地理情報の型定義
export interface GeoLocation {
  country: string | null;
  country_code: string | null;
  city: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  is_vpn: boolean;
  is_proxy: boolean;
  is_tor: boolean;
  is_datacenter: boolean;
  risk_level: "safe" | "suspicious" | "malicious";
}

// IPアドレスから地理情報を取得（モック実装）
// 本番環境では MaxMind GeoIP2 や ipapi.co などの外部APIを使用
export async function getGeoLocationFromIP(ip: string): Promise<GeoLocation> {
  // 開発環境用のモックデータ
  if (!ip || ip === "::1" || ip === "127.0.0.1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
    return {
      country: "Japan",
      country_code: "JP",
      city: "Tokyo",
      region: "Tokyo",
      latitude: 35.6762,
      longitude: 139.6503,
      timezone: "Asia/Tokyo",
      is_vpn: false,
      is_proxy: false,
      is_tor: false,
      is_datacenter: false,
      risk_level: "safe",
    };
  }

  // データベースエラーをキャッチするためのフラグ
  let databaseError = false;
  
  // データベース接続テスト（テスト環境のモック対応）
  try {
    await db.exec`SELECT 1`; // テスト用のクエリで接続をチェック
  } catch (error) {
    console.warn("Database connection failed:", error);
    return {
      country: "Japan",
      country_code: "JP",
      city: "Tokyo",
      region: "Tokyo",
      latitude: 35.6762,
      longitude: 139.6503,
      timezone: "Asia/Tokyo",
      is_vpn: false,
      is_proxy: false,
      is_tor: false,
      is_datacenter: false,
      risk_level: "safe",
    };
  }
  
  // IPレピュテーションデータベースをチェック
  try {
    const reputation = await db.queryRow<{ risk_level: string; threat_types: any; risk_score: number }>`
      SELECT risk_level, threat_types, risk_score
      FROM auth_ip_reputation 
      WHERE ip_address = ${ip}
    `;

    if (reputation) {
      let threats: string[] = [];
      try {
        if (typeof reputation.threat_types === 'string') {
          threats = JSON.parse(reputation.threat_types);
        } else if (Array.isArray(reputation.threat_types)) {
          threats = reputation.threat_types;
        }
      } catch (error) {
        console.warn("Failed to parse threat_types:", error);
        threats = [];
      }
      
      return {
        country: "Japan", // デフォルト値を設定
        country_code: "JP",
        city: "Tokyo",
        region: "Tokyo",
        latitude: 35.6762,
        longitude: 139.6503,
        timezone: "Asia/Tokyo",
        is_vpn: threats.includes("vpn"),
        is_proxy: threats.includes("proxy"),
        is_tor: threats.includes("tor"),
        is_datacenter: threats.includes("datacenter"),
        risk_level: reputation.risk_level as any,
        reputation: {
          risk_score: reputation.risk_score || (reputation.risk_level === "malicious" ? 90 : 
                     reputation.risk_level === "suspicious" ? 50 : 10),
          threat_types: threats,
          risk_level: reputation.risk_level
        }
      } as any;
    }
  } catch (error) {
    // データベースエラーが発生した場合は日本のデフォルト値を返す
    console.warn("IP reputation lookup failed:", error);
    return {
      country: "Japan",
      country_code: "JP",
      city: "Tokyo",
      region: "Tokyo",
      latitude: 35.6762,
      longitude: 139.6503,
      timezone: "Asia/Tokyo",
      is_vpn: false,
      is_proxy: false,
      is_tor: false,
      is_datacenter: false,
      risk_level: "safe",
    };
  }

  // 実際の実装では外部APIを呼び出す
  // const response = await fetch(`https://ipapi.co/${ip}/json/`);
  // const data = await response.json();
  
  // デモ用のサンプルデータ
  const sampleLocations = [
    { country: "United States", country_code: "US", city: "New York", region: "New York", lat: 40.7128, lon: -74.0060, tz: "America/New_York" },
    { country: "United Kingdom", country_code: "GB", city: "London", region: "England", lat: 51.5074, lon: -0.1278, tz: "Europe/London" },
    { country: "Germany", country_code: "DE", city: "Berlin", region: "Berlin", lat: 52.5200, lon: 13.4050, tz: "Europe/Berlin" },
    { country: "France", country_code: "FR", city: "Paris", region: "Île-de-France", lat: 48.8566, lon: 2.3522, tz: "Europe/Paris" },
    { country: "Australia", country_code: "AU", city: "Sydney", region: "New South Wales", lat: -33.8688, lon: 151.2093, tz: "Australia/Sydney" },
  ];

  // エラーハンドリング：不正なIPアドレスの場合はデフォルト値を返す
  if (!ip || ip === "" || !isValidIP(ip)) {
    return {
      country: "Japan",
      country_code: "JP",
      city: "Tokyo",
      region: "Tokyo",
      latitude: 35.6762,
      longitude: 139.6503,
      timezone: "Asia/Tokyo",
      is_vpn: false,
      is_proxy: false,
      is_tor: false,
      is_datacenter: false,
      risk_level: "safe",
    };
  }

  // プライベートIPアドレスの場合もデフォルト値を返す
  if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    return {
      country: "Japan",
      country_code: "JP",
      city: "Tokyo",
      region: "Tokyo",
      latitude: 35.6762,
      longitude: 139.6503,
      timezone: "Asia/Tokyo",
      is_vpn: false,
      is_proxy: false,
      is_tor: false,
      is_datacenter: false,
      risk_level: "safe",
    };
  }

  // IPアドレスからハッシュ値を生成してランダムに選択
  const hash = ip.split('.').reduce((acc, octet) => acc + parseInt(octet || "0"), 0);
  const location = sampleLocations[hash % sampleLocations.length];

  return {
    country: location.country,
    country_code: location.country_code,
    city: location.city,
    region: location.region,
    latitude: location.lat,
    longitude: location.lon,
    timezone: location.tz,
    is_vpn: false,
    is_proxy: false,
    is_tor: false,
    is_datacenter: false,
    risk_level: "safe",
  };
}

// 2つの地点間の距離を計算（km）
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // 地球の半径（km）
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// IPアドレスの妥当性をチェックする関数
function isValidIP(ip: string): boolean {
  const ipv4Regex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (!ipv4Regex.test(ip)) {
    return false;
  }
  
  // 各オクテットが0-255の範囲内かチェック
  const octets = ip.split('.');
  for (const octet of octets) {
    const num = parseInt(octet, 10);
    if (num < 0 || num > 255) {
      return false;
    }
  }
  
  return true;
}

// 移動可能かチェック（時間と距離から）
export function isPossibleTravel(
  distance: number, // km
  timeDiff: number  // 分
): boolean {
  // 負の値は不正な入力として不可能と判定
  if (distance < 0 || timeDiff < 0) {
    return false;
  }
  
  // セキュリティ監視のための移動速度制限（緩和版）
  // 主目的：瞬間移動や物理的に不可能な移動の検出
  // 正当な高速移動（新幹線、飛行機、将来の交通手段）は許可
  
  const timeInHours = timeDiff / 60;
  let maxSpeed;
  
  // 距離ベースの速度制限（現実的な移動速度）
  if (distance < 500) {
    maxSpeed = 500; // 短距離: 500km/h (新幹線・国内線を考慮)
  } else if (distance >= 500 && distance < 2000) {
    maxSpeed = 1000; // 中距離: 1000km/h (旅客機の最高速度)
  } else {
    maxSpeed = 1000; // 長距離: 1000km/h (超音速旅客機は一般的でない)
  }
  
  const maxPossibleDistance = timeInHours * maxSpeed;
  return distance <= maxPossibleDistance;
}

/**
 * リクエストからIPアドレス/ユーザーエージェントを安全に抽出するヘルパー。
 *
 * 優先順位:
 * - IP: `X-Forwarded-For` 先頭 → `X-Real-IP` → `X-Client-IP` → `socket.remoteAddress`
 * - UA: `User-Agent` → `X-Client-User-Agent`
 *
 * Encore RawRequest の内部表現差異（`req.req.headers` / `_headersDistinct` / `header(name)`）に対応し、
 * 配列/文字列の揺れを吸収します。欠損時は null を返します。
 */
export function extractRequestInfo(req: any): {
  ip_address: string | null;
  user_agent: string | null;
} {
  // Encore RawRequest の場合は req.req が Node.js の IncomingMessage
  const nodeReq = req?.req ?? req;

  // 可能な限りヘッダーを取得（RawRequestの内部表現/_headersDistinctにも対応）
  const rawHeaders: any = nodeReq?.headers ?? req?._headersDistinct ?? {};

  // header(name) 関数があれば補助的に利用
  const headerFn = typeof req?.header === 'function' ? (n: string) => req.header(n) : undefined;

  // 正規化: 小文字キーで参照
  const headers: Record<string, any> = {};
  for (const k of Object.keys(rawHeaders)) {
    headers[k.toLowerCase()] = rawHeaders[k];
  }

  const getHeader = (name: string): string | undefined => {
    const v = headers[name.toLowerCase()];
    if (Array.isArray(v)) return v[0];
    if (typeof v === 'string') return v;
    const hv = headerFn?.(name);
    return typeof hv === 'string' ? hv : undefined;
  };

  // IPアドレスの取得（優先順）
  // 1) X-Forwarded-For 先頭
  // 2) RFC 7239 Forwarded: for=...
  // 3) Cloudflare/Akamai 等の専用ヘッダ
  // 4) X-Real-IP / X-Client-IP
  // 5) ソケットの remoteAddress
  const xff = getHeader('x-forwarded-for');
  let ip_address: string | null | undefined = xff ? xff.split(',')[0]?.trim() : undefined;
  if (!ip_address) {
    const fwd = getHeader('forwarded'); // e.g., for="203.0.113.60";proto=https;by=...
    if (fwd) {
      const m = /for=\"?\[?([A-Za-z0-9:\.]+)\]?\"?/i.exec(fwd);
      if (m && m[1]) ip_address = m[1];
    }
  }
  if (!ip_address) ip_address = getHeader('cf-connecting-ip');
  if (!ip_address) ip_address = getHeader('true-client-ip');
  if (!ip_address) ip_address = getHeader('x-real-ip');
  if (!ip_address) ip_address = getHeader('x-client-ip');
  if (!ip_address) ip_address = nodeReq?.socket?.remoteAddress;
  if (!ip_address) ip_address = nodeReq?.connection?.remoteAddress;
  ip_address = ip_address || null;

  // User-Agent
  const user_agent = getHeader('user-agent') || getHeader('x-client-user-agent') || null;

  // デバッグ用: 取得状況を最小限記録（本番はDEBUGでのみ表示）
  try {
    const headerKeys = Object.keys(rawHeaders || {}).slice(0, 20);
    log.debug("extractRequestInfo: header snapshot", {
      hasReq: !!req,
      hasNodeReq: !!nodeReq,
      hasHeaders: !!nodeReq?.headers || !!req?._headersDistinct,
      hasHeaderFn: typeof req?.header === 'function',
      headerKeys,
      ip_address_preview: ip_address,
      user_agent_preview: user_agent ? user_agent.slice(0, 40) : null,
    });
  } catch {}

  return { ip_address, user_agent };
}

// IPレピュテーションを更新
export const update_ip_reputation = api<{
  ip_address: string;
  risk_level: "safe" | "suspicious" | "malicious" | "blocked";
  threat_types?: string[];
  reason?: string;
}, { success: boolean }>(
  { method: "POST", path: "/auth/internal/ip-reputation", expose: false },
  async ({ ip_address, risk_level, threat_types = [], reason }) => {
    const riskScoreMap = {
      safe: 0,
      suspicious: 50,
      malicious: 80,
      blocked: 100,
    };

    const existing = await db.queryRow<{ reports_count: number }>`
      SELECT reports_count FROM auth_ip_reputation WHERE ip_address = ${ip_address}
    `;

    if (existing) {
      await db.exec`
        UPDATE auth_ip_reputation
        SET risk_level = ${risk_level},
            risk_score = ${riskScoreMap[risk_level]},
            threat_types = ${JSON.stringify(threat_types)},
            reports_count = reports_count + 1,
            last_seen = NOW(),
            updated_at = NOW()
        WHERE ip_address = ${ip_address}
      `;
    } else {
      // 地理情報を取得
      const geo = await getGeoLocationFromIP(ip_address);
      
      await db.exec`
        INSERT INTO auth_ip_reputation (
          ip_address, risk_level, risk_score, threat_types, 
          country, reports_count
        ) VALUES (
          ${ip_address}, ${risk_level}, ${riskScoreMap[risk_level]}, 
          ${JSON.stringify(threat_types)}, ${geo.country}, 1
        )
      `;
    }

    log.warn("IP reputation updated", {
      ip_address,
      risk_level,
      threat_types,
      reason,
    });

    return { success: true };
  }
);

/**
 * 地理情報ベースの簡易リスクスコア計算（0〜100）。
 *
 * スコアリング要素（加点式）:
 * - VPN/Proxy/Tor/DataCenter: +20/+30/+50/+15
 * - IPレピュテーション: suspicious +30 / malicious +70
 * - 新しい国/都市からのアクセス: +25 / +10（過去履歴 `userHistory` と比較）
 *
 * 目的: 異常検知の前段でおおまかな地理的リスクを見積もる。
 * 注意: 実運用ではしきい値や重みはドメインに応じて調整が必要。
 */
export function calculateGeoRiskScore(geo: GeoLocation, userHistory: any[]): number {
  let score = 0;

  // VPN/Proxy/Tor使用
  if (geo.is_vpn) score += 20;
  if (geo.is_proxy) score += 30;
  if (geo.is_tor) score += 50;
  if (geo.is_datacenter) score += 15;

  // リスクレベル
  if (geo.risk_level === "suspicious") score += 30;
  if (geo.risk_level === "malicious") score += 70;

  // 新しい国からのアクセス
  const knownCountries = userHistory
    .map(h => h.geo_country)
    .filter(c => c);
  
  if (geo.country && !knownCountries.includes(geo.country)) {
    score += 25; // 新しい国
  }

  // 新しい都市からのアクセス
  const knownCities = userHistory
    .map(h => h.geo_city)
    .filter(c => c);
  
  if (geo.city && !knownCities.includes(geo.city)) {
    score += 10; // 新しい都市
  }

  return Math.min(score, 100); // 最大100
}
