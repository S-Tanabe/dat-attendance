/*
 * Auth Core APIs
 *
 * 提供API（expose: true）:
 * - POST /auth/login    : 認証 + アクセス/リフレッシュトークン発行、セッション作成
 * - POST /auth/refresh  : リフレッシュトークンのローテーション、旧セッション失効→新規作成
 * - POST /auth/logout   : リフレッシュトークン失効（auth必須）
 * - GET  /auth/me       : 自分のユーザー基本情報（auth必須）
 *
 * 内部API（expose: false）:
 * - ユーザーCRUD補助や検証、メール/ステータス更新、セッション/ユーザーの一括操作 等
 *
 * セキュリティ/設計ノート:
 * - パスワードは scrypt(N=16384,r=8,p=1, 64byte) でハッシュ化。保存形式は
 *   `scrypt$N$r$p$<salt>$<hex>` でパラメータも保持。verifyは timingSafeEqual。
 * - アクセストークンはHS256、15分で失効。`sub=userId`, payloadに`email`のみ。
 * - リフレッシュトークンは生値(base64url)を応答、DBにはSHA-256(HEX)のみ保存。
 * - セッションはファミリーIDでグルーピングし、盗用検知時はファミリー横断で失効。
 * - 同時アクティブセッション上限=5（最古を自動失効）。
 *
 * 既知のギャップ（非破壊でTODO化）:
 * - 異常検知 detectAnomalies() は login/refresh から未呼出（RawRequest非取得のため）。
 *   → 将来: EncoreのRawRequestに対応したAPIに変更してIP/UAを解析、検知・ブロック/通知を実装。
 * - IP/UA は現在 null ログで保存。地理情報/監査の精度向上にはリクエスト情報の受け渡しが必要。
 */
import { api, APIError, RawRequest } from "encore.dev/api";
import log from "encore.dev/log";
import { db } from "./database";
import { getAuthData } from "~encore/auth";
import { randomBytes, randomUUID, scrypt as _scrypt, timingSafeEqual, createHash, scryptSync } from "node:crypto";
import { secret } from "encore.dev/config";
import { SignJWT, jwtVerify } from "jose";
import { detectAnomalies } from "./anomaly_detection";
import { recordActivity, notifyAnomalyDetected } from "./realtime_monitoring";
import { getGeoLocationFromIP, extractRequestInfo } from "./geo_location";
import { evaluateClientIpTrust } from "./iptrust/evaluate";
import { getEffectiveTrustConfig } from "./iptrust/settings";
import { learnUserPattern } from "./trust_scoring";

/**
 * scryptラッパー: パスワード派生関数をPromise化。
 * - N, r, p は計算コスト（OWASPの現行推奨レンジ内）。
 * - 64byteキーを導出。
 */
const scrypt = (pwd: string, salt: string, N = 16384, r = 8, p = 1) =>
  new Promise<Buffer>((resolve, reject) => {
    _scrypt(pwd, salt, 64, { N, r, p }, (e, k) => (e ? reject(e) : resolve(k)));
  });

const JWT_SECRET = secret("JWT_SECRET");

/**
 * パスワードハッシュ生成。
 * - 16byteソルト + scrypt で64byte導出。
 * - 格納形式: `scrypt$N$r$p$<salt>$<derived-hex>`。
 * - 備考: salt自体は戻り値に含めるが、実運用では `hash` に埋め込まれているため別保存は不要。
 */
function hashPassword(password: string): { salt: string; hash: string } {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return { salt, hash: `scrypt$16384$8$1$${salt}$${key.toString("hex")}` };
}

/**
 * パスワード照合。
 * - 格納フォーマットを分解し再計算、timingSafeEqualで比較。
 * - フォーマット不一致（非scrypt）の場合は即false。
 */
async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, N, r, p, salt, hex] = stored.split("$");
  if (algo !== "scrypt") return false;
  const key = await scrypt(password, salt, parseInt(N), parseInt(r), parseInt(p));
  const buf = Buffer.from(hex, "hex");
  return buf.length === key.length && timingSafeEqual(buf, key);
}

/**
 * アクセストークン（JWT）生成。
 * - HS256, exp=15分。
 * - subject=sub(userId), payloadにemailのみ（ロール等は別取得）。
 */
const AUTH_ACCESS_TTL_MINUTES = secret("AUTH_ACCESS_TTL_MINUTES");
const AUTH_REFRESH_TTL_DAYS = secret("AUTH_REFRESH_TTL_DAYS");

function getAccessTtlMinutes(): number {
  try { const v = AUTH_ACCESS_TTL_MINUTES(); return v ? parseInt(String(v)) : 15; } catch { return 15; }
}
function getRefreshTtlDays(): number {
  try { const v = AUTH_REFRESH_TTL_DAYS(); return v ? parseInt(String(v)) : 30; } catch { return 30; }
}

