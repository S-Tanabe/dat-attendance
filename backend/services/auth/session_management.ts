/*
 * Session Management APIs
 *
 * 概要:
 * - 現在ユーザーのセッション一覧取得、個別/全セッション失効、デバイスの一覧/削除、
 *   統計や内部向けの一括操作を提供します。
 *
 * セキュリティ/運用ノート:
 * - すべての変更系は `auth: true` を要求（内部APIの一部を除く）。
 * - セッションの失効は `revoked_at` を打って論理失効。クリーンアップはCronで物理削除。
 * - 監査ログ(auth_session_audit_logs)は主にauth.ts側で作成。本モジュールでは最小限。
 *
 * パフォーマンス注意:
 * - `get_user_devices` は各行でアクティブセッション数をCOUNTするためN+1になります。
 *   → 将来: サブクエリ/集約JOINで一括取得に最適化が可能。
 */
import { api, APIError } from "encore.dev/api";
import log from "encore.dev/log";
import { getAuthData } from "~encore/auth";
import { db } from "./database";

// セッション情報の型定義
interface SessionInfo {
  id: string;
  user_agent: string | null;
  ip_address: string | null;
  device_id: string | null;
  device_name: string | null;
  session_type: string | null;
  last_activity_at: Date | null;
  created_at: Date;
  expires_at: Date;
  is_current: boolean;
  is_active: boolean;
  location?: string | null;
  is_suspicious: boolean;
  risk_score: number;
}

// 現在のユーザーの全セッションを取得
export const get_sessions = api(
  { 
    method: "GET", 
    path: "/auth/sessions",
    auth: true,
  },
  async (): Promise<{ sessions: SessionInfo[] }> => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Not authenticated");
    }

    const sessionQuery = db.query<{
      id: string;
      user_agent: string | null;
      ip_address: string | null;
      device_id: string | null;
      device_name: string | null;
      session_type: string | null;
      last_activity_at: Date | null;
      created_at: Date;
      expires_at: Date;
      revoked_at: Date | null;
      geo_country: string | null;
      geo_city: string | null;
      is_suspicious: boolean | null;
      risk_score: number | null;
    }>`
      SELECT 
        id,
        user_agent,
        ip_address,
        device_id,
        device_name,
        session_type,
        last_activity_at,
        created_at,
        expires_at,
        revoked_at,
        geo_country,
        geo_city,
        is_suspicious,
        risk_score
      FROM auth_sessions
      WHERE user_id = ${authData.userID}
      AND revoked_at IS NULL
      AND expires_at > NOW()
      ORDER BY COALESCE(last_activity_at, created_at) DESC
    `;

    // AsyncGeneratorを配列に変換
    const sessions: SessionInfo[] = [];
    for await (const session of sessionQuery) {
      sessions.push({
        ...session,
        is_current: false, // TODO: determine current session based on refresh token
        is_active: !session.revoked_at && session.expires_at > new Date(),
        location: session.geo_city && session.geo_country ? `${session.geo_city}, ${session.geo_country}` : session.geo_country,
        is_suspicious: session.is_suspicious || false,
        risk_score: session.risk_score || 0
      });
    }

    return { sessions };
  }
);

// 指定ユーザー以外の全セッションを期限切れにする（内部用API）
export const expire_all_sessions_except = api<
  { except_user_id: string },
  { success: boolean; affected: number; message: string }
