import type { ReadWriter } from "encore.dev/storage/objects";
import { avatarBucket } from "../app/modules/users/storage";

export interface CapabilityOverride {
  read?: boolean;
  write?: boolean;
  destroy?: boolean;
  createPrefix?: boolean;
}

export interface StorageBucketConfig {
  /** UI/API で利用する一意な ID */
  id: string;
  /** Encore Object Storage 上のバケット名 */
  bucketName: string;
  /** 画面表示用ラベル。未指定の場合は ID から自動生成 */
  label?: string;
  /** 画面に表示する説明文 */
  description?: string;
  /** 初期表示フォルダ（省略時はルート） */
  defaultPrefix?: string;
  /** デフォルト権限に対するオーバーライド */
  capabilities?: CapabilityOverride;
  /** Encore の Bucket リソースへアクセスするための accessor */
  accessor: () => ReadWriter;
}

const bucketConfigs: StorageBucketConfig[] = [
  {
    id: "avatars",
    bucketName: "avatars",
    label: "ユーザーアバター",
    description: "ユーザーアカウントのアバター画像を保存するバケット",
    accessor: () => avatarBucket.ref<ReadWriter>(),
  },

];

export function getStorageBucketConfigs(): StorageBucketConfig[] {
  return bucketConfigs;
}
