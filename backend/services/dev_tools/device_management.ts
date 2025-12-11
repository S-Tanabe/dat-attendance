import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { APIError } from "encore.dev/api";
import log from "encore.dev/log";
import { auth, app } from "~encore/clients";
import { recordAdminAction } from "./audit_log";

// ===== Extended Types =====
// 生成されたクライアントの型に不足しているプロパティを補完
interface ExtendedSessionInfo {
  id: string;
  device_id: string | null;
  created_at: string;
  expires_at: string;
  ip_address?: string | null;
  user_agent?: string | null;
  revoked_at?: string | null;
  is_suspicious?: boolean;
  is_active?: boolean;
  geo_country?: string | null;
  geo_city?: string | null;
  geo_region?: string | null;
}

interface ExtendedDeviceInfo {
  device_id: string;
  device_name: string | null;
  trusted: boolean;
  trust_score: number;
  last_seen_at: Date;
  created_at: Date;
  active_sessions: number;
  device_fingerprint?: string | null;
  first_seen_at?: Date;
}

// ===== Response Types =====

interface DeviceListResponse {
  devices: Array<{
    device_id: string;
    user_id: string;
    user_email: string;
    device_name: string;
    trusted: boolean;
    trust_score: number;
    first_seen_at: string;
    last_seen_at: string;
    sessions_count: number;
    last_location?: {
      country: string;
      city: string;
    };
  }>;
  summary: {
    total_devices: number;
    trusted_devices: number;
    untrusted_devices: number;
    avg_trust_score: number;
  };
}

interface DeviceDetailResponse {
  device: {
    device_id: string;
    user_id: string;
    user_email: string;
    device_name: string;
    device_fingerprint?: string;
    trusted: boolean;
    trust_score: number;
    first_seen_at: string;
    last_seen_at: string;
  };
  sessions: Array<{
    session_id: string;
    created_at: string;
    expires_at: string;
    is_active: boolean;
    is_suspicious: boolean;
    ip_address: string;
    user_agent: string;
    geo_location?: {
      country: string;
      city: string;
      region: string;
    };
  }>;
  activity_patterns: {
    common_locations: Array<{
      country: string;
      city: string;
      frequency: number;
    }>;
    common_times: Array<{
      hour: number;
      day_of_week: number;
      frequency: number;
    }>;
  };
}

interface DeviceActionResponse {
  success: boolean;
  message: string;
  affected_devices?: number;
  affected_sessions?: number;
}

interface BulkDeviceOperationParams {
  device_ids: string[];
  action: 'trust' | 'untrust' | 'remove' | 'revoke_sessions';
}

// ===== Helper Functions =====

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

// ===== API Endpoints =====

// 全デバイス一覧取得
export const get_all_devices = api<{ 
  limit?: number; 
  offset?: number;
  filter?: 'all' | 'trusted' | 'untrusted' | 'suspicious';
}, DeviceListResponse>(
  { method: "GET", path: "/dev_tools/devices", expose: true, auth: true },
  async ({ limit = 100, offset = 0, filter = 'all' }) => {
    await checkSuperAdmin();
    
    try {
      // まず全ユーザーを取得（実運用では要ページネーション）
      const allUsers = await app.list_users({ page: 1, limit: 1000 });
      
      const allDevices: DeviceListResponse['devices'] = [];
      const userEmailMap = new Map<string, string>();
      
      // ユーザーメールマップ作成
      allUsers.users.forEach(user => {
        userEmailMap.set(user.id, user.email);
      });
      
      // 各ユーザーのデバイスを取得
      await Promise.all(
        allUsers.users.map(async (user) => {
          try {
            // 管理者用デバイス一覧APIを利用
            const devs = await auth.admin_get_user_devices({ userId: user.id });
            for (const device of devs.devices) {
              // フィルタリング
              if (filter === 'trusted' && !device.trusted) continue;
              if (filter === 'untrusted' && device.trusted) continue;
              
              // セッション情報取得
              const sessions = await auth.get_user_sessions({ userId: user.id });
              const deviceSessions = (sessions.sessions as unknown as ExtendedSessionInfo[]).filter(s => s.device_id === device.device_id);
              const activeDeviceSessions = deviceSessions.filter(s => s.is_active as boolean);

              // 最新のセッションから位置情報取得
              let last_location = undefined;
              const activeSessions = activeDeviceSessions;
              if (activeSessions.length > 0 && activeSessions[0].geo_country) {
                last_location = {
                  country: activeSessions[0].geo_country || 'Unknown',
                  city: activeSessions[0].geo_city || 'Unknown'
                };
              }

              // 疑わしいセッションチェック
              const hasSuspicious = deviceSessions.some(s => s.is_suspicious);
              if (filter === 'suspicious' && !hasSuspicious) continue;
              
              const extDevice = device as ExtendedDeviceInfo;
              allDevices.push({
                device_id: extDevice.device_id,
                user_id: user.id,
                user_email: userEmailMap.get(user.id) || 'unknown',
                device_name: extDevice.device_name || 'Unknown Device',
                trusted: extDevice.trusted,
                trust_score: extDevice.trust_score,
                first_seen_at: extDevice.first_seen_at?.toString() || extDevice.created_at.toString(),
                last_seen_at: extDevice.last_seen_at.toString(),
                sessions_count: activeDeviceSessions.length,
                last_location
              });
            }
          } catch (err) {
            log.warn("Failed to get devices for user", { user_id: user.id, error: err });
          }
        })
      );
      
      // ソート（最終使用日時の降順）
      allDevices.sort((a, b) => 
        new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime()
      );
      
      // ページネーション
      const paginatedDevices = allDevices.slice(offset, offset + limit);
      
      // サマリー計算
      const summary = {
        total_devices: allDevices.length,
        trusted_devices: allDevices.filter(d => d.trusted).length,
        untrusted_devices: allDevices.filter(d => !d.trusted).length,
        avg_trust_score: allDevices.length > 0 
          ? allDevices.reduce((sum, d) => sum + d.trust_score, 0) / allDevices.length 
          : 0
      };
      
      return {
        devices: paginatedDevices,
        summary
      };
    } catch (error) {
      log.error("Failed to get all devices", { error });
      throw APIError.internal("デバイス一覧の取得に失敗しました");
    }
  }
);