>(
  { 
    method: "POST", 
    path: "/auth/sessions/expire_all_except",
    expose: false,  // 内部用API
    auth: true,
  },
  async ({ except_user_id }) => {
    console.log("expire_all_sessions_except: Starting execution", { except_user_id });
    
    try {
      // 無効化されていないセッション数を事前に確認
      const beforeCount = await db.queryRow<{ count: number }>`
        SELECT COUNT(*) as count
        FROM auth_sessions 
        WHERE revoked_at IS NULL 
        AND user_id != ${except_user_id}
      `;
      
      console.log("expire_all_sessions_except: Non-revoked sessions before update", { 
        count: beforeCount?.count || 0,
        except_user_id 
      });
      
      // 無効化されていない全セッションを無効化（指定ユーザー以外）
      const result = await db.query`
        UPDATE auth_sessions 
        SET revoked_at = NOW()
        WHERE revoked_at IS NULL 
        AND user_id != ${except_user_id}
        RETURNING id
      `;
      
      // AsyncGeneratorを配列に変換
      const updatedIds: string[] = [];
      for await (const row of result) {
        updatedIds.push(row.id);
      }
      
      const affected = updatedIds.length;
      
      console.log("expire_all_sessions_except: Update completed", { 
        affected,
        updatedIds: updatedIds.length,
        except_user_id 
      });
      
      return {
        success: true,
        affected,
        message: `${affected}個のセッションを無効化しました`,
      };
    } catch (error) {
      console.error("expire_all_sessions_except: Error occurred", { 
        error,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        errorStack: error instanceof Error ? error.stack : undefined,
        except_user_id 
      });
      throw error;
    }
  }
);

// セッション統計情報を取得（内部用API）
export const get_session_stats = api<
  void,
  {
    summary: {
      total_sessions: number;
      active_sessions: number;
      expired_sessions: number;
      revoked_sessions: number;
      unique_users: number;
      oldest_session: Date | null;
      newest_session: Date | null;
    };
    top_users: Array<{
      user_id: string;
      email: string;
      session_count: number;
    }>;
    cleanup_recommendation: {
      expired_to_clean: number;
      revoked_to_clean: number;
    };
  }
>(
  { 
    method: "GET", 
    path: "/auth/sessions/stats",
    expose: false,  // 内部用API
    auth: true,
  },
  async () => {
    const stats = await db.queryRow<{
      total_sessions: number;
      active_sessions: number;
      expired_sessions: number;
      revoked_sessions: number;
      unique_users: number;
      oldest_session: Date | null;
      newest_session: Date | null;
    }>`
      SELECT 
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN revoked_at IS NULL AND expires_at > NOW() THEN 1 END) as active_sessions,
        COUNT(CASE WHEN expires_at < NOW() AND revoked_at IS NULL THEN 1 END) as expired_sessions,
        COUNT(CASE WHEN revoked_at IS NOT NULL THEN 1 END) as revoked_sessions,
        COUNT(DISTINCT user_id) as unique_users,
        MIN(created_at) as oldest_session,
        MAX(created_at) as newest_session
      FROM auth_sessions
    `;

    const userSessions = await db.query<{
      user_id: string;
      email: string;
      session_count: number;
    }>`
      SELECT 
        s.user_id,
        u.email,
        COUNT(*) as session_count
      FROM auth_sessions s
      JOIN auth_users u ON u.id = s.user_id
      WHERE s.revoked_at IS NULL AND s.expires_at > NOW()
      GROUP BY s.user_id, u.email
      ORDER BY session_count DESC
      LIMIT 10
    `;

    const oldRevokedCount = await db.queryRow<{ count: number }>`
      SELECT COUNT(*) as count
      FROM auth_sessions 
      WHERE revoked_at IS NOT NULL 
      AND revoked_at < NOW() - INTERVAL '7 days'
    `;

    // AsyncGeneratorを配列に変換
    const topUsers: Array<{
      user_id: string;
      email: string;
      session_count: number;
    }> = [];
    for await (const user of userSessions) {
      topUsers.push(user);
    }

    return {
      summary: stats || {
        total_sessions: 0,
        active_sessions: 0,
        expired_sessions: 0,
        revoked_sessions: 0,
        unique_users: 0,
        oldest_session: null,
        newest_session: null,
      },
      top_users: topUsers,
      cleanup_recommendation: {
        expired_to_clean: stats?.expired_sessions || 0,
        revoked_to_clean: oldRevokedCount?.count || 0,
      }
    };
  }
);

// 特定のセッションを無効化
interface RevokeSessionParams {
  sessionId: string;
}

