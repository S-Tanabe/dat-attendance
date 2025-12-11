# Notification Service 機能仕様書

このディレクトリは Encore backend における通知サービス(`notification`) を構成します。本書では現行の仕様・依存関係・データ構造・検証手順を整理します。設計詳細は別ドキュメントで補足予定ですが、実装に必要な最低限の仕様は本書で完結します。

---

## 1. サービス概要

- 各種イベント（システム通知 / ユーザーアクション / スケジュール通知 など）を受け付け、通知レコードを生成し、Pub/Sub を経由して配信レイヤーへ渡します。
- 現時点の配信チャネルは以下のとおりです。
  - `admin-dashboard` : 管理者向け SSE ストリーム（`web_delivery.ts`）。
  - `user-<id>` : 個別ユーザー向け SSE ストリーム（`web_delivery.ts`）。
  - `all-users` : 全ユーザー向けブロードキャスト SSE ストリーム（`web_delivery.ts`）。
- Slack / メールなど外部チャネルはスコープ外。SSE 配信に注力しています。

---

## 2. 依存関係とセットアップ

### 2.1 必須 Node モジュール

- （依存ライブラリなし）

### 2.2 Encore 側設定

- サービス定義は `encore.service.ts` に配置。新規エンドポイント追加時は Encore を再ビルドすることで有効化されます。
- データベースマイグレーションは `migrations/notification/*.sql` に配置されています。`encore run` 起動時に自動適用されます。

---

## 3. エンドポイント一覧

| エンドポイント | 認証 | 役割 | 概要 |
| --- | --- | --- | --- |
| `POST /notifications` | Required | 内部/他サービス | 汎用通知生成。入力ペイロードを検証し、DB 保存 + Pub/Sub へ publish します。 |
| `GET /admin/notifications/stream` | Required | 管理者 | SSE による管理者向けリアルタイム通知。EventSource で接続。 |
| `GET /notifications/stream` | Required | 一般ユーザー | SSE による個別ユーザー向けリアルタイム通知。チャネルクエリパラメータで複数チャネル購読可能。 |

> 最小呼び出し例: `{"userId":"<UUID>","message":"処理が完了しました"}`。`source` は省略時に `system`、`category` は `system`、`priority` は `normal`、`channelIds` は `user-<userId>` へ自動補完されます。

---

## 4. ドメインモデル

- `NotificationPayload` (`types.ts`)
  - `category`: `system` / `user_action` / `schedule` / `realtime`
  - `priority`: `low` / `normal` / `high` / `urgent`
  - `status`: `pending` / `processing` / `delivered` / `failed` / `escalated`
- `channelIds`: 配信チャネルIDの配列。SSE対象は `admin-dashboard`、個別は `user-<id>` を想定。複数人へ同一内容を届けたい場合は呼び出し元で対象ユーザーIDを列挙し、それぞれ `user-<id>` 形式に変換して渡す。全体通知は `all-users` を利用する。
- `metadata`: 任意のメタ情報（呼び出し元サービスや非同期ジョブIDなど）を格納。
- `DeliveryEvent` (`types.ts`): `notificationId` + `channel` + `payload`。deliveryTopic 経由で送信。

---

## 5. データベーススキーマ

| テーブル | 用途 |
| --- | --- |
| `notifications` | 通知メタ情報（テンプレートID、チャネル配列、任意メタデータなど）を保持。 |
| `notification_deliveries` | チャネル単位での配信ステータス・リトライ情報。 |
| `user_notification_preferences` | ユーザー別のチャネル許可/優先度閾値/ミュート設定。 |
| `admin_notification_profiles` | 管理者プロファイル（ソース別ルーティング）を保持。 |

各 SQL は `migrations/notification/0001~0006_*.sql` を参照してください。

---

## 6. 処理フロー概要

### 6.1 通知生成
1. API (`notification.ts/createNotification`) が入力ペイロードを受信。
2. `repository.ts/insertNotification` で DB 保存。
3. `topics.ts/notificationTopic` に publish。

### 6.2 Processor
1. `processor.ts` が `notificationTopic` を購読。
2. `preferences.ts` / `admin_preferences.ts` を参照し、許可されたチャネルのみ `deliveryTopic` へ送信。

### 6.3 Delivery
1. `web_delivery.ts` が `deliveryTopic` を購読。
2. `admin-dashboard`、`all-users` または `user-*` チャネルの SSE へ配信し、`notification_deliveries` を更新。
3. SSE 接続の管理（登録・削除）、チャネル購読、ロールベースのアクセス制御を実施。

---

## 7. テンプレート

- `templates/index.ts` は現状テンプレートを定義しておらず、`renderTemplate` はフォールバック用途のみ提供。
- `renderTemplate` 関数で `{key}` 形式を変数置換します。必要に応じてロケール別テンプレートを追加してください。

---

## 8. 検証済みシナリオ

| 時刻 (UTC) | 概要 |
| --- | --- |
| 2025-09-17T14:01:48Z | `notification.createNotification` を encore mcp で実行し通知ID `a20e6285-c2f9-48da-be1d-763e04d0bfa7` を生成。 |
| 2025-09-17T14:10:00Z | encore mcp から `targetUserIds` を指定した通知を生成し、`user-<id>` チャネルへの配信レコードが作成されることを確認。 |
| 2025-09-18T03:12:00Z | Playwright MCP を用いて `/admin/notifications/stream` SSE を受信。通知ID `a68f7dcb-1f95-487e-9466-556578c31625` を取得。 |
| 2025-09-17T14:42:22Z | Playwright MCP を用いて `/admin/notifications/stream` SSE を受信。通知ID `e53e0cdc-d6c3-41d8-aaf0-0a4bc96d7830` を取得。 |

---

## 9. 既知の課題 / TODO

- `notification_deliveries` の再送制御・エラーカテゴリ分けは最小実装です。必要に応じて `attempts` の増分やバックオフ戦略を追加してください。
- 管理者プロファイル (`admin_notification_profiles`) の初期データは未投入です。運用要件に従い適宜シードしてください。
- Slack / メール 等の外部チャネルは未対応。将来実装時は `deliveryTopic` 購読を追加し、Secrets 管理を設計してください。
- グループ概念は通知サービス側で管理せず、アプリケーション本体が抽出したユーザーIDの配列を `channelIds`（`user-<id>` 展開）として渡す方針です。

---

## 10. 参考コード

- `notification.ts` : 通知生成 API、本サービスのエントリポイント。
- `processor.ts` : 通知キューから deliveryTopic へのルーティングロジック。
- `web_delivery.ts` : SSE 実装。Playwright で EventSource を利用して検証済み。管理者用・ユーザー用の2つのエンドポイントを提供。

---

## 11. アーキテクチャ変更履歴

### 2025-10-30: realtime モジュールの統合
- **変更内容**: `backend/modules/realtime/web.ts` を `backend/services/notification/web_delivery.ts` に統合
- **理由**:
  - realtimeモジュールはnotificationの内部実装（types, topics, repository）に深く依存していた
  - SSE配信は通知システムの一部として、notification サービスで一元管理すべきと判断
  - サービス境界の明確化とアーキテクチャの簡素化
- **影響**:
  - エンドポイントパスは変更なし（`/notifications/stream`, `/admin/notifications/stream`）
  - フロントエンドのコード変更不要
  - 生成SDKは自動更新済み
- **統合後のサービス構成**: auth / app / notification / dev_tools の7サービス体制（hello はデモ用）

以上が現時点での仕様です。アップデートや設計追加時には本 README を更新してください。
