import type { ReadWriter } from "encore.dev/storage/objects";
import { getStorageBucketConfigs, type CapabilityOverride, type StorageBucketConfig } from "./storage_config";

/**
 * バケットの操作権限を表す。
 * read: list/download, write: upload/overwrite, destroy: delete, createPrefix: 擬似フォルダ作成。
 */
export type BucketPermissionFlag = "read" | "write" | "destroy" | "createPrefix";

export interface BucketCapabilities {
  read: boolean;
  write: boolean;
  destroy: boolean;
  createPrefix: boolean;
}

export interface StorageBucketDescriptor {
  /** dev_tools 側での識別子（UI/APIで利用） */
  id: string;
  /** Encore Object Storage 上のバケット名 */
  bucketName: string;
  /** エイリアス（UI表示用ラベル） */
  label: string;
  /** 追加説明 */
  description?: string;
  /** デフォルトのプレフィックス（最初に開くパス） */
  defaultPrefix?: string;
  /** 操作可能な機能セット */
  capabilities: BucketCapabilities;
}

// dev_tools では super_admin のみが触るためフル権限をデフォルトとする。
const DEFAULT_CAPABILITIES: BucketCapabilities = {
  read: true,
  write: true,
  destroy: true,
  createPrefix: true,
};

/**
 * バケットのメタ情報とアクセス方法は storage_config.ts で集中管理する。
 * Encore 側の新規バケットを追加する場合は、同ファイルにエントリを追加する。
 */
const configs: StorageBucketConfig[] = getStorageBucketConfigs();

type BucketAccessor = () => ReadWriter;

const accessorMap = new Map<string, BucketAccessor>(
  configs.map((config) => [config.id, config.accessor]),
);

function humanizeId(id: string): string {
  return id
    .split("-")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
    .join(" ");
}

function applyCapabilities(overrides?: CapabilityOverride): BucketCapabilities {
  return {
    read: overrides?.read ?? DEFAULT_CAPABILITIES.read,
    write: overrides?.write ?? DEFAULT_CAPABILITIES.write,
    destroy: overrides?.destroy ?? DEFAULT_CAPABILITIES.destroy,
    createPrefix: overrides?.createPrefix ?? DEFAULT_CAPABILITIES.createPrefix,
  };
}

function buildDescriptors(): StorageBucketDescriptor[] {
  const collected: StorageBucketDescriptor[] = [];
  for (const config of configs) {
    collected.push({
      id: config.id,
      bucketName: config.bucketName,
      label: config.label ?? humanizeId(config.id),
      description: config.description,
      defaultPrefix: config.defaultPrefix ?? "",
      capabilities: applyCapabilities(config.capabilities),
    });
  }
  return collected;
}

const descriptors: StorageBucketDescriptor[] = buildDescriptors();

const descriptorMap = new Map(descriptors.map((d) => [d.id, d] as const));

export function getBucketDescriptor(id: string): StorageBucketDescriptor | undefined {
  return descriptorMap.get(id);
}

export function listBucketDescriptors(): StorageBucketDescriptor[] {
  return descriptors;
}

export function resolveBucket(id: string): ReadWriter | null {
  const accessor = accessorMap.get(id);
  return accessor ? accessor() : null;
}
