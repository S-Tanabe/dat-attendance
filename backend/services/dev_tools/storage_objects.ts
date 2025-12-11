import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import log from "encore.dev/log";
import type { BucketCapabilities } from "./storage_buckets";
import { getBucketDescriptor, listBucketDescriptors, resolveBucket } from "./storage_buckets";
import { hasBucketPermission, resolveBucketAccess } from "./storage_permissions";
import { recordAdminAction } from "./audit_log";
import { app } from "~encore/clients";

interface BucketSummary {
  id: string;
  bucketName: string;
  label: string;
  description?: string;
  defaultPrefix?: string;
  capabilities: BucketCapabilities;
}

interface DirectoryEntry {
  key: string;
  name: string;
}

interface ObjectEntry {
  key: string;
  name: string;
  size: number;
  etag: string;
  contentType?: string;
}

interface ListBucketsResponse {
  buckets: BucketSummary[];
}

interface ListObjectsRequest {
  bucketId: string;
  prefix?: string;
  limit?: number;
}

interface ListObjectsResponse {
  bucketId: string;
  prefix: string;
  directories: DirectoryEntry[];
  objects: ObjectEntry[];
}

interface GenerateSignedUrlRequest {
  bucketId: string;
  key: string;
  ttlSeconds?: number;
}

interface GenerateSignedUrlResponse {
  url: string;
  expiresIn: number;
}

interface GenerateUploadUrlRequest extends GenerateSignedUrlRequest {
  contentType?: string;
}

interface DeleteObjectsRequest {
  bucketId: string;
  keys: string[];
}

interface DeleteObjectsResponse {
  deleted: string[];
  failed: Array<{ key: string; error: string }>;
}

interface CreatePrefixRequest {
  bucketId: string;
  prefix: string;
}

interface CreatePrefixResponse {
  key: string;
}

interface ObjectMetadataRequest {
  bucketId: string;
  key: string;
}

interface ObjectMetadataResponse {
  key: string;
  size: number;
  etag: string;
  contentType?: string;
  version?: string;
}

const MAX_SIGNED_URL_TTL = 7 * 24 * 60 * 60; // 7 days
const MIN_SIGNED_URL_TTL = 60; // 1 minute
const DEFAULT_SIGNED_URL_TTL = 60 * 30; // 30 minutes
const MAX_LIST_LIMIT = 500;

async function getCurrentUserRole(): Promise<{ userId: string; role: string | null }> {
  const authData = getAuthData();
  if (!authData?.userID) {
    throw APIError.unauthenticated("認証情報が見つかりません");
  }

  const { profile } = await app.get_user_profile({ id: authData.userID });
  const role = profile?.role_name ?? null;
  return { userId: authData.userID, role };
}

function buildBucketSummaries(role: string | null): BucketSummary[] {
  const summaries: BucketSummary[] = [];
  for (const descriptor of listBucketDescriptors()) {
    const access = resolveBucketAccess(role, descriptor.id);
    if (!access) continue;
    if (!access.read && !access.write && !access.destroy && !access.createPrefix) {
      continue;
    }
    summaries.push({
      id: descriptor.id,
      bucketName: descriptor.bucketName,
      label: descriptor.label,
      description: descriptor.description,
      defaultPrefix: descriptor.defaultPrefix,
      capabilities: access,
    });
  }
  return summaries;
}

function sanitizePrefix(prefix?: string): string {
  if (!prefix) return "";
  const normalized = prefix.replace(/^\/+/, "");
  if (normalized.includes("..")) {
    throw APIError.invalidArgument("プレフィックスに '..' を含めることはできません");
  }
  return normalized;
}

function sanitizeKey(key: string): string {
  if (!key) {
    throw APIError.invalidArgument("キーが指定されていません");
  }
  if (key.startsWith("/")) {
    key = key.slice(1);
  }
  if (key.includes("..")) {
    throw APIError.invalidArgument("キーに '..' を含めることはできません");
  }
  return key;
}

function normalizeTtl(ttlSeconds: number | undefined): number {
  if (!ttlSeconds) return DEFAULT_SIGNED_URL_TTL;
  if (!Number.isFinite(ttlSeconds)) {
    throw APIError.invalidArgument("TTL が不正です");
  }
  const clamped = Math.max(MIN_SIGNED_URL_TTL, Math.min(MAX_SIGNED_URL_TTL, Math.floor(ttlSeconds)));
  return clamped;
}

