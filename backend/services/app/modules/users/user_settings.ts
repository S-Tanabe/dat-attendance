/*
 * User Settings APIs
 *
 * 役割:
 * - 自分のプロフィール閲覧/更新、パスワード変更、アバターのアップロード/削除を提供。
 * - 認証はauth、プロフィールはapp DB、メールやパスワード更新はauthへ委譲します。
 */
import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { db } from "../../database";
import { uploadAvatar, deleteAvatar, getAvatarUrl } from "./storage";
import { auth } from "~encore/clients";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

// ユーザープロファイル型
export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  first_name?: string;
  last_name?: string;
  first_name_romaji?: string;
  last_name_romaji?: string;
  avatar_url?: string;
  avatar_bucket_key?: string;
  timezone?: string;
  language?: string;
  role?: {
    id: string;
    name: string;
    level: number;
  };
}

// プロファイル更新リクエスト
export interface UpdateProfileRequest {
  display_name?: string;
  first_name?: string;
  last_name?: string;
  first_name_romaji?: string;
  last_name_romaji?: string;
  timezone?: string;
  language?: string;
}

// パスワード変更リクエスト
export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

// アバターアップロードレスポンス
export interface UploadAvatarResponse {
  avatar_url: string;
  avatar_bucket_key: string;
}

