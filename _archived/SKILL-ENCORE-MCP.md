### Encore MCP 呼び出し HOWTO

本ドキュメントは、AIエージェント（MCPクライアント）から Encore アプリのエンドポイントを確実に呼び出すための最小手順とトラブルシュートをまとめたものです。

---

## 1) 基本: PUBLIC エンドポイントでウォームアップ（hello）

目標: `hello` サービスの `GET /hello/:name` を呼べるようにする。

- 事前確認（任意）: ホストが起動していれば `curl` でも確認可能。
  - 例: `curl http://localhost:4000/hello/World`

- MCP 経由で呼ぶ最小例（概念）:
  - service: `hello`
  - endpoint: `get`（サービス定義上のエンドポイント名）
  - method: `GET`
  - path: `/hello/World`
  - payload: 省略可（不要な場合）
  - auth_payload: 省略可

- 重要な注意点（エラー回避）:
  - 一部クライアントでは、空ボディ/空の auth があるとエンコード層でエラーになることがあります（例: `invalid payload: hujson ... unexpected EOF`）。この場合は、以下のように明示的に空 JSON を渡してください。
    - payload: `{}`
    - auth_payload: `{}`（PUBLIC でも空を入れると安定する場合あり）

- 実例（擬似コード／MCP パラメータ）:
```json
{
  "service": "hello",
  "endpoint": "get",
  "method": "GET",
  "path": "/hello/World",
  "payload": "{}",
  "auth_payload": "{}"
}
```

- レスポンスの `body` は base64 エンコードされています。
  - AI／クライアント側で base64 → UTF-8 → JSON の順にデコードしてください。

---

## 2) 認証付き API の呼び出し手順（users サービス例）

目標: `users.get_profile`（`GET /user-settings/profile`）を呼ぶ。

手順:
1. ログインでトークン取得（`auth.login`）
   - service: `auth`
   - endpoint: `login`
   - method: `POST`
   - path: `/auth/login`
   - payload: `{"email":"<your_email>","password":"<your_password>"}`
   - auth_payload: `{}`（空）

   例（MCP パラメータ）:
```json
{
  "service": "auth",
  "endpoint": "login",
  "method": "POST",
  "path": "/auth/login",
  "payload": "{\"email\":\"ai@fox-hound.jp\",\"password\":\"A_word_is_enough_to_the_wise\"}",
  "auth_payload": "{}"
}
```
   - 返却 `body` を base64 デコード → JSON 化して `access_token` を取得。

2. 取得した `access_token` を Authorization ヘッダーに載せて呼ぶ
   - service: `users`
   - endpoint: `get_profile`
   - method: `GET`
   - path: `/user-settings/profile`
   - auth_payload: `{"Authorization":"Bearer <access_token>"}`
   - payload: 基本不要（必要なら `{}`）

   例（MCP パラメータ）:
```json
{
  "service": "users",
  "endpoint": "get_profile",
  "method": "GET",
  "path": "/user-settings/profile",
  "auth_payload": "{\"Authorization\":\"Bearer <ACCESS_TOKEN>\"}"
}
```

補足:
- `auth_payload` は Authorization を含む任意ヘッダーのコンテナです。他カスタムヘッダーもここに記載可能です。
- `access_token` は短寿命です。長時間の検証は `auth.refresh` による更新や再ログインをご利用ください。

---

## 3) よくあるエラーと対処

- エラー: `invalid payload: hujson ... unexpected EOF`
  - 原因: 完全に空入力だとエンコード層でエラーになるクライアントがあります。
  - 対処: `payload: "{}"` や `auth_payload: "{}"` を明示的に渡してください。

- エラー: `401/Unauthenticated` or `authentication required`
  - 原因: Authorization ヘッダーが無い／トークン期限切れ。
  - 対処: ログインし直して `access_token` を更新し、`auth_payload` に `{"Authorization":"Bearer <token>"}` を設定。

- エラー: `permission denied` / `Only super_admin can ...`
  - 原因: 権限不足。
  - 対処: 必要なロールのユーザーでログイン（例: 管理者権限が必要な API）。

- レスポンス `body` が読めない
  - 原因: base64 のまま利用している。
  - 対処: base64 → UTF-8 → JSON の順でデコード。

---

## 4) 事前準備チェックリスト

- アプリ起動: Encore アプリ（APIサーバ）が起動していること。
- シークレット: `JWT_SECRET` が設定済みであること。
- アカウント: 検証用アカウント（一般権限, 管理者権限）を用意（seed や create-account スクリプト等）。
- ネットワーク: `localhost:4000`（デフォルト）に到達可能。

---

## 5) 参考: curl との対応

- PUBLIC（hello）
  - curl: `curl http://localhost:4000/hello/World`
  - MCP: 上記 1) のパラメータ参照

- AUTH（users.get_profile）
  - curl:
    1) `POST /auth/login` でアクセストークン取得
    2) `curl -H "Authorization: Bearer <access_token>" http://localhost:4000/user-settings/profile`
  - MCP: 上記 2) のパラメータ参照

---

## 6) 運用上の注意

- 認証情報（メール/パスワード、トークン）は開発環境用を使用し、最小権限かつ短寿命を推奨。
- ログや外部転送を行う AI／ツールに機密情報を残さないよう注意してください。
- 既存の UI/機能は削除・無効化せず、追加で検証用を作る方針を守ってください。
