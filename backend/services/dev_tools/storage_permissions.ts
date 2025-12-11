import type { BucketCapabilities, BucketPermissionFlag, StorageBucketDescriptor } from "./storage_buckets";
import { getBucketDescriptor, listBucketDescriptors } from "./storage_buckets";

export interface BucketPermissionConfig {
  bucketId: string;
  permissions: BucketPermissionFlag[];
}

interface RolePermissionConfig {
  role: string;
  buckets: BucketPermissionConfig[];
}

const SUPER_ADMIN_ROLE = "super_admin";

const rolePermissions: RolePermissionConfig[] = [
  {
    role: "admin",
    buckets: [
      { bucketId: "avatars", permissions: ["read"] },
      { bucketId: "exports", permissions: ["read", "destroy"] },
    ],
  },
  {
    role: "user",
    buckets: [
      { bucketId: "avatars", permissions: ["read"] },
    ],
  },
];

const rolePermissionMap = new Map(rolePermissions.map((p) => [p.role, p] as const));

export function resolveBucketAccess(
  role: string | null | undefined,
  bucketId: string,
): BucketCapabilities | null {
  const descriptor = getBucketDescriptor(bucketId);
  if (!descriptor) return null;

  // super_admin はバケット定義の capabilities を上限としたフルアクセス
  if (role === SUPER_ADMIN_ROLE) {
    return { ...descriptor.capabilities };
  }

  const roleConfig = role ? rolePermissionMap.get(role) : undefined;
  if (!roleConfig) {
    return restrictCapabilities(descriptor, []);
  }

  const bucketConfig = roleConfig.buckets.find((b) => b.bucketId === bucketId);
  if (!bucketConfig) {
    return restrictCapabilities(descriptor, []);
  }

  return restrictCapabilities(descriptor, bucketConfig.permissions);
}

function restrictCapabilities(
  descriptor: StorageBucketDescriptor,
  permissions: BucketPermissionFlag[],
): BucketCapabilities {
  const allow = new Set(permissions);
  return {
    read: descriptor.capabilities.read && allow.has("read"),
    write: descriptor.capabilities.write && allow.has("write"),
    destroy: descriptor.capabilities.destroy && allow.has("destroy"),
    createPrefix: descriptor.capabilities.createPrefix && allow.has("createPrefix"),
  };
}

export function listAccessibleBuckets(role: string | null | undefined): StorageBucketDescriptor[] {
  if (role === SUPER_ADMIN_ROLE) {
    return listBucketDescriptors();
  }

  const roleConfig = role ? rolePermissionMap.get(role) : undefined;
  if (!roleConfig) {
    return [];
  }

  const result: StorageBucketDescriptor[] = [];
  for (const bucket of roleConfig.buckets) {
    const descriptor = getBucketDescriptor(bucket.bucketId);
    if (!descriptor) continue;

    const access = restrictCapabilities(descriptor, bucket.permissions);
    if (!access.read && !access.write && !access.destroy && !access.createPrefix) continue;

    result.push({
      ...descriptor,
      capabilities: access,
    });
  }
  return result;
}

export function hasBucketPermission(
  role: string | null | undefined,
  bucketId: string,
  permission: BucketPermissionFlag,
): boolean {
  const access = resolveBucketAccess(role, bucketId);
  if (!access) return false;
  switch (permission) {
    case "read":
      return access.read;
    case "write":
      return access.write;
    case "destroy":
      return access.destroy;
    case "createPrefix":
      return access.createPrefix;
    default:
      return false;
  }
}

export function getDefaultRoleForUserRole(role: string | null | undefined): string | null | undefined {
  return role ?? null;
}

export { SUPER_ADMIN_ROLE };
