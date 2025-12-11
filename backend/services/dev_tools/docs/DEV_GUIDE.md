# Dev Tools Service Dev Guide

目的: super_admin専用の運用/監視ツール。テンプレートから切り離し可能な補助サービス。

権限制御:
- app.get_user_profile の role_name が 'super_admin' のみアクセス可。

主な機能:
- セキュリティダッシュボード、異常管理、デバイス管理、地理分析、リアルタイム監視のプロキシ
- 大量データ系は limit/offset/hours を引数で受け、必要最小限の範囲で取得（今後さらなるページング最適化を想定）

注意:
- 多くは auth の内部管理APIに依存（expose:false）。
- auth側のAPI拡張と併走でFIXMEを段階的に解消。

## 実装メモ（2025-09-05 時点）

### 1) ログイン時のリクエスト情報（IP/UA/Geo/異常検知）

- 背景: 型付きAPI (`api<Params,Res>`) で `RawRequest` からヘッダを直接参照できない実行環境があるため、`req.req.headers` が未定義になるケースを確認。
- 暫定対応（確実化）:
  - フロント（SvelteKitサーバー側）で、エンドユーザーのIP/UAを取得し `auth.login` の JSON に `client_ip` / `client_user_agent` として明示的に渡す。
  - バックエンド `auth.login` は `client_ip` / `client_user_agent` を最優先で採用し、無い場合のみ `extractRequestInfo(req)`（RawRequestヘッダ抽出）にフォールバック。
  - これにより `auth_sessions.ip_address/user_agent/geo_*` と `auth_realtime_activities.metadata` へ値が保存される。
- 今後の移行方針（Encore準拠）:
  - 型付きAPIでヘッダを受ける：`Header<"X-Forwarded-For">`, `Header<"User-Agent">` の導入を検討。
  - もしくは Encore の middleware で共通取得→各ハンドラへ注入。
  - 本番/LB配下では `X-Forwarded-For`/`Forwarded`/`CF-Connecting-IP` 等を信頼する設計に置換。

### 2) セッション同時上限（5件）の厳密化

- 以前: 上限超過時に最古1件のみ失効 → 既に6件以上の場合に収束しにくい。
- 現在: `現在件数 - (MAX-1)` 件をCTEで一括失効（最古順）。常に5件以内へ収束。

### 3) デバッグログ指針

- `auth.login`：`request context extracted`（ip/ua）, `geo resolved`, `session inserted`（ip/ua）を DEBUG で出力。
- `realtime_monitoring.recordActivity`：`Realtime activity metadata` を DEBUG で出力。
- `extractRequestInfo`：ヘッダ検出状況と先頭キーのスナップショット（DEBUG）。

### 4) ローカル開発時のIP

- ローカルは `::1`（IPv6 ループバック）や `127.0.0.1` になるのが正常。地理推定はモック（Tokyo/JP）。
- 本番ではLBヘッダから実IPを採取予定。

### 5) dev_tools 垂直スライス計画（抜粋）

1. セッション管理（READ/操作）: 統計/期限切れ/クリーンアップ（フロント一部実装済み）
2. デバイス管理（READ→WRITE最小）: 一覧→信頼/解除/削除（WRITEは確認モーダル付き）
3. 地理分析（READ）: 統計/異常/国詳細/制限
4. セキュリティダッシュボード（READ）
5. 異常検知管理・アラート管理（READ→WRITE最小）

各ステップは「READ → ご確認 → WRITE最小」の順で小刻みに進め、承認ポイントで停止します。
