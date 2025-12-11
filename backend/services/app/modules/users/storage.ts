/*
 * Object Storage (Avatars)
 *
 * 役割:
 * - アバター画像の保存/削除/署名付きURL発行を行います。
 * - バケットは非公開(public=false)のため、閲覧には署名URLが必要です。
 *
 * 注意:
 * - ログは console ではなく encore.dev/log へ統一するのが望ましい（TODO）。
 */
import { Bucket } from "encore.dev/storage/objects";

// アバター用プライベートバケット
export const avatarBucket = new Bucket("avatars", {
  versioned: false,
  public: false,
});

/** アバター画像をアップロードし、バケットキーを返す */
export async function uploadAvatar(
  userId: string,
  data: Buffer,
  contentType: string
): Promise<string> {
  const key = `${userId}/avatar-${Date.now()}`;
  await avatarBucket.upload(key, data, { contentType });
  return key;
}

/** アバターを削除（存在しない場合は無視） */
export async function deleteAvatar(key: string): Promise<void> {
  try {
    await avatarBucket.remove(key);
  } catch (error) {
    // NOTE: 存在しない等は無視（冪等性確保）。
    console.log(`Avatar not found or already deleted: ${key}`);
  }
}

/** 署名付きダウンロードURLを発行（有効期限: 1時間） */
export async function getAvatarUrl(key: string): Promise<string> {
  try {
    const urlObj = await avatarBucket.signedDownloadUrl(key, { ttl: 3600 });
    return urlObj.url; // Encoreの戻り値は { url: string }
  } catch (error) {
    throw new Error(`Failed to generate avatar URL: ${error}`);
  }
}
