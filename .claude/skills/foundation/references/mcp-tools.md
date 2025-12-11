# MCP ツール詳細ガイド

このドキュメントでは、このプロジェクトで利用可能な MCP ツールの詳細な使用方法を説明します。

---

## 📋 目次

1. [Serena MCP](#serena-mcp)
2. [Context7 MCP](#context7-mcp)
3. [Encore MCP](#encore-mcp)
4. [Playwright MCP](#playwright-mcp)
5. [Svelte MCP](#svelte-mcp)

---

## Serena MCP

### 概要
コードベースの構造把握とセマンティック検索を提供する MCP。

### 主な機能
- プロジェクト構造の可視化（`tree` コマンドの代替）
- クラス、関数、シンボルの検索
- ファイル間の依存関係分析
- コードベース全体の理解

### 使用タイミング
- **プロジェクト構造を把握したい時**: 新しいプロジェクトを理解する最初のステップ
- **特定のシンボルを検索したい時**: クラス名、関数名で検索
- **依存関係を調査したい時**: どのファイルがどこで使われているか

### 使用例
```typescript
// プロジェクト構造の取得（tree -L 3 の代替）
serena.get_project_structure({ depth: 3 })

// シンボル検索
serena.search_symbol({ name: "UserService" })

// ファイル間の依存関係
serena.analyze_dependencies({ file: "src/services/user.ts" })
```

---

## Context7 MCP

### 概要
ライブラリやフレームワークの公式ドキュメント、ベストプラクティスを検索する MCP。

### 主な機能
- 最新のライブラリドキュメント取得
- ベストプラクティスの検索
- API リファレンスの取得
- コード例の検索

### 使用タイミング
- **新しいライブラリを使う前**: 必ず公式ドキュメントを確認
- **AI が学習していないバージョンを使う時**: 最新のドキュメントを取得
- **ベストプラクティスを確認したい時**: 推奨される実装パターンを調査
- **コアの処理や共通処理を実装する前**: 正しい実装方法を確認

### 使用例
```typescript
// Svelte 5 の最新ドキュメント取得
context7.search({ query: "Svelte 5 Runes $state" })

// Encore.dev のベストプラクティス
context7.search({ query: "Encore.dev service communication patterns" })

// DaisyUI v5 のコンポーネント
context7.search({ query: "DaisyUI v5 modal component" })
```

### 重要な注意事項
**コアの処理、共通処理、共通デザイン、特別なコードを実装する前は必ず Context7 で調査すること。**

---

## Encore MCP

### 概要
Encore.dev アプリケーションの API エンドポイントを呼び出し、動作確認を行う MCP。

### 主な機能
- API エンドポイントの呼び出し
- 認証フローのテスト
- レスポンスの確認
- エラーハンドリングのテスト

---

### 基本: PUBLIC エンドポイントの呼び出し

#### 目標
`hello` サービスの `GET /hello/:name` を呼ぶ。

#### 事前確認（任意）
ホストが起動していれば `curl` でも確認可能:
```bash
curl http://localhost:4000/hello/World
```

#### MCP 経由での呼び出し
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

#### 重要な注意点（エラー回避）
一部クライアントでは、空ボディ/空の auth があるとエンコード層でエラーになることがあります（例: `invalid payload: hujson ... unexpected EOF`）。

**対処法**: 明示的に空 JSON を渡す
- `payload: "{}"`
- `auth_payload: "{}"`（PUBLIC でも空を入れると安定する場合あり）

#### レスポンスのデコード
レスポンスの `body` は **base64 エンコード**されています。

デコード手順:
1. base64 → UTF-8
2. UTF-8 → JSON

---

### 認証付き API の呼び出し

#### 目標
`users.get_profile`（`GET /user-settings/profile`）を呼ぶ。

#### 手順

**Step 1: ログインでトークン取得（`auth.login`）**

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

レスポンスの `body` を base64 デコード → JSON 化して `access_token` を取得。

**Step 2: 取得した `access_token` を Authorization ヘッダーに載せて呼ぶ**

```json
{
  "service": "users",
  "endpoint": "get_profile",
  "method": "GET",
  "path": "/user-settings/profile",
  "auth_payload": "{\"Authorization\":\"Bearer <ACCESS_TOKEN>\"}",
  "payload": "{}"
}
```

#### 補足
- `auth_payload` は Authorization を含む任意ヘッダーのコンテナ
- 他のカスタムヘッダーもここに記載可能
- `access_token` は短寿命
- 長時間の検証は `auth.refresh` による更新や再ログインを利用

---

### よくあるエラーと対処

#### エラー: `invalid payload: hujson ... unexpected EOF`
**原因**: 完全に空入力だとエンコード層でエラーになるクライアントがある

**対処**: `payload: "{}"` や `auth_payload: "{}"` を明示的に渡す

#### エラー: `401/Unauthenticated` or `authentication required`
**原因**: Authorization ヘッダーが無い／トークン期限切れ

**対処**:
1. ログインし直して `access_token` を更新
2. `auth_payload` に `{"Authorization":"Bearer <token>"}` を設定

#### エラー: `permission denied` / `Only super_admin can ...`
**原因**: 権限不足

**対処**: 必要なロールのユーザーでログイン（例: 管理者権限が必要な API）

#### レスポンス `body` が読めない
**原因**: base64 のまま利用している

**対処**: base64 → UTF-8 → JSON の順でデコード

---

### 事前準備チェックリスト

- ✅ アプリ起動: Encore アプリ（API サーバ）が起動していること
- ✅ シークレット: `JWT_SECRET` が設定済みであること
- ✅ アカウント: 検証用アカウント（一般権限、管理者権限）を用意（seed や create-account スクリプト等）
- ✅ ネットワーク: `localhost:4000`（デフォルト）に到達可能

---

### curl との対応

#### PUBLIC（hello）
**curl**:
```bash
curl http://localhost:4000/hello/World
```

**MCP**: 上記の基本呼び出し参照

#### AUTH（users.get_profile）
**curl**:
```bash
# 1. ログイン
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ai@fox-hound.jp","password":"A_word_is_enough_to_the_wise"}'

# 2. プロフィール取得
curl -H "Authorization: Bearer <access_token>" \
  http://localhost:4000/user-settings/profile
```

**MCP**: 上記の認証付き API 呼び出し参照

---

### 運用上の注意

- ⚠️ 認証情報（メール/パスワード、トークン）は開発環境用を使用
- ⚠️ 最小権限かつ短寿命を推奨
- ⚠️ ログや外部転送を行う AI／ツールに機密情報を残さないよう注意
- ⚠️ 既存の UI/機能は削除・無効化せず、追加で検証用を作る方針を守る

---

## Playwright MCP

### 概要
ブラウザ自動化とUI の動作確認を行う MCP。

### 主な機能
- ブラウザの自動操作
- UI コンポーネントの動作確認
- スクリーンショット撮影
- E2E テスト

### 使用タイミング
- **UI 作成時**: 必ず動作確認を行う（必須）
- **フォーム実装時**: 入力、送信の動作確認
- **インタラクティブな要素**: ボタン、モーダル、ドロップダウン等の動作確認
- **E2E テスト**: ユーザーの利用シーンを想定したテスト

### 使用例
```typescript
// ページにアクセス
playwright.navigate({ url: "http://localhost:5173/dashboard" })

// 要素をクリック
playwright.click({ selector: "button[data-testid='submit']" })

// フォーム入力
playwright.fill({ selector: "input[name='email']", value: "test@example.com" })

// スクリーンショット撮影
playwright.screenshot({ path: "dashboard.png" })
```

### 重要な注意事項
**UI 作成時は必ず Playwright MCP で動作確認を行うこと。**

---

## Svelte MCP

### 概要
Svelte 5 の仕様確認とコンポーネントの検証を行う MCP。

### 主な機能
- Svelte 5 Runes の仕様確認
- SvelteKit の最新機能確認
- コンポーネント実装パターンの確認
- ベストプラクティスの取得

### 使用タイミング
- **Svelte 5 Runes を使う時**: `$state`, `$derived`, `$effect` 等の使用方法確認
- **SvelteKit の機能を使う時**: `load` 関数、フォーム、ルーティング等
- **コンポーネント実装時**: 推奨される実装パターンの確認

### 使用例
```typescript
// Svelte 5 Runes の使い方
svelte.search({ query: "$state rune usage" })

// SvelteKit の load 関数
svelte.search({ query: "SvelteKit load function" })

// フォーム処理
svelte.search({ query: "SvelteKit form actions" })
```

### 重要な注意事項
**フロントエンド開発時は Svelte MCP で Svelte 5 の仕様を確認すること。**

---

## MCP 使用の優先順位

1. **Serena**: プロジェクト構造の把握、コードベース検索
2. **Context7**: ライブラリのドキュメント、ベストプラクティス確認
3. **Svelte / Encore**: 各技術スタック固有の確認
4. **Playwright**: UI 動作確認

---

## ベストプラクティス

### 実装前の調査フロー
1. **Serena** でプロジェクト構造を把握
2. **Context7** で使用するライブラリのドキュメントを確認
3. **Svelte / Encore** で技術スタック固有の仕様を確認
4. 実装
5. **Playwright / Encore** で動作確認

### 実装中のトラブルシューティング
1. エラーメッセージを確認
2. **Context7** で該当ライブラリのトラブルシューティングを検索
3. **Serena** で既存の実装例を検索
4. ユーザーに相談

### 完了前の最終チェック
1. **Playwright** で UI の動作確認（UI がある場合）
2. **Encore MCP** で API の動作確認（API がある場合）
3. エラーがないことを確認
4. ユーザーに報告

---

## まとめ

MCP ツールは強力な開発支援ツールです。

**重要な原則:**
- 実装前に必ず調査する（Context7, Serena）
- 実装後に必ず動作確認する（Playwright, Encore）
- 疑問があれば MCP で検索してから質問する

**効率的な開発:**
1. 調査 → 実装 → 確認 のサイクルを守る
2. MCP を積極的に活用する
3. ベストプラクティスを常に確認する