// デバイス詳細取得
export const get_device_detail = api<{ 
  device_id: string;
  user_id: string;
}, DeviceDetailResponse>(
  { method: "GET", path: "/dev_tools/devices/detail", expose: true, auth: true },
  async ({ device_id, user_id }) => {
    await checkSuperAdmin();
    
    try {
      // 管理者用デバイス一覧APIから対象デバイスを検索
      const devs = await auth.admin_get_user_devices({ userId: user_id });
      const device = devs.devices.find(d => d.device_id === device_id);
      if (!device) throw APIError.notFound("デバイスが見つかりません");

      // ユーザー情報取得
      const userBatch = await auth.get_users_batch({ ids: [user_id] });
      const userEmail = userBatch.users[0]?.email || 'unknown';
      
      // セッション情報取得
      const userSessions = await auth.get_user_sessions({ userId: user_id });
      const deviceSessions = (userSessions.sessions as unknown as ExtendedSessionInfo[])
        .filter(s => s.device_id === device_id)
        .map(session => ({
          session_id: session.id,
          created_at: session.created_at,
          expires_at: session.expires_at,
          is_active: new Date(session.expires_at) > new Date() && !session.revoked_at,
          is_suspicious: session.is_suspicious || false,
          ip_address: session.ip_address || 'unknown',
          user_agent: session.user_agent || 'unknown',
          geo_location: session.geo_country ? {
            country: session.geo_country,
            city: session.geo_city || 'Unknown',
            region: session.geo_region || 'Unknown'
          } : undefined
        }));
      
      // アクティビティパターン分析（簡易版）
      const locationFreq = new Map<string, number>();
      const timeFreq = new Map<string, number>();
      
      deviceSessions.forEach(session => {
        // 位置情報集計
        if (session.geo_location) {
          const key = `${session.geo_location.country}:${session.geo_location.city}`;
          locationFreq.set(key, (locationFreq.get(key) || 0) + 1);
        }
        
        // 時間帯集計（簡易版 - created_atから）
        const date = new Date(session.created_at);
        const timeKey = `${date.getHours()}:${date.getDay()}`;
        timeFreq.set(timeKey, (timeFreq.get(timeKey) || 0) + 1);
      });
      
      // 頻出位置情報
      const common_locations = Array.from(locationFreq.entries())
        .map(([key, freq]) => {
          const [country, city] = key.split(':');
          return { country, city, frequency: freq };
        })
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 5);
      
      // 頻出時間帯
      const common_times = Array.from(timeFreq.entries())
        .map(([key, freq]) => {
          const [hour, day] = key.split(':').map(Number);
          return { hour, day_of_week: day, frequency: freq };
        })
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 5);
      
      const extDevice = device as ExtendedDeviceInfo;
      return {
        device: {
          device_id: extDevice.device_id,
          user_id,
          user_email: userEmail,
          device_name: extDevice.device_name || 'Unknown Device',
          device_fingerprint: extDevice.device_fingerprint || undefined,
          trusted: extDevice.trusted,
          trust_score: extDevice.trust_score,
          first_seen_at: extDevice.first_seen_at?.toString() || extDevice.created_at.toString(),
          last_seen_at: extDevice.last_seen_at.toString()
        },
        sessions: deviceSessions,
        activity_patterns: {
          common_locations,
          common_times
        }
      };
    } catch (error) {
      if (error instanceof APIError) throw error;
      log.error("Failed to get device detail", { error });
      throw APIError.internal("デバイス詳細の取得に失敗しました");
    }
  }
);

