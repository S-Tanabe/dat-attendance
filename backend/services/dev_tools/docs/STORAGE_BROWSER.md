# Dev Tools Storage Browser

本ドキュメントは dev_tools サービスに追加した「バケットエクスプローラー」機能の実装概要と、継続開発のための指針をまとめたものです。Encore 側の API 仕様・認可ロジック・拡張ポイントを把握しやすくすることを目的としています。

## 全体像

- **用途**: super_admin ロール向けに、Encore Object Storage 上の全バケットを 1 画面で参照・操作できるようにする内部ツール。
- **公開範囲**: dev_tools サービスのみ。`auth` で super_admin のみアクセス許可。
- **主要ディレクトリ**
- `storage_buckets.ts` — バケット一覧とメタ情報の集約。
  - `storage_permissions.ts` — ロール毎のアクセス権限を判定。
  - `storage_objects.ts` — Encore API ハンドラ群 (list/generate URL/delete/create prefix など)。
  - `storage_permissions.test.ts` — 権限マトリクスのユニットテスト。

## バケット定義の構造

`storage_config.ts` で Encore の `Bucket` インスタンスと表示用メタ情報をセットで登録し、`storage_buckets.ts` から読み取って `StorageBucketDescriptor` を生成しています。

```ts
const bucketConfigs: StorageBucketConfig[] = [
  {
    id: 'avatars',
    bucketName: 'avatars',
    label: 'ユーザーアバター',
    accessor: () => avatarBucket.ref<ReadWriter>(),
  },
  // ...
];
```

- `buildDescriptors()` が設定ファイルの内容を `StorageBucketDescriptor` に変換します。dev_tools では super_admin のみが利用するため既定で **フル権限 (read/write/destroy/createPrefix)** を付与しつつ、必要に応じて `capabilities` で上書きできます。
- バケットを新規追加したい場合は、対象サービスで `new Bucket()` を定義 → `storage_config.ts` にエントリを追記 → 説明文や権限オーバーライドを設定、という手順に統一しました。

## 権限制御

`storage_permissions.ts`

- super_admin は `descriptor.capabilities` をそのまま引き継ぐため、dev_tools 上では常にフルアクセス。
- `rolePermissions` に admin / user などの差分サンプルを残してありますが、現状 dev_tools UI からは super_admin のみアクセス可能です。
- `listAccessibleBuckets()` はロールに応じて表示対象をフィルタするユーティリティ。今後一般ユーザー向け UI を分岐させる際はこの関数を差し替えて利用予定。
- 変更時は `storage_permissions.test.ts` を更新し、最低限 `resolveBucketAccess` / `hasBucketPermission` の期待値が合うことを確認してください。

## API エンドポイント

`storage_objects.ts` に以下の Encore API を定義しています。いずれも `auth: true` かつ `expose: true` で公開し、フロントエンドから直接呼び出せる形にしています。

| 関数名 | HTTP | パス | 概要 |
| ------ | ---- | ---- | ---- |
| `list_available_buckets` | GET | `/devtools/storage/buckets` | 表示用メタ情報の取得。
| `list_objects` | GET | `/devtools/storage/objects` | 疑似ディレクトリ一覧＋ファイル一覧。
| `generate_download_url` | POST | `/devtools/storage/objects/download` | 署名付き GET URL を返却。
| `generate_upload_url` | POST | `/devtools/storage/objects/upload` | 署名付き PUT URL を返却。
| `delete_objects` | DELETE | `/devtools/storage/objects/delete` | 複数キーの削除。
| `create_prefix` | POST | `/devtools/storage/prefix` | 疑似ディレクトリ (末尾 `/`) の作成。
| `get_object_metadata` | GET | `/devtools/storage/object` | 単一オブジェクトのメタ情報参照。

実装上の注意点:

- 全エンドポイントで `checkBucketAccess` を通じて権限チェックを実施。
- `generate_*` は Encore Storage の `signedDownloadUrl` / `signedUploadUrl` を thin wrapper で使用。
- `delete_objects` は結果を `deleted` / `failed[]` に分割し、UI 側で詳細表示ができるようにしています。
- 例外時は `APIError.permissionDenied` や `APIError.internal` を返し、ログには `log.error` で原因を出力します。

## 認証トークンの扱い

- dev_tools からの呼び出しは `serverClient(event)` → `withAutoRefresh()` でラップし、401 の際に自動で `auth.refresh` を叩いて再試行します。
- フロントエンドも `serverClient` / `serverClientWithForwardedHeaders` を利用することで同様の刷新を行っています。
- 署名付き URL はブラウザから直接アクセスされるため、CORS の設定は Encore 側の既定挙動に依存します。必要に応じて TTL / allowedMethods を調整してください。

## 今後の TODO / 拡張案

- **ページング**: 現在は 1 リクエスト最大 1000 件のまま。大量オブジェクト向けに continuationToken 型のページングを実装する余地あり。
- **バージョニング対応**: Encore バケットの `versioned: true` に合わせて、オブジェクトのバージョン列挙・復元を UI から行えるようにする。
- **検索・フィルタ**: フロントエンドではローカルフィルタを削除済み。必要に応じて prefix + substring のサーバーサイド検索を追加。
- **アクセス監査**: `recordAdminAction` を組み込んで、ダウンロード・削除・アップロードを監査ログに残す実装を検討。
- **ロール分岐**: 一般ユーザー向け画面を作成する際は `storage_config.ts` の設定を固定リストとして活用し、`storage_permissions.ts` でバケット毎の read/write を制御する。

## 開発フローの備忘録

1. バケットを追加したら `storage_config.ts` にエントリを追加し、必要に応じて説明や権限を設定する。
2. エンドポイントを増やしたら `storage_objects.ts` に追記し、`npm run gen:client` を実行して SDK を再生成後、フロントの API ラッパー (`frontend/src/routes/(app)/dev_tools/storage/api.ts`) を更新する。
3. 認証回りの変更がある場合は `withAutoRefresh` まわりの仕様書き換えを忘れない（`TokenSet` cookie 名が変わるとフロントも修正が必要）。
4. 動作確認は Encore MCP の `call_endpoint` を使ってシナリオテストを記録し、Playwright MCP で UI からの操作を確認すること。

---

開発継続時は本ドキュメントを更新してください。エンドポイント追加時はサンプルの curl / MCP リクエストを追記すると、新規メンバーもトレースしやすくなります。