export const revoke_session = api<RevokeSessionParams, { success: boolean }>(
  { 
    method: "DELETE", 
    path: "/auth/sessions/:sessionId",
    auth: true,
  },
  async ({ sessionId }) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Not authenticated");
    }

    // ユーザーが所有するセッションかチェック
    const session = await db.queryRow<{ user_id: string }>`
      SELECT user_id 
      FROM auth_sessions 
      WHERE id = ${sessionId} 
      AND revoked_at IS NULL
    `;

    if (!session) {
      throw APIError.notFound("Session not found");
    }

    if (session.user_id !== authData.userID) {
      throw APIError.permissionDenied("Cannot revoke other user's session");
    }

    // セッションを無効化
    await db.exec`
      UPDATE auth_sessions 
      SET revoked_at = NOW() 
      WHERE id = ${sessionId}
    `;

    return { success: true };
  }
);

/** 管理者用: デバイスの全セッション無効化（内部API） */
export const admin_revoke_device_sessions = api<{ device_id: string }, { revoked_count: number }>(
  { method: "POST", path: "/auth/internal/admin/device/:device_id/revoke-sessions", expose: false, auth: true },
  async ({ device_id }) => {
    const countRow = await db.queryRow<{ count: number }>`
      SELECT COUNT(*) as count
      FROM auth_sessions
      WHERE device_id = ${device_id} AND revoked_at IS NULL AND expires_at > NOW()
    `;
    await db.exec`
      UPDATE auth_sessions SET revoked_at = NOW()
      WHERE device_id = ${device_id} AND revoked_at IS NULL AND expires_at > NOW()
    `;
    return { revoked_count: countRow?.count || 0 };
  }
);

// デバイス情報を取得
export const get_user_devices = api<
  void,
  {
    devices: Array<{
      device_id: string;
      device_name: string;
      trusted: boolean;
      last_seen_at: Date;
      active_sessions: number;
      created_at: Date;
    }>;
  }
>(
  {
    method: "GET",
    path: "/auth/devices",
    auth: true,
  },
  async () => {
    const authData = getAuthData();
    if (!authData) throw APIError.unauthenticated("authentication required");
    const { userID } = authData;
    
    const devices: Array<{
      device_id: string;
      device_name: string;
      trusted: boolean;
      last_seen_at: Date;
      active_sessions: number;
      created_at: Date;
    }> = [];
    
    const deviceQuery = db.query<{
      device_id: string;
      device_name: string;
      trusted: boolean;
      last_seen_at: Date;
      created_at: Date;
    }>`
      SELECT 
        device_id,
        device_name,
        trusted,
        last_seen_at,
        created_at
      FROM auth_user_devices
      WHERE user_id = ${userID}
      ORDER BY last_seen_at DESC
    `;
    
    for await (const device of deviceQuery) {
      // 各デバイスのアクティブセッション数を取得
      const sessionCount = await db.queryRow<{ count: number }>`
        SELECT COUNT(*) as count
        FROM auth_sessions
        WHERE device_id = ${device.device_id}
          AND user_id = ${userID}
          AND revoked_at IS NULL
          AND expires_at > NOW()
      `;
      
      devices.push({
        ...device,
        active_sessions: sessionCount?.count || 0,
      });
    }
    
    return { devices };
  }
);

// デバイスを削除（関連セッションも無効化）
export const remove_device = api<
  { device_id: string },
  { success: boolean; sessions_revoked: number }
>(
  {
    method: "DELETE",
    path: "/auth/devices/:device_id",
    auth: true,
  },
  async ({ device_id }) => {
    const authData = getAuthData();
    if (!authData) throw APIError.unauthenticated("authentication required");
    const { userID } = authData;
    
    // デバイスがユーザーのものか確認
    const device = await db.queryRow<{ id: string }>`
      SELECT id FROM auth_user_devices
      WHERE device_id = ${device_id}
        AND user_id = ${userID}
    `;
    
    if (!device) {
      throw APIError.notFound("device not found");
    }
    
    // デバイスに関連するセッションを無効化
    // Get the number of sessions that will be revoked
    const sessionsToRevoke = await db.queryRow<{ count: number }>`
      SELECT COUNT(*) as count FROM auth_sessions
      WHERE device_id = ${device_id}
        AND user_id = ${userID}
        AND revoked_at IS NULL
    `;
    
    await db.exec`
      UPDATE auth_sessions
      SET revoked_at = NOW()
      WHERE device_id = ${device_id}
        AND user_id = ${userID}
        AND revoked_at IS NULL
    `;
    
    const sessionsRevoked = sessionsToRevoke?.count || 0;
    
    // TODO: Fix audit log - temporarily disabled due to foreign key constraints
    // await db.exec`...`;
    
    // デバイスを削除
    await db.exec`
      DELETE FROM auth_user_devices
      WHERE device_id = ${device_id}
        AND user_id = ${userID}
    `;
    
    return {
      success: true,
      sessions_revoked: sessionsRevoked,
    };
  }
);