// デバイス信頼度更新
export const update_device_trust = api<{
  device_id: string;
  user_id: string;
  trusted: boolean;
  trust_score?: number;
}, DeviceActionResponse>(
  { method: "POST", path: "/dev_tools/devices/trust", expose: true, auth: true },
  async ({ device_id, user_id, trusted, trust_score }) => {
    await checkSuperAdmin();
    
    try {
      await auth.admin_set_device_trust({ device_id, trusted, trust_score });
      log.info("Device trust updated by super_admin", { device_id, user_id, trusted, trust_score });
      await recordAdminAction({
        action: 'device_trust_update', target_type: 'device', target_id: device_id,
        payload: { user_id, trusted, trust_score }, success: true
      });
      return { success: true, message: `デバイスの信頼状態を${trusted ? '信頼済み' : '未信頼'}に更新しました`, affected_devices: 1 };
    } catch (error) {
      log.error("Failed to update device trust", { error });
      throw APIError.internal("デバイス信頼度の更新に失敗しました");
    }
  }
);

// デバイス削除
export const remove_device = api<{
  device_id: string;
  user_id: string;
}, DeviceActionResponse>(
  { method: "DELETE", path: "/dev_tools/devices/remove", expose: true, auth: true },
  async ({ device_id, user_id }) => {
    await checkSuperAdmin();
    
    try {
      await auth.admin_remove_device({ device_id });
      log.warn("Device removed by super_admin", { device_id, user_id });
      await recordAdminAction({ action: 'device_removed', target_type: 'device', target_id: device_id, payload: { user_id }, success: true, severity: 'warning' });
      return { success: true, message: 'デバイスを削除しました', affected_devices: 1 };
    } catch (error) {
      log.error("Failed to remove device", { error });
      throw APIError.internal("デバイスの削除に失敗しました");
    }
  }
);

// 一括デバイス操作
export const bulk_device_operation = api<BulkDeviceOperationParams, DeviceActionResponse>(
  { method: "POST", path: "/dev_tools/devices/bulk", expose: true, auth: true },
  async ({ device_ids, action }) => {
    await checkSuperAdmin();
    
    if (device_ids.length === 0) {
      throw APIError.invalidArgument("デバイスIDが指定されていません");
    }
    
    if (device_ids.length > 100) {
      throw APIError.invalidArgument("一度に処理できるデバイスは100台までです");
    }
    
    let affectedDevices = 0;
    let affectedSessions = 0;
    const errors: string[] = [];
    
    try {
      // デバイスIDからユーザーIDを特定する必要がある
      // 実装の簡略化のため、全ユーザーから検索（実運用では要改善）
      const allUsers = await app.list_users({ page: 1, limit: 1000 });
      
      for (const device_id of device_ids) {
        let processed = false;
        
        for (const user of allUsers.users) {
          try {
            const sessions = await auth.get_user_sessions({ userId: user.id });
            const hasDevice = sessions.sessions.some(s => s.device_id === device_id);
            
            if (hasDevice) {
              switch (action) {
                case 'trust':
                  await auth.admin_set_device_trust({ device_id, trusted: true, trust_score: 80 });
                  break;
                  
                case 'untrust':
                  await auth.admin_set_device_trust({ device_id, trusted: false, trust_score: 20 });
                  break;
                  
                case 'remove':
                  await auth.admin_remove_device({ device_id });
                  break;
                  
                case 'revoke_sessions':
                  // 管理者用の一括無効化APIを使用（所有者チェックを回避し、対象デバイスのアクティブのみ）
                  const res = await auth.admin_revoke_device_sessions({ device_id });
                  affectedSessions += res.revoked_count || 0;
                  break;
              }
              
              affectedDevices++;
              processed = true;
              break;
            }
          } catch (err) {
            log.warn("Failed to process device in bulk operation", { 
              device_id, 
              user_id: user.id, 
              action,
              error: err 
            });
          }
        }
        
        if (!processed) {
          errors.push(`デバイス ${device_id} が見つかりません`);
        }
      }
      
      log.info("Bulk device operation completed", {
        action,
        requested: device_ids.length,
        affected_devices: affectedDevices,
        affected_sessions: affectedSessions,
        errors: errors.length
      });
      
      let message = '';
      switch (action) {
        case 'trust':
          message = `${affectedDevices}台のデバイスを信頼済みに設定しました`;
          break;
        case 'untrust':
          message = `${affectedDevices}台のデバイスを未信頼に設定しました`;
          break;
        case 'remove':
          message = `${affectedDevices}台のデバイスを削除しました`;
          break;
        case 'revoke_sessions':
          message = `${affectedDevices}台のデバイスの${affectedSessions}個のセッションを無効化しました`;
          break;
      }
      
      if (errors.length > 0) {
        message += ` (${errors.length}件のエラー)`;
      }
      
      return {
        success: affectedDevices > 0,
        message,
        affected_devices: affectedDevices,
        affected_sessions: affectedSessions
      };
    } catch (error) {
      log.error("Failed to perform bulk device operation", { error });
      throw APIError.internal("一括デバイス操作に失敗しました");
    }
  }
);