export const list_available_buckets = api<void, ListBucketsResponse>(
  { method: "GET", path: "/dev_tools/storage/buckets", expose: true, auth: true },
  async () => {
    const { userId, role } = await getCurrentUserRole();
    const buckets = buildBucketSummaries(role);
    await recordAdminAction({
      actor_user_id: userId,
      action: "list_storage_buckets",
      target_type: "storage",
      target_id: "*",
      payload: { bucket_count: buckets.length },
      success: true,
      severity: "info",
    });
    return { buckets };
  },
);

export const list_objects = api<ListObjectsRequest, ListObjectsResponse>(
  { method: "GET", path: "/dev_tools/storage/objects", expose: true, auth: true },
  async ({ bucketId, prefix = "", limit = 200 }) => {
    const { userId, role } = await getCurrentUserRole();
    const descriptor = getBucketDescriptor(bucketId);
    if (!descriptor) {
      throw APIError.notFound("指定されたバケットが存在しません");
    }

    if (!hasBucketPermission(role, bucketId, "read")) {
      throw APIError.permissionDenied("バケットへの読み取り権限がありません");
    }

    const sanitizedPrefix = sanitizePrefix(prefix);
    const safeLimit = Math.max(1, Math.min(MAX_LIST_LIMIT, limit));

    const directories = new Map<string, DirectoryEntry>();
    const objects: ObjectEntry[] = [];
    const bucket = resolveBucket(bucketId);
    if (!bucket) {
      throw APIError.internal("バケットハンドルの解決に失敗しました");
    }

    let count = 0;
    try {
      for await (const entry of bucket.list({ prefix: sanitizedPrefix })) {
        if (count >= safeLimit) {
          break;
        }
        const fullName = entry.name;
        const relativeName = sanitizedPrefix ? fullName.slice(sanitizedPrefix.length) : fullName;
        if (!relativeName) continue;

        const slashIndex = relativeName.indexOf("/");
        if (slashIndex !== -1) {
          const dirKey = sanitizedPrefix + relativeName.slice(0, slashIndex + 1);
          if (!directories.has(dirKey)) {
            directories.set(dirKey, {
              key: dirKey,
              name: relativeName.slice(0, slashIndex),
            });
          }
          continue;
        }

        // 実ファイル
        let contentType: string | undefined;
        try {
          const attrs = await bucket.attrs(fullName);
          contentType = attrs.contentType;
        } catch (err) {
          log.warn("Failed to fetch object attrs", {
            bucket: descriptor.bucketName,
            key: fullName,
            error: err,
          });
        }

        objects.push({
          key: fullName,
          name: relativeName,
          size: entry.size,
          etag: entry.etag,
          contentType,
        });
        count += 1;
      }
    } catch (error) {
      log.error("Failed to list objects", { bucket: descriptor.bucketName, prefix: sanitizedPrefix, error });
      throw APIError.internal("オブジェクト一覧の取得に失敗しました");
    }

    await recordAdminAction({
      actor_user_id: userId,
      action: "list_storage_objects",
      target_type: "storage",
      target_id: descriptor.bucketName,
      payload: { prefix: sanitizedPrefix, count: objects.length },
      success: true,
      severity: "info",
    });

    return {
      bucketId,
      prefix: sanitizedPrefix,
      directories: Array.from(directories.values()).sort((a, b) => a.key.localeCompare(b.key)),
      objects,
    };
  },
);

export const generate_download_url = api<GenerateSignedUrlRequest, GenerateSignedUrlResponse>(
  { method: "POST", path: "/dev_tools/storage/download-url", expose: true, auth: true },
  async ({ bucketId, key, ttlSeconds }) => {
    const { userId, role } = await getCurrentUserRole();
    const descriptor = getBucketDescriptor(bucketId);
    if (!descriptor) {
      throw APIError.notFound("指定されたバケットが存在しません");
    }
    if (!hasBucketPermission(role, bucketId, "read")) {
      throw APIError.permissionDenied("ダウンロード権限がありません");
    }
    const sanitizedKey = sanitizeKey(key);
    const ttl = normalizeTtl(ttlSeconds);

    const bucket = resolveBucket(bucketId);
    if (!bucket) {
      throw APIError.internal("バケットハンドルの解決に失敗しました");
    }

    try {
      const signed = await bucket.signedDownloadUrl(sanitizedKey, { ttl });
      await recordAdminAction({
        actor_user_id: userId,
        action: "generate_download_url",
        target_type: "storage",
        target_id: descriptor.bucketName,
        payload: { key: sanitizedKey, ttl },
        success: true,
        severity: "info",
      });
      return { url: signed.url, expiresIn: ttl };
    } catch (error) {
      log.error("Failed to generate download URL", { bucket: descriptor.bucketName, key: sanitizedKey, error });
      throw APIError.internal("署名付きURLの生成に失敗しました");
    }
  },
);

