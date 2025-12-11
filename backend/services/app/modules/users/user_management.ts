/*
 * App Users Management APIs
 *
 * 役割:
 * - アプリ固有のユーザー一覧/詳細/作成/更新/論理削除/復活、ロール変更、強制ログアウト等を提供。
 * - 認証情報は auth サービスに委譲し、appはプロフィールとロール（app.roles）を管理。
 * - auth_users と app_users は同一UUIDで対応付け。
 *
 * 注意/既知の課題:
 * - 権限チェック(requirePermission)は app DB のロールを参照して判定します。
 *   （authハンドラのロール付与には依存しません）
 * - self操作（自分自身の削除/強制ログアウト/パスワードリセット）は禁止しています。
 * - 入力バリデーション（メール形式、必須項目、パスワード長など）が不足する箇所があります（TODO）。
 */
import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { db } from "../../database";
import { requirePermission, RoleLevel, getCurrentUserRoleLevel } from "./permissions";
import { auth } from "~encore/clients";
import log from "encore.dev/log";

/**
 * 内部API: app_usersレコードの作成
 * - 役割は app.roles から解決
 * - NOTE: 既存ID重複チェックはDB制約に依存（アプリ側でも事前確認を検討）。
 */
export const create_app_user = api<{ id: string; displayName: string; role?: string }, { id: string; displayName: string }>(
  { method: "POST", path: "/users/internal/create-app-user", expose: false },
  async ({ id, displayName, role = 'user' }) => {
    // Get role ID
    const roleResult = await db.queryRow<{ id: string }>`
      SELECT id FROM roles WHERE name = ${role}
    `;
    
    if (!roleResult) {
      throw APIError.notFound(`Role ${role} not found`);
    }
    
    await db.exec`
      INSERT INTO app_users (id, display_name, role_id)
      VALUES (${id}, ${displayName}, ${roleResult.id})
    `;
    
    log.info("app user created", { id, displayName, role });
    return { id, displayName };
  }
);

/** 内部API: app_usersレコード削除（補償用） */
export const delete_app_user = api<{ id: string }, { success: boolean }>(
  { method: "POST", path: "/users/internal/delete-app-user", expose: false },
  async ({ id }) => {
    await db.exec`DELETE FROM app_users WHERE id = ${id}`;
    log.info("app user deleted", { id });
    return { success: true };
  }
);

// Internal API for getting user profile
interface UserProfileResult {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  first_name_romaji: string | null;
  last_name_romaji: string | null;
  avatar_bucket_key: string | null;
  timezone: string | null;
  language: string | null;
  role_id: string | null;
  role_name: string | null;
  role_level: number | null;
}

/** 内部API: app_users + roles を結合した基本プロファイル取得 */
export const get_user_profile = api<{ id: string }, { profile: UserProfileResult | null }>(
  { method: "GET", path: "/users/internal/profile", expose: false },
  async ({ id }) => {
    const result = await db.queryRow<UserProfileResult>`
      SELECT 
        ap.id,
        ap.display_name,
        ap.first_name,
        ap.last_name,
        ap.first_name_romaji,
        ap.last_name_romaji,
        ap.avatar_bucket_key,
        ap.timezone,
        ap.language,
        r.id as role_id,
        r.name as role_name,
        r.level as role_level
      FROM app_users ap
      LEFT JOIN roles r ON ap.role_id = r.id
      WHERE ap.id = ${id}
    `;
    
    return { profile: result || null };
  }
);

/** ユーザー情報の型（一覧/詳細の応答） */
interface UserInfo {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  role_level: number;
  is_active: boolean;
  created_at: Date;
}

/**
 * 公開API: ユーザー一覧（管理者以上）
 * - app DBからロール付きで取得 → authサービスからemail/is_activeをバッチ補完。
 * - totalは全体件数（フィルター条件なし）。
 */