/**
 * パスワードハッシュ生成（users側の便宜関数）。
 * - 実際の保存は auth.update_password に委譲（ハッシュ文字列を渡す設計）。
 */
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt}$${key.toString("hex")}`;
}

/**
 * パスワード検証（未使用）。
 * - 現在は auth.verify_user_password API を使用しており、本関数は使用されていません。
 * - 将来の削減候補ですが、互換維持のため現状は残置。
 */
async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts[0] !== "scrypt" || parts.length !== 6) return false;
  
  const [algo, N, r, p, salt, hex] = parts;
  const key = scryptSync(password, salt, 64, { 
    N: parseInt(N), 
    r: parseInt(r), 
    p: parseInt(p) 
  });
  const buf = Buffer.from(hex, "hex");
  return buf.length === key.length && timingSafeEqual(buf, key);
}

/**
 * 公開API: 自分のプロフィール取得
 * - users.app_users + roles からプロファイルを構築し、アバターURLは署名URLを動的生成。
 */
export const get_profile = api(
  { 
    expose: true, 
    method: "GET", 
    path: "/user-settings/profile",
    auth: true
  },
  async (): Promise<UserProfile> => {
    const auth = getAuthData();
    if (!auth) {
      throw APIError.unauthenticated("認証が必要です");
    }
    
    // ユーザー情報とロール情報を結合して取得
    const result = await db.query`
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
      WHERE ap.id = ${auth.userID}
    `;

    const user = await result.next();
    if (!user.value) {
      throw APIError.notFound("ユーザーが見つかりません");
    }

    const profile: UserProfile = {
      id: user.value.id,
      email: auth.email || '',
      display_name: user.value.display_name,
      first_name: user.value.first_name,
      last_name: user.value.last_name,
      first_name_romaji: user.value.first_name_romaji,
      last_name_romaji: user.value.last_name_romaji,
      avatar_url: undefined,  // 後で動的に生成
      avatar_bucket_key: user.value.avatar_bucket_key,
      timezone: user.value.timezone,
      language: user.value.language,
    };

    if (user.value.role_id) {
      profile.role = {
        id: user.value.role_id,
        name: user.value.role_name,
        level: user.value.role_level,
      };
    }

    // アバターバケットキーがある場合は署名付きURLを生成
    if (profile.avatar_bucket_key) {
      try {
        profile.avatar_url = await getAvatarUrl(profile.avatar_bucket_key);
      } catch (error) {
        console.error("Failed to get avatar URL:", error);
      }
    }

    return profile;
  }
);

/** 公開API: 自分のプロフィール更新 */
export const update_profile = api(
  { 
    expose: true, 
    method: "PUT", 
    path: "/user-settings/profile",
    auth: true
  },
  async (req: UpdateProfileRequest): Promise<UserProfile> => {
    const auth = getAuthData();
    if (!auth) {
      throw APIError.unauthenticated("認証が必要です");
    }
    
    // app_usersテーブルを更新
    await db.exec`
      UPDATE app_users
      SET 
        display_name = COALESCE(${req.display_name}, display_name),
        first_name = COALESCE(${req.first_name}, first_name),
        last_name = COALESCE(${req.last_name}, last_name),
        first_name_romaji = COALESCE(${req.first_name_romaji}, first_name_romaji),
        last_name_romaji = COALESCE(${req.last_name_romaji}, last_name_romaji),
        timezone = COALESCE(${req.timezone}, timezone),
        language = COALESCE(${req.language}, language),
        updated_at = now()
      WHERE id = ${auth.userID}
    `;

    // 更新後のプロファイルを取得して返す
    return await get_profile();
  }
);

/**
 * 公開API: 自分のパスワード変更
 * - 現在のパスワードをauthで検証 → 新パスワードハッシュをauthへ保存。
 * - new_passwordは8文字以上を要求。
 */
export const change_password = api(
  { 
    expose: true, 
    method: "POST", 
    path: "/user-settings/change-password",
    auth: true
  },
  async (req: ChangePasswordRequest): Promise<{ success: boolean }> => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("認証が必要です");
    }
    
    // 現在のパスワードをauthサービスで検証
    const validationResult = await auth.verify_user_password({
      id: authData.userID,
      password: req.current_password
    });
    
    if (!validationResult.valid) {
      throw APIError.invalidArgument("現在のパスワードが正しくありません");
    }

    // パスワードの検証
    if (req.new_password.length < 8) {
      throw APIError.invalidArgument("パスワードは8文字以上である必要があります");
    }

    // 新しいパスワードをハッシュ化
    const newPasswordHash = hashPassword(req.new_password);

    // authサービスでパスワードを更新
    const result = await auth.update_password({
      id: authData.userID,
      passwordHash: newPasswordHash
    });

    return result;
  }
);

/** 公開API: アバターアップロード（最大1MB, Base64） */
export const upload_avatar = api(
  { 
    expose: true, 
    method: "POST", 
    path: "/user-settings/avatar",
    auth: true,
    bodyLimit: 1 * 1024 * 1024, // 1MB制限
  },
  async (req: { data: string; contentType: string }): Promise<UploadAvatarResponse> => {
    const auth = getAuthData();
    if (!auth) {
      throw APIError.unauthenticated("認証が必要です");
    }

    // パラメータの検証
    if (!req.data) {
      throw APIError.invalidArgument("画像データが提供されていません");
    }
    
    if (!req.contentType) {
      throw APIError.invalidArgument("コンテンツタイプが提供されていません");
    }

    // Base64でエンコードされた画像データをBufferに変換
    let buffer: Buffer;
    try {
      buffer = Buffer.from(req.data, 'base64');
    } catch (error) {
      throw APIError.invalidArgument("画像データのデコードに失敗しました");
    }

    // コンテンツタイプの検証（画像のみ）
    if (!req.contentType.startsWith('image/')) {
      throw APIError.invalidArgument("画像ファイルのみアップロード可能です");
    }

    // 既存のアバターキーを取得
    const result = await db.query`
      SELECT avatar_bucket_key 
      FROM app_users 
      WHERE id = ${auth.userID}
    `;

    const user = await result.next();
    if (user.value && user.value.avatar_bucket_key) {
      // 既存のアバターを削除
      await deleteAvatar(user.value.avatar_bucket_key);
    }

    // 新しいアバターをアップロード
    const bucketKey = await uploadAvatar(auth.userID, buffer, req.contentType);
    
    try {
      // データベースを更新（avatar_urlカラムは使用しない、URLは動的に生成）
      await db.exec`
        UPDATE app_users
        SET 
          avatar_bucket_key = ${bucketKey},
          avatar_url = NULL,
          updated_at = now()
        WHERE id = ${auth.userID}
      `;

      // TODO: ログはencore.dev/logへ統一
      console.log(`Avatar DB update completed successfully for user ${auth.userID}`);
      
      // 署名付きURLを生成
      const avatarUrl = await getAvatarUrl(bucketKey);

      return {
        avatar_url: avatarUrl,
        avatar_bucket_key: bucketKey,
      };
    } catch (dbError: any) {
      // TODO: ログはencore.dev/logへ統一
      console.error(`Failed to update avatar in database for user ${auth.userID}:`, dbError);
      
      // DB更新が失敗した場合、アップロードしたファイルを削除
      try {
        await deleteAvatar(bucketKey);
        // TODO: ログはencore.dev/logへ統一
        console.log(`Cleaned up uploaded avatar file: ${bucketKey}`);
      } catch (cleanupError) {
        console.error(`Failed to cleanup avatar file ${bucketKey}:`, cleanupError);
      }
      
      throw APIError.internal(`アバターの保存に失敗しました: ${dbError.message}`);
    }
  }
);

/** 公開API: アバター削除 */
export const delete_avatar = api(
  { 
    expose: true, 
    method: "DELETE", 
    path: "/user-settings/avatar",
    auth: true
  },
  async (): Promise<{ success: boolean }> => {
    const auth = getAuthData();
    if (!auth) {
      throw APIError.unauthenticated("認証が必要です");
    }

    // 既存のアバターキーを取得
    const result = await db.query`
      SELECT avatar_bucket_key 
      FROM app_users 
      WHERE id = ${auth.userID}
    `;

    const user = await result.next();
    let deletedBucketKey: string | null = null;
    
    if (user.value && user.value.avatar_bucket_key) {
      try {
        // ストレージから削除
        await deleteAvatar(user.value.avatar_bucket_key);
        deletedBucketKey = user.value.avatar_bucket_key;
        // TODO: ログはencore.dev/logへ統一
        console.log(`Successfully deleted avatar from bucket: ${deletedBucketKey}`);
      } catch (error: any) {
        // TODO: ログはencore.dev/logへ統一
        console.error(`Failed to delete avatar from bucket: ${user.value.avatar_bucket_key}`, error);
        // バケット削除に失敗してもデータベースは更新する（孤立したレコードを防ぐ）
      }
    }

    // データベースを更新
    await db.exec`
      UPDATE app_users
      SET 
        avatar_bucket_key = NULL,
        avatar_url = NULL,
        updated_at = now()
      WHERE id = ${auth.userID}
    `;
    
    // TODO: ログはencore.dev/logへ統一
    console.log(`Avatar deletion completed for user ${auth.userID}`);

    return { success: true };
  }
);