export const generate_upload_url = api<GenerateUploadUrlRequest, GenerateSignedUrlResponse>(
  { method: "POST", path: "/dev_tools/storage/upload-url", expose: true, auth: true },
  async ({ bucketId, key, ttlSeconds, contentType }) => {
    const { userId, role } = await getCurrentUserRole();
    const descriptor = getBucketDescriptor(bucketId);
    if (!descriptor) {
      throw APIError.notFound("指定されたバケットが存在しません");
    }
    if (!hasBucketPermission(role, bucketId, "write")) {
      throw APIError.permissionDenied("アップロード権限がありません");
    }
    const sanitizedKey = sanitizeKey(key);
    const ttl = normalizeTtl(ttlSeconds);

    const bucket = resolveBucket(bucketId);
    if (!bucket) {
      throw APIError.internal("バケットハンドルの解決に失敗しました");
    }

    try {
      const signed = await bucket.signedUploadUrl(sanitizedKey, { ttl });
      await recordAdminAction({
        actor_user_id: userId,
        action: "generate_upload_url",
        target_type: "storage",
        target_id: descriptor.bucketName,
        payload: { key: sanitizedKey, ttl, contentType },
        success: true,
        severity: "info",
      });
      return { url: signed.url, expiresIn: ttl };
    } catch (error) {
      log.error("Failed to generate upload URL", { bucket: descriptor.bucketName, key: sanitizedKey, error });
      throw APIError.internal("アップロードURLの生成に失敗しました");
    }
  },
);

