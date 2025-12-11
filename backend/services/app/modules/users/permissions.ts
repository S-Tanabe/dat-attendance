/*
 * App/Permissions
 *
 * 役割:
 * - APIレイヤでのロールレベル判定を提供します（app DB を一次ソースとして参照）。
 * - authハンドラのロール付与には依存せず、getAuthData() は userID 取得にのみ利用します。
 *
 * 注意:
 * - 判定は都度DB参照します。必要に応じてキャッシュや集約取得で最適化可能です。
 */
import { APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { db } from "../../database";
import { secret } from "encore.dev/config";

// 簡易キャッシュ（プロセス内）。TTL経過で再取得。
const roleCache = new Map<string, { level: number; ts: number }>();
const ROLE_CACHE_TTL_SECRET = secret("USERS_ROLE_CACHE_TTL_MS");
function getCacheTtlMs(): number {
  try {
    const v = parseInt(ROLE_CACHE_TTL_SECRET());
    return Number.isFinite(v) && v > 0 ? v : 60_000;
  } catch {
    return 60_000;
  }
}

/**
 * ロールレベル定義
 */
export const RoleLevel = {
  SUPER_ADMIN: 1,  // スーパー管理者（開発者用）
  ADMIN: 2,        // 管理者（クライアント用）
  USER: 3,         // 一般ユーザー
} as const;

/**
 * 権限チェック関数
 * @param requiredLevel 必要な権限レベル
 * @returns 権限があればtrue
 */
/** 権限チェック（ロールレベル <= requiredLevel で可） */
export async function checkPermission(requiredLevel: number): Promise<boolean> {
  const authData = await getAuthData();
  if (!authData) return false;
  const level = await getRoleLevel(authData.userID);
  return level <= requiredLevel;
}

/**
 * 権限チェックとエラー処理
 * @param requiredLevel 必要な権限レベル
 * @throws APIError.permissionDenied 権限がない場合
 */
/** 強制チェック: 不足時は permissionDenied を送出 */
export async function requirePermission(requiredLevel: number): Promise<void> {
  const ok = await checkPermission(requiredLevel);
  if (!ok) throw APIError.permissionDenied("insufficient permissions");
}

/**
 * 特定ロールの確認
 * @param role ロール名
 * @returns 指定されたロールかどうか
 */
/** 指定ロール名と一致するか（app DB基準） */
export async function hasRole(role: string): Promise<boolean> {
  const authData = await getAuthData();
  if (!authData) return false;
  const row = await db.queryRow<{ name: string }>`
    SELECT r.name
    FROM app_users a LEFT JOIN roles r ON r.id = a.role_id
    WHERE a.id = ${authData.userID}
  `;
  return row?.name === role;
}

/**
 * スーパー管理者かどうか
 */
/** SUPER_ADMIN か */
export async function isSuperAdmin(): Promise<boolean> {
  return checkPermission(RoleLevel.SUPER_ADMIN);
}

/**
 * 管理者以上かどうか
 */
/** ADMIN 以上か */
export async function isAdmin(): Promise<boolean> {
  return checkPermission(RoleLevel.ADMIN);
}

/** 現在ユーザーのロールレベルを取得（未設定ならUSER=3） */
export async function getCurrentUserRoleLevel(): Promise<number> {
  const authData = await getAuthData();
  if (!authData) return RoleLevel.USER;
  return getRoleLevel(authData.userID);
}

/** 対象ユーザーのロールレベルを取得（未設定ならUSER=3） */
export async function getRoleLevel(userId: string): Promise<number> {
  const cached = roleCache.get(userId);
  const now = Date.now();
  const ttl = getCacheTtlMs();
  if (cached && now - cached.ts < ttl) {
    return cached.level;
  }
  const row = await db.queryRow<{ level: number }>`
    SELECT COALESCE(r.level, ${RoleLevel.USER}) as level
    FROM app_users a LEFT JOIN roles r ON r.id = a.role_id
    WHERE a.id = ${userId}
  `;
  const level = row?.level ?? RoleLevel.USER;
  roleCache.set(userId, { level, ts: now });
  return level;
}

/** キャッシュを明示的に無効化（ロール変更後など） */
export function invalidateRoleCache(userId?: string) {
  if (userId) roleCache.delete(userId);
  else roleCache.clear();
}