export const list_users = api<{ page?: number; limit?: number }, { users: UserInfo[]; total: number }>(
  { method: "GET", path: "/users/list", expose: true, auth: true },
  async ({ page = 1, limit = 20 }) => {
    // 管理者権限チェック
    await requirePermission(RoleLevel.ADMIN);
    
    const offset = (page - 1) * limit;
    
    // First get app_users with roles from app DB
    const appUsers: Array<{
      id: string;
      display_name: string | null;
      role: string;
      role_level: number;
      created_at: Date;
    }> = [];
    
    const result = db.query<{
      id: string;
      display_name: string | null;
      role: string;
      role_level: number;
      created_at: Date;
    }>`
      SELECT 
        a.id,
        a.display_name,
        r.name as role,
        r.level as role_level,
        a.created_at
      FROM app_users a
      LEFT JOIN roles r ON r.id = a.role_id
      ORDER BY a.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    
    for await (const row of result) {
      appUsers.push(row);
    }
    
    // Get auth user info in batch from auth service
    const userIds = appUsers.map(u => u.id);
    const authUsersResponse = await auth.get_users_batch({ ids: userIds });
    const authUsersMap = new Map(authUsersResponse.users.map(u => [u.id, u]));
    
    // Combine the data
    const users: UserInfo[] = appUsers.map(appUser => {
      const authUser = authUsersMap.get(appUser.id);
      return {
        id: appUser.id,
        email: authUser?.email || '',
        display_name: appUser.display_name,
        role: appUser.role,
        role_level: appUser.role_level,
        is_active: authUser?.is_active || false,
        created_at: appUser.created_at,
      };
    });
    
    const totalResult = await db.queryRow<{ count: bigint }>`
      SELECT COUNT(*) as count FROM app_users
    `;
    
    log.info("list_users query result", { 
      usersCount: users.length,
      users: users,
      total: totalResult?.count 
    });
    
    return {
      users: users,
      total: Number(totalResult?.count) || 0,
    };
  }
);

  /** 公開API: アクティブ/非アクティブ切替（SUPER_ADMINのみ） */
export const change_user_status = api<{ userId: string; isActive: boolean }, { success: boolean }>(
  { method: "POST", path: "/users/:userId/status", expose: true, auth: true },
  async ({ userId, isActive }) => {
    // スーパー管理者権限チェック
    await requirePermission(RoleLevel.SUPER_ADMIN);
    
    // ユーザーの存在確認（app_usersで確認）
    const user = await db.queryRow<{ id: string }>`
      SELECT id FROM app_users WHERE id = ${userId}
    `;
    
    if (!user) {
      throw APIError.notFound("user not found");
    }
    
    // authサービスを呼び出してステータス更新
    const result = await auth.update_user_status({ id: userId, isActive });
    
    log.info("user status changed", { 
      userId, 
      isActive 
    });
    
    return result;
  }
);

  /** 公開API: ロール変更（SUPER_ADMINのみ） */
export const update_user_role = api<{ userId: string; roleName: string }, { success: boolean }>(
  { method: "POST", path: "/users/:userId/role", expose: true, auth: true },
  async ({ userId, roleName }) => {
    // スーパー管理者権限チェック
    await requirePermission(RoleLevel.SUPER_ADMIN);
    
    // ロールの存在確認
    const role = await db.queryRow<{ id: string; level: number }>`
      SELECT id, level FROM roles WHERE name = ${roleName}
    `;
    
    if (!role) {
      throw APIError.invalidArgument("invalid role");
    }
    
    // ユーザーの存在確認
    const user = await db.queryRow<{ id: string }>`
      SELECT id FROM app_users WHERE id = ${userId}
    `;
    
    if (!user) {
      throw APIError.notFound("user not found");
    }
    
    // ロール更新
    await db.exec`
      UPDATE app_users 
      SET role_id = ${role.id}, updated_at = now()
      WHERE id = ${userId}
    `;
    // キャッシュ無効化
    ;(await import("./permissions")).invalidateRoleCache(userId);
    
    log.info("user role updated", { 
      userId, 
      roleName,
      roleLevel: role.level
    });
    
    return { success: true };
  }
);

/** 公開API: ユーザー詳細（管理者以上） */
export const get_user_detail = api<{ userId: string }, { user: UserInfo }>(
  { method: "GET", path: "/users/:userId", expose: true, auth: true },
  async ({ userId }) => {
    // 管理者権限チェック
    await requirePermission(RoleLevel.ADMIN);
    
    // Get app_user info
    const appUser = await db.queryRow<{
      id: string;
      display_name: string | null;
      role: string;
      role_level: number;
      created_at: Date;
    }>`
      SELECT 
        a.id,
        a.display_name,
        r.name as role,
        r.level as role_level,
        a.created_at
      FROM app_users a
      LEFT JOIN roles r ON r.id = a.role_id
      WHERE a.id = ${userId}
    `;
    
    if (!appUser) {
      throw APIError.notFound("user not found");
    }
    
    // Get auth user info
    const authUsersResponse = await auth.get_users_batch({ ids: [userId] });
    const authUser = authUsersResponse.users[0];
    
    const user: UserInfo = {
      id: appUser.id,
      email: authUser?.email || '',
      display_name: appUser.display_name,
      role: appUser.role,
      role_level: appUser.role_level,
      is_active: authUser?.is_active || false,
      created_at: appUser.created_at,
    };
    
    return { user };
  }
);

/** 公開API: ロール一覧（管理者以上） */
export const list_roles = api<void, { roles: Array<{ name: string; level: number; description: string }> }>(
  { method: "GET", path: "/users/roles", expose: true, auth: true },
  async () => {
    // 管理者権限チェック
    await requirePermission(RoleLevel.ADMIN);
    
    // db.query returns an async iterator
    const roles: Array<{ name: string; level: number; description: string }> = [];
    const result = db.query<{ name: string; level: number; description: string }>`
      SELECT name, level, description 
      FROM roles 
      ORDER BY level ASC
    `;
    
    // Iterate through the results  
    for await (const row of result) {
      roles.push(row);
    }
    
    log.info("list_roles query result", { 
      rolesCount: roles.length,
      roles: roles 
    });
    
    return { roles: roles };
  }
);

/**
 * 公開API: ユーザー削除（論理削除, 管理者以上）
 * - FIXME: 自分自身の削除禁止チェックが未実装（testsにも要件あり）。
 * - FIXME: ログの `auth.getAuthData()` 呼び出しは誤り。`getAuthData()` を使用すること。
 */
export const delete_user = api<{ userId: string }, { success: boolean }>(
  { method: "DELETE", path: "/users/:userId", expose: true, auth: true },
  async ({ userId }) => {
    // 管理者権限チェック
    await requirePermission(RoleLevel.ADMIN);

    // 自分自身の削除は禁止
    const authData = await getAuthData();
    if (authData?.userID === userId) {
      throw APIError.invalidArgument("Cannot delete your own account");
    }
    
    // ユーザーの存在確認
    const user = await db.queryRow<{ id: string; role: string; role_level: number }>`
      SELECT 
        a.id,
        r.name as role,
        r.level as role_level
      FROM app_users a
      LEFT JOIN roles r ON r.id = a.role_id
      WHERE a.id = ${userId}
    `;
    
    if (!user) {
      throw APIError.notFound("user not found");
    }
    
    // 権限チェック: super_adminのみがadmin以上を削除可能
    const myLevel = await getCurrentUserRoleLevel();
    if (user.role_level >= RoleLevel.ADMIN && myLevel !== RoleLevel.SUPER_ADMIN) {
      throw APIError.permissionDenied("Only super_admin can delete admin users");
    }
    
    // authサービスを呼び出してユーザーを非アクティブ化（論理削除）
    const result = await auth.update_user_status({ id: userId, isActive: false });
    
    log.info("user deleted (logical)", { userId, deletedBy: authData?.userID });
    
    return result;
  }
);

/** 公開API: ユーザー復活（管理者以上） */
export const restore_user = api<{ userId: string }, { success: boolean }>(
  { method: "POST", path: "/users/:userId/restore", expose: true, auth: true },
  async ({ userId }) => {
    // 管理者権限チェック
    await requirePermission(RoleLevel.ADMIN);
    
    // ユーザーの存在確認
    const user = await db.queryRow<{ id: string }>`
      SELECT id FROM app_users WHERE id = ${userId}
    `;
    
    if (!user) {
      throw APIError.notFound("user not found");
    }
    
    // authサービスを呼び出してユーザーをアクティブ化（復活）
    const result = await auth.update_user_status({ id: userId, isActive: true });
    
    const authData = await getAuthData();
    log.info("user restored", { userId, restoredBy: authData?.userID });
    
    return result;
  }
);

/**
 * 公開API: ユーザー更新（管理者以上）
 * - TODO: email形式/必須項目の検証を追加。
 * - NOTE: email更新はauthサービスへ委譲。
 */
export const update_user = api<{
  userId: string;
  email?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  firstNameRomaji?: string;
  lastNameRomaji?: string;
  timezone?: string;
  language?: string;
  roleName?: string;
}, { success: boolean }>(
  { method: "PUT", path: "/users/:userId", expose: true, auth: true },
  async ({ userId, email, displayName, firstName, lastName, firstNameRomaji, lastNameRomaji, timezone, language, roleName }) => {
    // 管理者権限チェック
    await requirePermission(RoleLevel.ADMIN);

    // emailの形式チェック（提供された場合）
    if (email !== undefined) {
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(email)) {
        throw APIError.invalidArgument("Invalid email format");
      }
    }
    
    // ユーザーの存在確認
    const user = await db.queryRow<{ id: string; role_level: number }>`
      SELECT 
        a.id,
        r.level as role_level
      FROM app_users a
      LEFT JOIN roles r ON r.id = a.role_id
      WHERE a.id = ${userId}
    `;
    
    if (!user) {
      throw APIError.notFound("user not found");
    }
    
    // ロール変更の権限チェック
    if (roleName) {
      const myLevel = await getCurrentUserRoleLevel();
      const newRole = await db.queryRow<{ level: number }>`
        SELECT level FROM roles WHERE name = ${roleName}
      `;
      
      if (!newRole) {
        throw APIError.invalidArgument("invalid role");
      }
      
      // super_adminのみがadmin以上のロールを変更可能
      if ((user.role_level >= RoleLevel.ADMIN || newRole.level >= RoleLevel.ADMIN) && 
          myLevel !== RoleLevel.SUPER_ADMIN) {
        throw APIError.permissionDenied("Only super_admin can change admin roles");
      }
    }
    
    // app_usersテーブルの更新
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramCount = 1;
    
    if (displayName !== undefined) {
      updateFields.push(`display_name = $${paramCount++}`);
      updateValues.push(displayName);
    }
    if (firstName !== undefined) {
      updateFields.push(`first_name = $${paramCount++}`);
      updateValues.push(firstName);
    }
    if (lastName !== undefined) {
      updateFields.push(`last_name = $${paramCount++}`);
      updateValues.push(lastName);
    }
    if (firstNameRomaji !== undefined) {
      updateFields.push(`first_name_romaji = $${paramCount++}`);
      updateValues.push(firstNameRomaji);
    }
    if (lastNameRomaji !== undefined) {
      updateFields.push(`last_name_romaji = $${paramCount++}`);
      updateValues.push(lastNameRomaji);
    }
    if (timezone !== undefined) {
      updateFields.push(`timezone = $${paramCount++}`);
      updateValues.push(timezone);
    }
    if (language !== undefined) {
      updateFields.push(`language = $${paramCount++}`);
      updateValues.push(language);
    }
    if (roleName !== undefined) {
      const role = await db.queryRow<{ id: string }>`
        SELECT id FROM roles WHERE name = ${roleName}
      `;
      if (role) {
        updateFields.push(`role_id = $${paramCount++}`);
        updateValues.push(role.id);
      }
    }
    
    if (updateFields.length > 0) {
      updateFields.push(`updated_at = now()`);
      updateValues.push(userId);
      
      const query = `UPDATE app_users SET ${updateFields.join(', ')} WHERE id = $${paramCount}`;
      await db.rawExec(query, ...updateValues);
      if (roleName !== undefined) {
        ;(await import("./permissions")).invalidateRoleCache(userId);
      }
    }
    
    // emailの更新はauthサービスで行う（バリデーション済み）
    if (email) {
      await auth.update_user_email({ id: userId, email });
    }
    
    const authData = await getAuthData();
    log.info("user updated", { userId, updatedBy: authData?.userID, updates: { email, displayName, firstName, lastName, roleName } });
    
    return { success: true };
  }
);

/**
 * 公開API: 新規ユーザー作成（管理者以上）
 * - users: app_users INSERT、auth: auth_users 作成。
 * - TODO: email必須/形式・password長(>=8)の検証を追加（tests要件あり）。
 */
export const create_user = api<{
  email: string;
  password: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  firstNameRomaji?: string;
  lastNameRomaji?: string;
  timezone?: string;
  language?: string;
  roleName?: string;
}, { userId: string }>(
  { method: "POST", path: "/users", expose: true, auth: true },
  async ({ email, password, displayName, firstName, lastName, firstNameRomaji, lastNameRomaji, timezone, language, roleName = 'user' }) => {
    // 管理者権限チェック
    await requirePermission(RoleLevel.ADMIN);

    // 必須・形式の検証
    if (!email || !password || !displayName) {
      throw APIError.invalidArgument("Email, password, and display name are required");
    }
    if (password.length < 8) {
      throw APIError.invalidArgument("Password must be at least 8 characters");
    }
    
    // ロールの存在確認
    const role = await db.queryRow<{ id: string; level: number }>`
      SELECT id, level FROM roles WHERE name = ${roleName}
    `;
    
    if (!role) {
      throw APIError.invalidArgument("invalid role");
    }
    
    // 権限チェック: super_adminのみがadmin以上を作成可能
    const myLevel = await getCurrentUserRoleLevel();
    if (role.level === RoleLevel.SUPER_ADMIN && myLevel !== RoleLevel.SUPER_ADMIN) {
      throw APIError.permissionDenied("Only super_admin can create super_admin users");
    }
    
    // authサービスでユーザー作成 → app側INSERT（失敗時は補償）
    const authResult = await auth.create_auth_user({ email, password });
    try {
      await db.exec`
        INSERT INTO app_users (
          id, display_name, first_name, last_name, first_name_romaji, last_name_romaji,
          timezone, language, role_id, created_at, updated_at
        ) VALUES (
          ${authResult.userId}, ${displayName}, ${firstName || null}, ${lastName || null},
          ${firstNameRomaji || null}, ${lastNameRomaji || null}, ${timezone || 'Asia/Tokyo'},
          ${language || 'ja'}, ${role.id}, now(), now()
        )
      `;
    } catch (e) {
      // 補償SAGA: authユーザーを削除
      try { await auth.delete_auth_user({ id: authResult.userId }); } catch {}
      throw e;
    }
    
    const authData = await getAuthData();
    log.info("user created", { userId: authResult.userId, email, displayName, roleName, createdBy: authData?.userID });
    
    return { userId: authResult.userId };
  }
);

/**
 * 公開API: 管理者によるユーザーパスワードリセット（管理者以上）
 * - TODO: newPassword長の検証と「自分自身は不可」のチェック（tests要件）を追加。
 */
export const reset_password = api<{ userId: string; newPassword: string }, { success: boolean }>(
  { method: "POST", path: "/users/:userId/password-reset", expose: true, auth: true },
  async ({ userId, newPassword }) => {
    // 管理者権限チェック
    await requirePermission(RoleLevel.ADMIN);

    // 自分自身のパスワードリセットは禁止
    const authData = await getAuthData();
    if (authData?.userID === userId) {
      throw APIError.invalidArgument("Cannot reset your own password");
    }

    if (newPassword.length < 8) {
      throw APIError.invalidArgument("Password must be at least 8 characters");
    }
    
    // ユーザーの存在確認とロールレベル取得
    const user = await db.queryRow<{ id: string; role_level: number }>`
      SELECT 
        a.id,
        r.level as role_level
      FROM app_users a
      LEFT JOIN roles r ON r.id = a.role_id
      WHERE a.id = ${userId}
    `;
    
    if (!user) {
      throw APIError.notFound("user not found");
    }
    
    // 権限チェック: super_adminのみがadmin以上のパスワードをリセット可能
    const myLevel = await getCurrentUserRoleLevel();
    if (user.role_level >= RoleLevel.ADMIN && myLevel !== RoleLevel.SUPER_ADMIN) {
      throw APIError.permissionDenied("Only super_admin can reset admin passwords");
    }
    
    // authサービスでパスワードリセット
    const result = await auth.reset_user_password({ userId, newPassword });
    
    log.info("user password reset", { userId, resetBy: authData?.userID });
    
    return result;
  }
);

/** 公開API: ユーザーセッション一覧（管理者以上） */
export const get_user_sessions = api<{ userId: string }, { sessions: any[] }>(
  { method: "GET", path: "/users/:userId/sessions", expose: true, auth: true },
  async ({ userId }) => {
    // 管理者権限チェック
    await requirePermission(RoleLevel.ADMIN);
    
    // ユーザーの存在確認
    const user = await db.queryRow<{ id: string }>`
      SELECT id FROM app_users WHERE id = ${userId}
    `;
    
    if (!user) {
      throw APIError.notFound("user not found");
    }
    
    // authサービスからセッション情報取得
    const result = await auth.get_user_sessions({ userId });
    
    return result;
  }
);

/**
 * 公開API: 全セッション無効化（強制ログアウト, 管理者以上）
 * - TODO: 自分自身の強制ログアウトは禁止（tests要件）
 */
export const force_logout = api<{ userId: string }, { success: boolean; revoked_count: number }>(
  { method: "POST", path: "/users/:userId/force-logout", expose: true, auth: true },
  async ({ userId }) => {
    // 管理者権限チェック
    await requirePermission(RoleLevel.ADMIN);

    // 自分自身の強制ログアウトは禁止
    const authData = await getAuthData();
    if (authData?.userID === userId) {
      throw APIError.invalidArgument("Cannot force logout your own account");
    }
    
    // ユーザーの存在確認とロールレベル取得
    const user = await db.queryRow<{ id: string; role_level: number }>`
      SELECT 
        a.id,
        r.level as role_level
      FROM app_users a
      LEFT JOIN roles r ON r.id = a.role_id
      WHERE a.id = ${userId}
    `;
    
    if (!user) {
      throw APIError.notFound("user not found");
    }
    
    // 権限チェック: super_adminのみがadmin以上を強制ログアウト可能
    const myLevel = await getCurrentUserRoleLevel();
    if (user.role_level >= RoleLevel.ADMIN && myLevel !== RoleLevel.SUPER_ADMIN) {
      throw APIError.permissionDenied("Only super_admin can force logout admin users");
    }
    
    // authサービスで全セッション無効化
    const result = await auth.revoke_user_sessions({ userId });
    
    log.info("user force logout", { userId, revokedCount: result.revoked_count, forcedBy: authData?.userID });
    
    return {
      success: true,
      revoked_count: result.revoked_count
    };
  }
);