export const delete_objects = api<DeleteObjectsRequest, DeleteObjectsResponse>(
  { method: "POST", path: "/dev_tools/storage/delete", expose: true, auth: true },
  async ({ bucketId, keys }) => {
    const { userId, role } = await getCurrentUserRole();
    const descriptor = getBucketDescriptor(bucketId);
    if (!descriptor) {
      throw APIError.notFound("指定されたバケットが存在しません");
    }
    if (!hasBucketPermission(role, bucketId, "destroy")) {
      throw APIError.permissionDenied("削除権限がありません");
    }
    if (!Array.isArray(keys) || keys.length === 0) {
      throw APIError.invalidArgument("削除するキーを指定してください");
    }

    const bucket = resolveBucket(bucketId);
    if (!bucket) {
      throw APIError.internal("バケットハンドルの解決に失敗しました");
    }

    const deleted: string[] = [];
    const failed: Array<{ key: string; error: string }> = [];

    const addDeleted = (key: string) => {
      if (!deleted.includes(key)) {
        deleted.push(key);
      }
    };

    const deleteFile = async (rawKey: string, sanitizedKey: string) => {
      try {
        await bucket.remove(sanitizedKey);
        addDeleted(sanitizedKey);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failed.push({ key: rawKey, error: message });
        log.error("Failed to delete object", { bucket: descriptor.bucketName, key: sanitizedKey, error });
      }
    };

    const deletePrefix = async (rawKey: string, sanitizedKey: string) => {
      const normalized = sanitizedKey.endsWith("/") ? sanitizedKey : `${sanitizedKey}/`;
      const childKeys = new Set<string>();

      try {
        for await (const entry of bucket.list({ prefix: normalized })) {
          childKeys.add(entry.name);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failed.push({ key: rawKey, error: message });
        log.error("Failed to list objects for prefix deletion", {
          bucket: descriptor.bucketName,
          prefix: normalized,
          error,
        });
        return;
      }

      let prefixFailed = false;

      for (const childKey of childKeys) {
        try {
          await bucket.remove(childKey);
          addDeleted(childKey);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          failed.push({ key: childKey, error: message });
          log.error("Failed to delete object inside prefix", {
            bucket: descriptor.bucketName,
            key: childKey,
            error,
          });
          prefixFailed = true;
        }
      }

      try {
        await bucket.remove(normalized);
        addDeleted(normalized);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!/NoSuchKey|NotFound|404/i.test(message)) {
          failed.push({ key: rawKey, error: message });
          log.error("Failed to delete directory marker", {
            bucket: descriptor.bucketName,
            key: normalized,
            error,
          });
          prefixFailed = true;
        }
      }

      if (!prefixFailed) {
        const summaryKey = rawKey.endsWith("/") ? rawKey : `${rawKey}/`;
        addDeleted(summaryKey);
      }
    };

    for (const raw of keys) {
      const rawKey = typeof raw === "string" ? raw : String(raw);
      try {
        const sanitized = sanitizeKey(rawKey);
        if (sanitized.endsWith("/")) {
          await deletePrefix(rawKey, sanitized);
        } else {
          await deleteFile(rawKey, sanitized);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failed.push({ key: rawKey, error: message });
        log.error("Failed to process delete request", {
          bucket: descriptor.bucketName,
          key: rawKey,
          error,
        });
      }
    }

    await recordAdminAction({
      actor_user_id: userId,
      action: "delete_storage_objects",
      target_type: "storage",
      target_id: descriptor.bucketName,
      payload: { deletedCount: deleted.length, failedCount: failed.length },
      success: failed.length === 0,
      severity: failed.length === 0 ? "info" : "warning",
    });

    return { deleted, failed };
  },
);

export const create_prefix = api<CreatePrefixRequest, CreatePrefixResponse>(
  { method: "POST", path: "/dev_tools/storage/prefix", expose: true, auth: true },
  async ({ bucketId, prefix }) => {
    const { userId, role } = await getCurrentUserRole();
    const descriptor = getBucketDescriptor(bucketId);
    if (!descriptor) {
      throw APIError.notFound("指定されたバケットが存在しません");
    }
    if (!hasBucketPermission(role, bucketId, "createPrefix")) {
      throw APIError.permissionDenied("ディレクトリ作成権限がありません");
    }
    let sanitized = sanitizePrefix(prefix);
    if (!sanitized.endsWith("/")) {
      sanitized = `${sanitized}/`;
    }

    const bucket = resolveBucket(bucketId);
    if (!bucket) {
      throw APIError.internal("バケットハンドルの解決に失敗しました");
    }

    try {
      await bucket.upload(sanitized, Buffer.alloc(0), {
        contentType: "application/x-directory",
        preconditions: { notExists: true },
      });
      await recordAdminAction({
        actor_user_id: userId,
        action: "create_storage_prefix",
        target_type: "storage",
        target_id: descriptor.bucketName,
        payload: { prefix: sanitized },
        success: true,
        severity: "info",
      });
      return { key: sanitized };
    } catch (error) {
      log.error("Failed to create prefix", { bucket: descriptor.bucketName, prefix: sanitized, error });
      throw APIError.internal("プレフィックスの作成に失敗しました");
    }
  },
);

export const get_object_metadata = api<ObjectMetadataRequest, ObjectMetadataResponse>(
  { method: "GET", path: "/dev_tools/storage/object", expose: true, auth: true },
  async ({ bucketId, key }) => {
    const { userId, role } = await getCurrentUserRole();
    const descriptor = getBucketDescriptor(bucketId);
    if (!descriptor) {
      throw APIError.notFound("指定されたバケットが存在しません");
    }
    if (!hasBucketPermission(role, bucketId, "read")) {
      throw APIError.permissionDenied("メタデータの参照権限がありません");
    }
    const sanitizedKey = sanitizeKey(key);

    const bucket = resolveBucket(bucketId);
    if (!bucket) {
      throw APIError.internal("バケットハンドルの解決に失敗しました");
    }

    try {
      const attrs = await bucket.attrs(sanitizedKey);
      await recordAdminAction({
        actor_user_id: userId,
        action: "get_storage_object_metadata",
        target_type: "storage",
        target_id: descriptor.bucketName,
        payload: { key: sanitizedKey },
        success: true,
        severity: "info",
      });
      return {
        key: attrs.name,
        size: attrs.size,
        etag: attrs.etag,
        contentType: attrs.contentType,
        version: attrs.version,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes("no such object")) {
        throw APIError.notFound("指定されたオブジェクトが見つかりません");
      }
      log.error("Failed to fetch metadata", { bucket: descriptor.bucketName, key: sanitizedKey, error });
      throw APIError.internal("メタデータの取得に失敗しました");
    }
  },
);