async function createAccessToken(userId: string, email: string) {
  const secretValue = JWT_SECRET();
  if (!secretValue) {
    throw new Error("JWT secret is not configured. Please set the 'JWT_SECRET' secret.");
  }
  const key = new TextEncoder().encode(secretValue);
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60 * getAccessTtlMinutes();
  const token = await new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(key);
  return { token, exp };
}

/**
 * リフレッシュトークン生成。
 * - 応答: `raw`（クライアント保存）。DB: `hash`（SHA-256）。
 * - ローテーション時は旧セッションを `revoked_at` で失効し新規作成。
 */
function newRefreshToken() {
  const raw = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

/** ---------------- API 定義 ------------------*/
interface LoginParams {
  email: string;
  password: string;
  device_name?: string;
  device_fingerprint?: string;
  remember_device?: boolean;
  // フロントから明示的にIP/UAを渡すための任意フィールド（開発・デバッグ用）
  client_ip?: string;
  client_user_agent?: string;
  client_ua_brands?: Array<{ brand: string; version?: string }>;
}
interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  token_type: "Bearer";
}

/**
 * ユーザーエージェントから端末/OSとブラウザを簡易推定して表示名を生成
 * 例: "Windows / Chrome 139" , "iPhone / Safari 17" , "macOS / Edge 126"
 * 外部ライブラリは使わず、主要パターンのみを軽量にカバー
 */
