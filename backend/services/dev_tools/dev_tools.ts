/*
 * Dev Tools: operational endpoints (super_admin専用)
 *
 * 注意/既知の制約:
 * - 本サービスは auth の内部APIを呼びます（expose:false）。
 * - ロールは app.get_user_profile で確認します。
 * - 一部の呼び出しは現在のauth APIと引数が不整合のため、FIXMEで注記しています。
 */
import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { APIError } from "encore.dev/api";
import log from "encore.dev/log";
import { auth, app } from "~encore/clients";
import { recordAdminAction } from "./audit_log";

// 新機能APIの再エクスポート
export * from "./storage_objects";
export * from "./device_management";
// Slim mode: removed security_dashboard, anomaly_control, alert_management, realtime_proxy

// レスポンス型定義
interface SessionStatsResponse {
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

interface CleanupResponse {
  success: boolean;
  deleted?: {
    expired: number;
    revoked: number;
    total: number;
  };
  remaining?: {
    total: number;
    active: number;
  };
  error?: string;
  timestamp: string;
}

interface ExpireSessionsResponse {
  success: boolean;
  affected: number;
  message: string;
  timestamp: string;
}

interface AuthInfoResponse {
  user_id: string;
  email: string;
  session_id?: string;
  session_created?: string;
  session_expires?: string;
  dashboard_auth: {
    header_format: {
      name: string;
      value: string;
      description: string;
    };
    cookie_format: {
      name: string;
      value: string;
      description: string;
    };
    curl_sample: string;
  };
}

interface DevStatusResponse {
  service: string;
  status: string;
  version: string;
  environment: string;
  timestamp: string;
}

// super_admin権限チェック関数
// super_admin権限チェック（appサービスのロールを一次ソースとして確認）
async function checkSuperAdmin(): Promise<void> {
  const authData = getAuthData();
  if (!authData?.userID) {
    throw APIError.unauthenticated("認証が必要です");
  }

  const userProfile = await app.get_user_profile({ id: authData.userID });
  if (!userProfile?.profile || userProfile.profile.role_name !== 'super_admin') {
    throw APIError.permissionDenied("この操作はsuper_admin権限が必要です");
  }
}

// セッション統計情報API
export const session_stats = api<void, SessionStatsResponse>(
  { method: "GET", path: "/dev_tools/session_stats", expose: true, auth: true },
  async () => {
    await checkSuperAdmin();

    // authサービスのget_session_statsを呼び出し
    const stats = await auth.get_session_stats();
    await recordAdminAction({ action: "session_stats", target_type: "system", target_id: "auth", payload: { stats_summary: stats.summary }, success: true });
    
    return stats;
  }
);

// セッションクリーンアップAPI（auth内部API）
export const cleanup_sessions = api<void, CleanupResponse>(
  { method: "POST", path: "/dev_tools/cleanup_sessions", expose: true, auth: true },
  async () => {
    // getAuthData()で認証情報取得
    const authData = getAuthData();
    if (!authData?.userID) {
      throw APIError.unauthenticated("認証が必要です");
    }
    await checkSuperAdmin();
    
    try {
      // auth.cleanup_sessions_api は expose:false の内部API
      log.info("Calling auth.cleanup_sessions_api");
      const result = await auth.cleanup_sessions_api();
      log.info("cleanup_sessions_api succeeded", { result });
      
      // resultが正しく返されているか確認
      if (!result) {
        throw new Error("Cleanup result is null");
      }
      
      return {
        success: true,
        deleted: {
          expired: result.expired_deleted || 0,
          revoked: result.revoked_deleted || 0,
          total: (result.expired_deleted || 0) + (result.revoked_deleted || 0),
        },
        remaining: {
          total: result.remaining_total || 0,
          active: result.remaining_active || 0,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      log.error("Session cleanup failed", { error });
      await recordAdminAction({ action: "cleanup_sessions", target_type: "system", target_id: "auth", success: false, error_message: (error as Error).message, severity: "error" });
      
      // エラーの詳細をログに出力
      if (error instanceof Error) {
        log.error("Error details", { 
          message: error.message, 
          stack: error.stack 
        });
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  }
);

// 有効期限内の全セッションを期限切れにする（自分以外）
export const expire_all_sessions = api<void, ExpireSessionsResponse>(
  { method: "POST", path: "/dev_tools/expire_all_sessions", expose: true, auth: true },
  async () => {
    log.info("expire_all_sessions: Starting execution");
    
    await checkSuperAdmin();
    log.info("expire_all_sessions: Super admin check passed");
    
    const authData = getAuthData();
    log.info("expire_all_sessions: Auth data retrieved", { 
      userID: authData?.userID 
    });
    
    try {
      log.info("expire_all_sessions: Calling auth.expire_all_sessions_except", {
        except_user_id: authData!.userID
      });
      
      // authサービスのexpire_all_sessions_exceptを呼び出し
      const result = await auth.expire_all_sessions_except({ 
        except_user_id: authData!.userID 
      });
      
      log.info("expire_all_sessions: auth service call successful", {
        result
      });
      
      log.warn("All active sessions expired by super_admin", { 
        adminId: authData!.userID,
        affectedSessions: result.affected 
      });
      
      return {
        success: result.success,
        affected: result.affected,
        message: `${result.affected}個のセッションを無効化しました（自分のセッション以外）`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      log.error("Failed to expire all sessions - Full error details", { 
        error,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        errorStack: error instanceof Error ? error.stack : undefined,
        errorType: error?.constructor?.name,
        userID: authData?.userID
      });
      
      // エラーの詳細を含めて返す
      const errorMessage = error instanceof Error 
        ? `セッションの期限切れ処理に失敗しました: ${error.message}`
        : "セッションの期限切れ処理に失敗しました: Unknown error";
      await recordAdminAction({ action: "expire_all_sessions", target_type: "system", target_id: "auth", success: false, error_message: (error as Error).message, severity: "error" });
      
      throw APIError.internal(errorMessage);
    }
  }
);

// 認証情報確認API
export const auth_info = api<void, Partial<AuthInfoResponse>>(
  { method: "GET", path: "/dev_tools/auth_info", expose: true, auth: true },
  async () => {
    await checkSuperAdmin();
    
    const authData = getAuthData();
    
    if (!authData) {
      throw APIError.unauthenticated("認証が必要です");
    }

    // ユーザープロファイル情報を取得
    const userProfile = await app.get_user_profile({ id: authData.userID });
    
    // メール情報はauthサービスから取得
    const authUsersResponse = await auth.get_users_batch({ ids: [authData.userID] });
    const authUser = authUsersResponse.users[0];
    
    // バックエンドではユーザー情報のみ返す
    // アクセストークンはフロントエンド側で追加される
    return {
      user_id: authData.userID,
      email: authUser?.email || ''
    };
  }
);

// 開発ステータスAPI
export const dev_status = api<void, DevStatusResponse>(
  { method: "GET", path: "/dev_tools/status", expose: true, auth: true },
  async () => {
    await checkSuperAdmin();
    
    return {
      service: "dev_tools",
      status: "operational",
      version: "1.0.0",
      environment: process.env.NODE_ENV || "development",
      timestamp: new Date().toISOString(),
    };
  }
);