// 現在のユーザーの全セッションを無効化（全デバイスからログアウト）
export const revoke_all_sessions = api(
  { 
    method: "POST", 
    path: "/auth/sessions/revoke-all",
    auth: true,
  },
  async (): Promise<{ revoked_count: number }> => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Not authenticated");
    }

    // 無効化対象のセッション数を事前にカウント
    const countResult = await db.queryRow<{ count: number }>`
      SELECT COUNT(*) as count
      FROM auth_sessions 
      WHERE user_id = ${authData.userID}
      AND revoked_at IS NULL
      AND expires_at > NOW()
    `;

    const revokedCount = countResult?.count ?? 0;

    // セッションを無効化
    await db.exec`
      UPDATE auth_sessions 
      SET revoked_at = NOW() 
      WHERE user_id = ${authData.userID}
      AND revoked_at IS NULL
      AND expires_at > NOW()
    `;

    return { revoked_count: revokedCount };
  }
);

/**
 * 特定ユーザーの全セッション取得（管理者用、内部API）
 */
export const get_user_sessions = api<{ userId: string }, { sessions: Array<SessionInfo> }>(
  { 
    method: "GET", 
    path: "/auth/internal/user-sessions/:userId",
    expose: false
  },
  async ({ userId }) => {
    const sessions: Array<SessionInfo> = [];
    
    const result = db.query<{
      id: string;
      device_id: string | null;
      device_name: string | null;
      session_type: string | null;
      last_activity_at: Date | null;
      created_at: Date;
      expires_at: Date;
      revoked_at: Date | null;
      ip_address: string | null;
      user_agent: string | null;
      geo_country: string | null;
      geo_city: string | null;
      is_suspicious: boolean | null;
      risk_score: number | null;
    }>`
      SELECT 
        id,
        device_id,
        device_name,
        session_type,
        last_activity_at,
        created_at,
        expires_at,
        revoked_at,
        ip_address,
        user_agent,
        geo_country,
        geo_city,
        is_suspicious,
        risk_score
      FROM auth_sessions
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;
    
    for await (const row of result) {
      sessions.push({
        id: row.id,
        device_id: row.device_id,
        device_name: row.device_name,
        session_type: row.session_type,
        last_activity_at: row.last_activity_at,
        created_at: row.created_at,
        expires_at: row.expires_at,
        is_current: false, // TODO: determine current session
        is_active: !row.revoked_at && row.expires_at > new Date(),
        ip_address: row.ip_address,
        user_agent: row.user_agent,
        location: row.geo_city && row.geo_country ? `${row.geo_city}, ${row.geo_country}` : row.geo_country,
        is_suspicious: row.is_suspicious || false,
        risk_score: row.risk_score || 0,
      });
    }
    
    return { sessions };
  }
);

/**
 * 特定ユーザーの全セッション無効化（管理者用、内部API）
 */
export const revoke_user_sessions = api<{ userId: string }, { revoked_count: number }>(
  { 
    method: "POST", 
    path: "/auth/internal/revoke-user-sessions",
    expose: false
  },
  async ({ userId }) => {
    // ユーザーの全アクティブセッションを無効化
    // FIXME: PostgreSQLでは UPDATE ... RETURNING COUNT(*) は無効です。
    //   正しくは rowCount を使う、あるいは CTE で件数を集計します。
    //   例:
    //   WITH upd AS (
    //     UPDATE auth_sessions
    //     SET revoked_at = NOW()
    //     WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
    //     RETURNING 1
    //   ) SELECT COUNT(*) FROM upd;
    // 非破壊のため現状は近似的に「事前カウント→UPDATE」の2クエリに切替検討をコメント化のみ。

    const preCount = await db.queryRow<{ count: number }>`
      SELECT COUNT(*) as count
      FROM auth_sessions 
      WHERE user_id = ${userId}
        AND revoked_at IS NULL
        AND expires_at > NOW()
    `;

    await db.exec`
      UPDATE auth_sessions 
      SET revoked_at = NOW() 
      WHERE user_id = ${userId}
        AND revoked_at IS NULL
        AND expires_at > NOW()
    `;

    const revokedCount = preCount?.count || 0;
    
    if (revokedCount > 0) {
      // 監査ログ記録
      await db.exec`
        INSERT INTO auth_session_audit_logs (
          id,
          user_id,
          action,
          metadata,
          created_at
        ) VALUES (
          gen_random_uuid(),
          ${userId},
          'sessions_revoked_by_admin',
          ${JSON.stringify({ 
            revoked_count: revokedCount,
            admin_id: getAuthData()?.userID || 'system'
          })},
          NOW()
        )
      `;
    }
    
    log.info("User sessions revoked by admin", { 
      userId,
      revokedCount,
      adminId: getAuthData()?.userID || 'system'
    });
    
    return { revoked_count: revokedCount };
  }
);

/**
 * 管理者用: 指定ユーザーのデバイス一覧取得（内部API）
 * - dev_tools等からの利用を想定。
 */
export const admin_get_user_devices = api<
  { userId: string },
  {
    devices: Array<{
      device_id: string;
      device_name: string | null;
      trusted: boolean;
      trust_score: number;
      last_seen_at: Date;
      created_at: Date;
      active_sessions: number;
    }>;
  }
>({ method: "GET", path: "/auth/internal/admin/user/:userId/devices", expose: false, auth: true }, async ({ userId }) => {
  const rows = db.query<{
    device_id: string;
    device_name: string | null;
    trusted: boolean | null;
    trust_score: number | null;
    last_seen_at: Date;
    created_at: Date;
  }>`
    SELECT device_id, device_name, trusted, trust_score, last_seen_at, created_at
    FROM auth_user_devices
    WHERE user_id = ${userId}
    ORDER BY last_seen_at DESC
  `;

  const devices: Array<{
    device_id: string;
    device_name: string | null;
    trusted: boolean;
    trust_score: number;
    last_seen_at: Date;
    created_at: Date;
    active_sessions: number;
  }> = [];

  for await (const d of rows) {
    const cnt = await db.queryRow<{ count: number }>`
      SELECT COUNT(*) as count FROM auth_sessions
      WHERE user_id = ${userId} AND device_id = ${d.device_id}
        AND revoked_at IS NULL AND expires_at > NOW()
    `;
    devices.push({
      device_id: d.device_id,
      device_name: d.device_name,
      trusted: !!d.trusted,
      trust_score: d.trust_score ?? 0,
      last_seen_at: d.last_seen_at,
      created_at: d.created_at,
      active_sessions: cnt?.count || 0,
    });
  }

  return { devices };
});

/** 管理者用: デバイス削除（内部API） */
export const admin_remove_device = api<{ device_id: string }, { success: boolean; sessions_revoked: number }>(
  { method: "DELETE", path: "/auth/internal/admin/device/:device_id", expose: false, auth: true },
  async ({ device_id }) => {
    const sessionsToRevoke = await db.queryRow<{ count: number }>`
      SELECT COUNT(*) as count FROM auth_sessions
      WHERE device_id = ${device_id} AND revoked_at IS NULL
    `;
    await db.exec`
      UPDATE auth_sessions SET revoked_at = NOW() WHERE device_id = ${device_id} AND revoked_at IS NULL
    `;
    await db.exec`DELETE FROM auth_user_devices WHERE device_id = ${device_id}`;
    return { success: true, sessions_revoked: sessionsToRevoke?.count || 0 };
  }
);