function parseDeviceName(ua: string | null | undefined, brands?: Array<{ brand: string; version?: string }>): string {
  if (!ua) return "";
  const u = ua;

  // OS / Device
  let os = "";
  if (/iPhone/i.test(u)) os = "iPhone";
  else if (/iPad/i.test(u)) os = "iPad";
  else if (/Android/i.test(u)) os = "Android";
  else if (/Windows NT/i.test(u)) os = "Windows";
  else if (/Mac OS X|Macintosh/i.test(u)) os = "macOS";
  else if (/Linux/i.test(u)) os = "Linux";

  // Browser brand（Client Hints優先）
  let browser = "";
  if (brands && brands.length) {
    const prefer = ['Microsoft Edge','Brave','Opera','Vivaldi','Yandex','Samsung Internet','Google Chrome','Chromium'];
    const pick = prefer.find(p => brands.some(b => b.brand === p));
    if (pick) {
      const v = brands.find(b => b.brand === pick)?.version;
      browser = v ? `${pick} ${String(v).split('.')[0]}` : pick;
    } else {
      const b0 = brands[0];
      if (b0) browser = b0.version ? `${b0.brand} ${String(b0.version).split('.')[0]}` : b0.brand;
    }
  }
  // UAフォールバック
  if (!browser) {
    const m = (re: RegExp) => {
      const x = re.exec(u);
      return x && x[1] ? x[1] : "";
    };
    if (/Edg\//.test(u)) browser = `Microsoft Edge ${m(/Edg\/(\d+)/)}`;
    else if (/OPR\//.test(u)) browser = `Opera ${m(/OPR\/(\d+)/)}`;
    else if (/Vivaldi\//.test(u)) browser = `Vivaldi ${m(/Vivaldi\/(\d+)/)}`;
    else if (/SamsungBrowser\//.test(u)) browser = `Samsung Internet ${m(/SamsungBrowser\/(\d+)/)}`;
    else if (/Chrome\//.test(u)) browser = `Google Chrome ${m(/Chrome\/(\d+)/)}`;
    else if (/Firefox\//.test(u)) browser = `Firefox ${m(/Firefox\/(\d+)/)}`;
    else if (/Safari\//.test(u)) browser = `Safari ${m(/Version\/(\d+)/) || m(/Safari\/(\d+)/)}`;
  }

  if (os && browser) return `${os} / ${browser}`;
  if (os) return os;
  return browser;
}

// Internal API for deleting auth user (for compensation)
/**
 * 内部API: ユーザーと関連セッションを削除する（補償トランザクション用）。
 */
export const delete_auth_user = api<{ id: string }, { success: boolean }>(
  { method: "POST", path: "/auth/internal/delete-user", expose: false },
  async ({ id }) => {
    await db.exec`DELETE FROM auth_sessions WHERE user_id = ${id}`;
    await db.exec`DELETE FROM auth_users WHERE id = ${id}`;
    log.info("auth user deleted", { id });
    return { success: true };
  }
);

/**
 * 内部API: ユーザーの有効/無効フラグを更新する。
 */
export const update_user_status = api<{ id: string; isActive: boolean }, { success: boolean }>(
  { method: "POST", path: "/auth/internal/update-status", expose: false },
  async ({ id, isActive }) => {
    await db.exec`
      UPDATE auth_users 
      SET is_active = ${isActive}, updated_at = now()
      WHERE id = ${id}
    `;
    return { success: true };
  }
);

/**
 * 内部API: 既にハッシュ済みパスワードを保存する。
 * 注意: 受け取るのはハッシュ文字列であり、生パスワードではない。
 */
export const update_password = api<{ id: string; passwordHash: string }, { success: boolean }>(
  { method: "POST", path: "/auth/internal/update-password", expose: false },
  async ({ id, passwordHash }) => {
    await db.exec`
      UPDATE auth_users
      SET password_hash = ${passwordHash}, updated_at = now()
      WHERE id = ${id}
    `;
    return { success: true };
  }
);

/**
 * 内部API: 指定ユーザーのパスワード検証を行う。
 */
export const verify_user_password = api<{ id: string; password: string }, { valid: boolean }>(
  { method: "POST", path: "/auth/internal/verify-password", expose: false },
  async ({ id, password }) => {
    const row = await db.queryRow<{ password_hash: string }>`
      SELECT password_hash FROM auth_users WHERE id = ${id}
    `;
    if (!row) return { valid: false };
    const valid = await verifyPassword(password, row.password_hash);
    return { valid };
  }
);

/**
 * 内部API: メールアドレスからユーザーの基本情報を取得する。
 */
export const get_user_by_email = api<{ email: string }, { user: { id: string; email: string; is_active: boolean } | null }>(
  { method: "GET", path: "/auth/internal/user-by-email", expose: false },
  async ({ email }) => {
    const row = await db.queryRow<{ id: string; email: string; is_active: boolean }>`
      SELECT id, email, is_active FROM auth_users WHERE email = ${email}
    `;
    return { user: row || null };
  }
);

/**
 * 内部API: 複数IDでユーザー情報を一括取得する。
 */
export const get_users_batch = api<{ ids: string[] }, { users: Array<{ id: string; email: string; is_active: boolean }> }>(
  { method: "POST", path: "/auth/internal/users-batch", expose: false },
  async ({ ids }) => {
    if (ids.length === 0) return { users: [] };
    
    const users: Array<{ id: string; email: string; is_active: boolean }> = [];
    const result = db.query<{ id: string; email: string; is_active: boolean }>`
      SELECT id, email, is_active FROM auth_users 
      WHERE id = ANY(${ids}::uuid[])
    `;
    
    for await (const row of result) {
      users.push(row);
    }
    
    return { users };
  }
);

/**
 * 内部API: 管理者用に新規ユーザーを作成する。
 * - 既存メール重複チェック
 * - scryptでハッシュ化して保存
 * - email_verified と is_active を true に設定
 */
export const create_auth_user = api<{ email: string; password: string }, { userId: string }>(
  { method: "POST", path: "/auth/internal/create-user-admin", expose: false },
  async ({ email, password }) => {
    // Check if user already exists
    const existing = await db.queryRow<{ id: string }>`
      SELECT id FROM auth_users WHERE email = ${email}
    `;
    
    if (existing) {
      throw APIError.alreadyExists("User with this email already exists");
    }
    
    // Create new user
    const userId = randomUUID();
    const { hash } = hashPassword(password);
    
    await db.exec`
      INSERT INTO auth_users (id, email, password_hash, email_verified, is_active, created_at, updated_at)
      VALUES (${userId}, ${email}, ${hash}, true, true, now(), now())
    `;
    
    log.info("User created by admin", { userId, email });
    
    return { userId };
  }
);

/**
 * 内部API: ユーザーのメールアドレスを更新する。
 * - 別ユーザーに同じメールが使われていないか検査
 */
export const update_user_email = api<{ id: string; email: string }, { success: boolean }>(
  { method: "POST", path: "/auth/internal/update-email", expose: false },
  async ({ id, email }) => {
    // Check if email is already in use
    const existing = await db.queryRow<{ id: string }>`
      SELECT id FROM auth_users WHERE email = ${email} AND id != ${id}
    `;
    
    if (existing) {
      throw APIError.alreadyExists("Email is already in use");
    }
    
    await db.exec`
      UPDATE auth_users 
      SET email = ${email}, updated_at = now()
      WHERE id = ${id}
    `;
    
    log.info("User email updated", { userId: id, newEmail: email });
    
    return { success: true };
  }
);

/**
 * 内部API: 管理者によるパスワードリセット。
 * - ユーザー存在確認
 * - 新パスワードをハッシュ化して保存
 * - 既存のアクティブセッションを全て失効（再ログインを強制）
 * - 監査用ログを出力
 */
export const reset_user_password = api<{ userId: string; newPassword: string }, { success: boolean }>(
  { method: "POST", path: "/auth/internal/reset-password", expose: false },
  async ({ userId, newPassword }) => {
    // Check if user exists
    const user = await db.queryRow<{ id: string }>`
      SELECT id FROM auth_users WHERE id = ${userId}
    `;
    
    if (!user) {
      throw APIError.notFound("User not found");
    }
    
    // Hash the new password
    const { hash } = hashPassword(newPassword);
    
    // Update password
    await db.exec`
      UPDATE auth_users 
      SET password_hash = ${hash}, updated_at = now()
      WHERE id = ${userId}
    `;
    
    // Revoke all existing sessions for this user (force re-login)
    await db.exec`
      UPDATE auth_sessions 
      SET revoked_at = now()
      WHERE user_id = ${userId} AND revoked_at IS NULL
    `;
    
    log.info("User password reset by admin", { 
      userId,
      resetBy: getAuthData()?.userID || 'system'
    });
    
    return { success: true };
  }
);

/**
 * 公開API: ログイン処理。
 * - ユーザー取得、無効/未認証/パスワード不一致の検査と失敗記録
 * - 同時アクティブセッション数の上限（5）を超えた場合は最古のセッションを失効
 * - アクセストークンとリフレッシュトークンの発行、セッション作成
 * - デバイス指紋が提供され remember_device=true の場合はデバイスを登録/更新
 * - 位置情報付与（IPがあれば）、活動・監査ログ記録、異常検知（現在は空）
 */
/**
 * ログインAPI
 * フロー:
 * 1) email検索→不存在/非アクティブ/未検証/認証失敗を段階的に弾き監査ログ（failed_attempt）を保存。
 * 2) アクティブセッション上限(5)超過時は最古を失効。
 * 3) Access/Refresh生成、セッションINSERT。remember_device=true+fingerprint時はデバイス登録/更新。
 * 4) 監査ログ・リアルタイム活動ログ（SSE用）を保存。
 *
 * 注意:
 * - 現状IP/UAは取得しておらず null ログ。異常検知も未実行。
 *   → FIXME: RawRequest対応化して `detectAnomalies()` 実行、criticalは即失効/deny。
 */
export const login = api(
  { method: "POST", path: "/auth/login", expose: true },
  // @ts-ignore - Encore TS types don't support RawRequest as second param, but runtime does
  async ({ email, password, device_name, device_fingerprint, remember_device, client_ip, client_user_agent, client_ua_brands }: LoginParams, req: RawRequest): Promise<TokenResponse> => {
    const startTime = Date.now();
    // フロントからの明示値があれば優先、無ければヘッダから抽出
    const extracted = extractRequestInfo(req as unknown as any);
    const raw_ip: string | null = client_ip ?? extracted.ip_address ?? null;
    const user_agent: string | null = client_user_agent ?? extracted.user_agent ?? null;
    const cfg = getEffectiveTrustConfig();
    const trustMode = cfg.mode;
    const cidrs = cfg.cidrs;
    const headersSnapshot: Record<string,string|undefined> = {
      'x-forwarded-for': (req as any)?.header?.('x-forwarded-for') || (req as any)?.req?.headers?.['x-forwarded-for'],
      'forwarded': (req as any)?.header?.('forwarded') || (req as any)?.req?.headers?.['forwarded'],
      'x-real-ip': (req as any)?.header?.('x-real-ip') || (req as any)?.req?.headers?.['x-real-ip'],
      'cf-connecting-ip': (req as any)?.header?.('cf-connecting-ip') || (req as any)?.req?.headers?.['cf-connecting-ip'],
      'true-client-ip': (req as any)?.header?.('true-client-ip') || (req as any)?.req?.headers?.['true-client-ip'],
    };
    const trust = evaluateClientIpTrust({
      remoteAddress: raw_ip,
      headers: headersSnapshot,
      trustedCidrs: cidrs,
      mode: trustMode,
    });
    const ip_address: string | null = trust.effective_client_ip || raw_ip;
    log.debug("auth.login: request context extracted", { ip_address, user_agent });
    
    // ユーザー認証
    const row = await db.queryRow<{ id: string; password_hash: string; email_verified: boolean; is_active: boolean }>`
      SELECT id, password_hash, email_verified, is_active FROM auth_users WHERE email = ${email}
    `;
    if (!row) {
      // 失敗ログイン試行を記録（ip_trust含む）
      await recordActivity("unknown", null, null, "failed_attempt", {
        endpoint: "/auth/login",
        ip_address,
        user_agent,
        additional_data: { email, reason: "user_not_found", ip_trust: trust },
      });
      throw APIError.notFound("user not found");
    }
    
    if (!row.is_active) {
      await recordActivity(row.id, null, null, "failed_attempt", {
        endpoint: "/auth/login",
        ip_address,
        user_agent,
        additional_data: { email, reason: "account_disabled", ip_trust: trust },
      });
      throw APIError.permissionDenied("account is disabled");
    }
    
    const passwordValid = await verifyPassword(password, row.password_hash);
    if (!passwordValid) {
      await recordActivity(row.id, null, null, "failed_attempt", {
        endpoint: "/auth/login",
        ip_address,
        user_agent,
        additional_data: { email, reason: "invalid_credentials", ip_trust: trust },
      });
      throw APIError.permissionDenied("invalid credentials");
    }
    
    if (!row.email_verified) {
      await recordActivity(row.id, null, null, "failed_attempt", {
        endpoint: "/auth/login",
        ip_address,
        user_agent,
        additional_data: { email, reason: "email_not_verified", ip_trust: trust },
      });
      throw APIError.permissionDenied("email not verified");
    }

    // アクティブセッション数を制限（最大5セッション）
    const MAX_SESSIONS_PER_USER = 5;
    const sessionCount = await db.queryRow<{ count: number }>`
      SELECT COUNT(*) as count 
      FROM auth_sessions 
      WHERE user_id = ${row.id} 
      AND revoked_at IS NULL 
      AND expires_at > NOW()
    `;
    
    if (sessionCount && Number(sessionCount.count) >= MAX_SESSIONS_PER_USER) {
      // 既に上限以上ある場合は、新規作成後に上限を超えないように
      // (現在の件数 - (MAX - 1)) 件の古いセッションをまとめて失効する
      const toRevoke = Number(sessionCount.count) - (MAX_SESSIONS_PER_USER - 1);
      if (toRevoke > 0) {
        await db.exec`
          WITH targets AS (
            SELECT id
            FROM auth_sessions
            WHERE user_id = ${row.id}
              AND revoked_at IS NULL
              AND expires_at > NOW()
            ORDER BY created_at ASC
            LIMIT ${toRevoke}
          )
          UPDATE auth_sessions AS s
          SET revoked_at = NOW()
          FROM targets
          WHERE s.id = targets.id
        `;
      }
    }

    const { token, exp } = await createAccessToken(row.id, email);
    const { raw, hash } = newRefreshToken();
    let sessionId = randomUUID() as ReturnType<typeof randomUUID>;
    const deviceId = randomUUID();
    const refreshTokenFamily = randomUUID();
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * getRefreshTtlDays());
    
    // デバイス情報を処理
    const parsedName = parseDeviceName(user_agent, client_ua_brands);
    const deviceDisplayName = parsedName || device_name || "web";
    let actualDeviceId: string | null = null; // 実際に使用するデバイスID（登録されたデバイスのみ）
    
    // デバイスが既に登録されているか確認
    if (device_fingerprint && remember_device) {
      const existingDevice = await db.queryRow<{ id: string; device_id: string }>`
        SELECT id, device_id FROM auth_user_devices 
        WHERE user_id = ${row.id} 
        AND device_fingerprint = ${device_fingerprint}
      `;
      
      if (existingDevice) {
        // 既存デバイスを使用
        actualDeviceId = existingDevice.device_id;
        // 既存デバイスの最終確認日時を更新
        await db.exec`
          UPDATE auth_user_devices 
          SET last_seen_at = NOW(), 
              device_name = ${deviceDisplayName}
          WHERE id = ${existingDevice.id}
        `;
      } else {
        // 新しいデバイスを登録
        actualDeviceId = deviceId;
        await db.exec`
          INSERT INTO auth_user_devices (user_id, device_id, device_name, device_fingerprint, trusted, last_seen_at)
          VALUES (${row.id}, ${actualDeviceId}, ${deviceDisplayName}, ${device_fingerprint}, ${remember_device}, NOW())
        `;
      }
    }
    // デバイス登録しない場合はactualDeviceIdをnullのままにする

    // 地理情報を取得
    const geoLocation = ip_address ? await getGeoLocationFromIP(ip_address) : null;
    log.debug("auth.login: geo resolved", { geo: geoLocation });
    
    // 既存アクティブセッションの再利用（同一デバイス）
    let reused = false;
    if (actualDeviceId) {
      const existing = await db.queryRow<{ id: string; refresh_token_family: string | null }>`
        SELECT id, refresh_token_family FROM auth_sessions
        WHERE user_id = ${row.id} AND device_id = ${actualDeviceId}
          AND revoked_at IS NULL AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1
      `;
      if (existing) {
        const family = existing.refresh_token_family || refreshTokenFamily;
        await db.exec`
          UPDATE auth_sessions
          SET refresh_token_hash = ${hash},
              refresh_token_family = ${family},
              user_agent = ${user_agent},
              ip_address = ${ip_address},
              device_name = ${deviceDisplayName},
              expires_at = ${expires.toISOString()},
              last_activity_at = NOW(),
              geo_country = ${geoLocation?.country},
              geo_city = ${geoLocation?.city},
              geo_region = ${geoLocation?.region},
              geo_latitude = ${geoLocation?.latitude},
              geo_longitude = ${geoLocation?.longitude},
              geo_timezone = ${geoLocation?.timezone}
          WHERE id = ${existing.id}
        `;
        sessionId = existing.id as ReturnType<typeof randomUUID>;
        reused = true;
      }
    }

    if (!reused) {
      const inserted = await db.queryRow<{ id: string }>`
        INSERT INTO auth_sessions (
          id, user_id, refresh_token_hash, refresh_token_family,
          user_agent, ip_address, expires_at, 
          device_id, device_name, session_type, last_activity_at,
          geo_country, geo_city, geo_region, geo_latitude, geo_longitude, geo_timezone
        )
        VALUES (
          ${sessionId}, ${row.id}, ${hash}, ${refreshTokenFamily},
          ${user_agent}, ${ip_address}, ${expires.toISOString()}, 
          ${actualDeviceId}, ${deviceDisplayName}, 'web', NOW(),
          ${geoLocation?.country}, ${geoLocation?.city}, ${geoLocation?.region},
          ${geoLocation?.latitude}, ${geoLocation?.longitude}, ${geoLocation?.timezone}
        )
        RETURNING id
      `;
      if (!inserted?.id) {
        log.error("auth.login: failed to insert session", { user_id: row.id, sessionId });
        throw APIError.internal("failed to create session");
      }
      log.debug("auth.login: session inserted", { sessionId, ip_address, user_agent });
    } else {
      log.debug("auth.login: session reused and updated", { sessionId, ip_address, user_agent });
    }
    
    // 異常検知を実行（criticalは自動ブロック）
    const anomalies = await detectAnomalies(row.id, sessionId, actualDeviceId, req);
    
    // 高リスクの場合は自動ブロック
    const criticalAnomaly = anomalies.find(a => a.auto_block);
    if (criticalAnomaly) {
      // セッションを即座に無効化
      await db.exec`
        UPDATE auth_sessions 
        SET revoked_at = NOW(), is_suspicious = true 
        WHERE id = ${sessionId}
      `;
      
      log.error("Login blocked due to critical anomaly", {
        user_id: row.id,
        session_id: sessionId,
        anomaly: criticalAnomaly,
        ip_address,
      });
      
      throw APIError.permissionDenied(`Login blocked: ${criticalAnomaly.explanation}`);
    }
    
    // ユーザーパターンを学習
    if (geoLocation) {
      const currentTime = new Date();
      await learnUserPattern(
        row.id,
        currentTime.getHours(),
        currentTime.getDay(),
        geoLocation.country,
        geoLocation.city
      );
    }
    
    // リアルタイム活動を記録
    const responseTime = Date.now() - startTime;
    // 地理リスクの簡易スコア（ユーザ履歴は未導入のため空配列）
    let geoRisk = 0;
    try {
      if (geoLocation) {
        const { calculateGeoRiskScore } = await import("./geo_location");
        geoRisk = calculateGeoRiskScore(geoLocation as any, []);
      }
    } catch {}
    await recordActivity(row.id, sessionId, actualDeviceId, "login", {
      endpoint: "/auth/login",
      ip_address,
      user_agent,
      geo_location: geoLocation,
      risk_score: Math.max(geoRisk, ...anomalies.map(a => a.risk_score), 0),
      response_time_ms: responseTime,
      additional_data: { 
        email, 
        device_fingerprint, 
        anomalies_count: anomalies.length,
        ip_trust: trust,
      },
    });
    
    // 異常検知システムが自動的にアラートを送信
    
    // 監査ログを記録（外部キー制約を満たすdevice_idのみ使用）
    // actualDeviceIdがnullでない場合のみ、実際にauth_user_devicesに存在するかチェック
    let auditDeviceId = actualDeviceId;
    if (actualDeviceId) {
      const deviceExists = await db.queryRow<{ device_id: string }>`
        SELECT device_id FROM auth_user_devices 
        WHERE device_id = ${actualDeviceId}
      `;
      if (!deviceExists) {
        auditDeviceId = null; // デバイスが存在しない場合はnullで記録
      }
    }
    
    await db.exec`
      INSERT INTO auth_session_audit_logs (
        session_id, user_id, action, device_id, device_name, metadata
      )
      VALUES (
        ${sessionId}, ${row.id}, ${reused ? 'refreshed_inplace_login' : 'created'}, ${auditDeviceId}, ${deviceDisplayName}, 
        ${JSON.stringify({ 
          email, 
          device_fingerprint, 
          ip_address, 
          geo_location: geoLocation,
          anomalies_detected: anomalies.length,
          risk_score: Math.max(...anomalies.map(a => a.risk_score), 0)
        })}
      )
    `;

    return {
      access_token: token,
      refresh_token: raw,
      expires_in: exp - Math.floor(Date.now() / 1000),
      token_type: "Bearer" as const,
    };
  }
);

/**
 * 公開API: リフレッシュトークンでアクセストークンを再発行する。
 * - 入力トークンが見つからない場合、同一ファミリーの全セッションを失効（盗用対策）
 * - 有効期限を検査し、ローテーション（旧失効→新発行）
 * - 活動・監査ログを記録
 */
export const refresh = api(
  { method: "POST", path: "/auth/refresh", expose: true },
  // @ts-ignore - Encore TS types don't support RawRequest as second param, but runtime does
  async ({ refresh_token }: { refresh_token: string }, req: RawRequest): Promise<TokenResponse> => {
    // NOTE: 見つからない場合に同一ファミリーを無効化することでトークン盗用に強くする設計。
    //       ローテーションは「旧失効→新発行」。
    const startTime = Date.now();
    const { ip_address: raw_ip, user_agent } = extractRequestInfo(req as unknown as any);
    const cfg = getEffectiveTrustConfig();
    const trustMode = cfg.mode;
    const cidrs = cfg.cidrs;
    const headersSnapshot: Record<string,string|undefined> = {
      'x-forwarded-for': (req as any)?.header?.('x-forwarded-for') || (req as any)?.req?.headers?.['x-forwarded-for'],
      'forwarded': (req as any)?.header?.('forwarded') || (req as any)?.req?.headers?.['forwarded'],
      'x-real-ip': (req as any)?.header?.('x-real-ip') || (req as any)?.req?.headers?.['x-real-ip'],
      'cf-connecting-ip': (req as any)?.header?.('cf-connecting-ip') || (req as any)?.req?.headers?.['cf-connecting-ip'],
      'true-client-ip': (req as any)?.header?.('true-client-ip') || (req as any)?.req?.headers?.['true-client-ip'],
    };
    const trust = evaluateClientIpTrust({
      remoteAddress: raw_ip ?? null,
      headers: headersSnapshot,
      trustedCidrs: cidrs,
      mode: trustMode,
    });
    const ip_address = trust.effective_client_ip || raw_ip || null;
    log.debug("auth.refresh: request context extracted", { ip_address, user_agent });
    const hash = createHash("sha256").update(refresh_token).digest("hex");
    const row = await db.queryRow<{ 
      id: string;
      user_id: string; 
      email: string; 
      expires_at: Date;
      refresh_token_family: string | null;
      device_id: string | null;
      device_name: string | null;
    }>`
      SELECT s.id, s.user_id, u.email, s.expires_at, s.refresh_token_family, s.device_id, s.device_name
      FROM auth_sessions s
      JOIN auth_users u ON u.id = s.user_id
      WHERE s.refresh_token_hash = ${hash} AND s.revoked_at IS NULL
    `;
    
    if (!row) {
      // トークンが見つからない場合、ファミリー全体を無効化（トークン盗用の可能性）
      const familyCheck = await db.queryRow<{ refresh_token_family: string }>`
        SELECT refresh_token_family FROM auth_sessions 
        WHERE refresh_token_hash = ${hash} 
        AND refresh_token_family IS NOT NULL
        LIMIT 1
      `;
      
      if (familyCheck?.refresh_token_family) {
        await db.exec`
          UPDATE auth_sessions 
          SET revoked_at = NOW(), is_suspicious = true 
          WHERE refresh_token_family = ${familyCheck.refresh_token_family}
        `;
        log.warn("トークンファミリー全体を無効化（盗用の可能性）", { family: familyCheck.refresh_token_family });
      }
      
      throw APIError.unauthenticated("invalid refresh token");
    }
    
    if (new Date(row.expires_at).getTime() < Date.now()) throw APIError.unauthenticated("session expired");

    // ローテーション：同一行をUPDATE（新しいハッシュ＋有効期限延長）
    const { token, exp } = await createAccessToken(row.user_id, row.email);
    const { raw: newRaw, hash: newHash } = newRefreshToken();
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * getRefreshTtlDays());
    await db.exec`
      UPDATE auth_sessions 
      SET refresh_token_hash = ${newHash},
          expires_at = ${expires.toISOString()},
          last_activity_at = NOW()
      WHERE id = ${row.id}
    `;
    
    // responseTimeを先に計算
    const responseTime = Date.now() - startTime;
    
    // リアルタイム活動を記録
    await recordActivity(row.user_id, row.id, row.device_id, "refresh", {
      endpoint: "/auth/refresh",
      ip_address,
      user_agent,
      response_time_ms: responseTime,
      additional_data: { refresh_token_family: row.refresh_token_family, ip_trust: trust },
    });

    // 監査ログを記録（外部キー制約を満たすdevice_idのみ使用）
    let auditDeviceId = row.device_id;
    if (row.device_id) {
      const deviceExists = await db.queryRow<{ device_id: string }>`
        SELECT device_id FROM auth_user_devices 
        WHERE device_id = ${row.device_id}
      `;
      if (!deviceExists) {
        auditDeviceId = null; // デバイスが存在しない場合はnullで記録
      }
    }
    
    await db.exec`
      INSERT INTO auth_session_audit_logs (
        session_id, user_id, action, device_id, device_name, metadata
      )
      VALUES (
        ${row.id}, ${row.user_id}, 'refreshed_inplace', ${auditDeviceId}, ${row.device_name}, 
        ${JSON.stringify({ 
          family: row.refresh_token_family, 
          ip_address,
          response_time_ms: responseTime 
        })}
      )
    `;

    return {
      access_token: token,
      refresh_token: newRaw,
      expires_in: exp - Math.floor(Date.now() / 1000),
      token_type: "Bearer" as const,
    };
  }
);

/**
 * 公開API: ログアウト処理。
 * - 認証済みユーザーのリフレッシュトークンを無効化
 * - 活動ログを記録
 */
export const logout = api(
  { method: "POST", path: "/auth/logout", expose: true, auth: true },
  // @ts-ignore - Encore TS types don't support RawRequest as second param, but runtime does
  async ({ refresh_token }: { refresh_token: string }, req: RawRequest): Promise<{ ok: true }> => {
    // NOTE: 対象のrefresh_tokenをハッシュ照合し、該当セッションを失効。
    //       現状IP/UAはログに残さない（null）。
    const startTime = Date.now();
    const { ip_address: raw_ip, user_agent } = extractRequestInfo(req as unknown as any);
    const cfg = getEffectiveTrustConfig();
    const trustMode = cfg.mode;
    const cidrs = cfg.cidrs;
    const headersSnapshot: Record<string,string|undefined> = {
      'x-forwarded-for': (req as any)?.header?.('x-forwarded-for') || (req as any)?.req?.headers?.['x-forwarded-for'],
      'forwarded': (req as any)?.header?.('forwarded') || (req as any)?.req?.headers?.['forwarded'],
      'x-real-ip': (req as any)?.header?.('x-real-ip') || (req as any)?.req?.headers?.['x-real-ip'],
      'cf-connecting-ip': (req as any)?.header?.('cf-connecting-ip') || (req as any)?.req?.headers?.['cf-connecting-ip'],
      'true-client-ip': (req as any)?.header?.('true-client-ip') || (req as any)?.req?.headers?.['true-client-ip'],
    };
    const trust = evaluateClientIpTrust({
      remoteAddress: raw_ip ?? null,
      headers: headersSnapshot,
      trustedCidrs: cidrs,
      mode: trustMode,
    });
    const ip_address = trust.effective_client_ip || raw_ip || null;
    const authData = getAuthData();
    if (!authData) throw APIError.unauthenticated("authentication required");
    const { userID } = authData;
    const hash = createHash("sha256").update(refresh_token).digest("hex");
    
    // セッション情報を取得してから無効化
    const session = await db.queryRow<{ id: string; device_id: string | null }>`
      SELECT id, device_id FROM auth_sessions 
      WHERE refresh_token_hash = ${hash} AND user_id = ${userID}
    `;
    
    await db.exec`
      UPDATE auth_sessions SET revoked_at = now()
      WHERE refresh_token_hash = ${hash} AND user_id = ${userID}
    `;
    
    // リアルタイム活動を記録
    const responseTime = Date.now() - startTime;
    await recordActivity(userID, session?.id || null, session?.device_id || null, "logout", {
      endpoint: "/auth/logout",
      ip_address,
      user_agent,
      response_time_ms: responseTime,
      additional_data: { session_revoked: true, ip_trust: trust },
    });
    
    return { ok: true as const };
  }
);

/**
 * 公開API: 自分の認証基本情報を取得
 * - authは認証の基盤のみを返す（id/email）。
 * - プロファイルやロールは users サービス側で取得してください。
 */
export const me = api<void, { user: { id: string; email: string } }>(
  { method: "GET", path: "/auth/me", expose: true, auth: true },
  async () => {
    const authData = getAuthData();
    if (!authData) throw APIError.unauthenticated("authentication required");
    const { userID } = authData;

    const authUser = await db.queryRow<{ id: string; email: string }>`
      SELECT id, email FROM auth_users WHERE id = ${userID}
    `;
    if (!authUser) throw APIError.notFound("user not found");

    return { user: { id: authUser.id, email: authUser.email } };
  }
);
