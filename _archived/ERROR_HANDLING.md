# エラーハンドリングシステム

このプロジェクトには、バックエンド（Encore.dev）とフロントエンド（SvelteKit）を統合した包括的なエラーハンドリングシステムが実装されています。

## 📋 目次

1. [概要](#概要)
2. [アーキテクチャ](#アーキテクチャ)
3. [バックエンド使用方法](#バックエンド使用方法)
4. [フロントエンド使用方法](#フロントエンド使用方法)
5. [エラーコードの追加](#エラーコードの追加)
6. [Sentry統合](#sentry統合)
7. [テスト方法](#テスト方法)

---

## 概要

### 主な機能

- ✅ **統一されたエラーコード体系**: バックエンド・フロントエンドで一貫
- ✅ **日本語エラーメッセージ**: ユーザーフレンドリーなメッセージ
- ✅ **自動エラーハンドリング**: グローバルトースト自動表示
- ✅ **認証エラー自動リダイレクト**: 401エラー時にログインページへ
- ✅ **Sentry統合**: エラー追跡・Session Replay（オプション）
- ✅ **開発者ツール**: エラーテストページで動作確認

### エラー処理フロー

```
[Backend: Encore.dev]
    ↓ 構造化されたエラー（APIError + BusinessErrorDetails）
[Generated SDK]
    ↓ 型安全なエラー伝播
[API Client Wrapper]
    ↓ UIError に変換
[Error Store] ← グローバル状態管理
    ↓
[UI Components] ← ユーザーへの表示
```

---

## アーキテクチャ

### ディレクトリ構造

```
backend/
├── shared/
│   ├── errors/              # エラー定義
│   │   ├── error-codes.ts   # ビジネスエラーコード
│   │   ├── types.ts         # エラー型定義
│   │   ├── helpers.ts       # エラー生成ヘルパー
│   │   └── index.ts         # Barrel export
│   └── monitoring/          # Sentry統合
│       ├── sentry.ts
│       └── index.ts

frontend/
├── src/
│   ├── lib/
│   │   ├── errors/          # エラーハンドリング
│   │   │   ├── types.ts     # UIError型
│   │   │   ├── error-messages.ts  # メッセージマッピング
│   │   │   ├── transformer.ts     # エラー変換
│   │   │   └── index.ts
│   │   ├── stores/
│   │   │   └── error.ts     # グローバルエラー状態
│   │   ├── components/
│   │   │   ├── ErrorToast.svelte    # トースト通知
│   │   │   └── ErrorBoundary.svelte # エラーバウンダリ
│   │   ├── api/
│   │   │   └── client.ts    # API Client Wrapper
│   │   └── monitoring/
│   │       ├── sentry.ts    # Sentry統合
│   │       └── index.ts
│   ├── hooks.client.ts      # クライアントフック
│   └── hooks.server.ts      # サーバーフック
```

---

## バックエンド使用方法

### 1. エラーの生成

#### バリデーションエラー

```typescript
import { createValidationError } from "../../shared/errors";

if (!email.includes("@")) {
  throw createValidationError(
    "email",
    "Invalid email format",
    { providedValue: email }
  );
}
```

#### ビジネスロジックエラー

```typescript
import { createBusinessError, AuthErrorCode } from "../../shared/errors";

throw createBusinessError(
  AuthErrorCode.TOKEN_EXPIRED,
  "JWT token has expired",
  {
    retryable: true,
    suggestedAction: "relogin",
    metadata: { expiredAt: new Date().toISOString() }
  }
);
```

#### リソース不在エラー

```typescript
import { createNotFoundError } from "../../shared/errors";

const user = await db.users.findOne({ id: userId });
if (!user) {
  throw createNotFoundError("User", userId);
}
```

#### 権限エラー

```typescript
import { createPermissionError } from "../../shared/errors";

if (!hasPermission(user, "delete_user")) {
  throw createPermissionError("delete", "User");
}
```

#### 認証エラー

```typescript
import { createAuthenticationError, AuthErrorCode } from "../../shared/errors";

throw createAuthenticationError(
  AuthErrorCode.INVALID_TOKEN,
  "Invalid authentication token",
  { reason: "Token signature verification failed" }
);
```

### 2. Sentryミドルウェアの適用（オプション）

```typescript
// backend/services/myservice/encore.service.ts
import { Service } from "encore.dev/service";
import { sentryMiddleware } from "../../shared/monitoring";

export default new Service("myservice", {
  middlewares: [sentryMiddleware],
});
```

---

## フロントエンド使用方法

### 1. 自動エラーハンドリング

#### 基本的な使い方

```typescript
import { browserClient, withErrorHandling } from "$lib/api/client";

const client = browserClient();

async function loadUserProfile() {
  try {
    const profile = await withErrorHandling(
      () => client.user.getProfile(),
      {
        showGlobalError: true,  // グローバルトースト表示（デフォルト: true）
        redirectOnAuthError: true,  // 401時リダイレクト（デフォルト: true）
        autoCloseMs: 5000,  // 5秒後に自動クリア（デフォルト: 5000）
      }
    );

    return profile;
  } catch (error) {
    // エラーは既にUIErrorに変換されグローバル表示済み
    // 個別の処理が必要な場合のみここで処理
    console.error("Failed to load profile:", error);
  }
}
```

#### カスタムエラーハンドラ

```typescript
await withErrorHandling(
  () => client.user.updateProfile(data),
  {
    onError: (uiError) => {
      // 特定のエラーコードで個別処理
      if (uiError.code === "ERR_USER_001") {
        // メールアドレス重複エラー
        fieldError = "このメールアドレスは既に使用されています。";
      }
    }
  }
);
```

### 2. 自動リフレッシュと組み合わせ

```typescript
import { withErrorHandlingAndRefresh, setTokensToCookies } from "$lib/api/client";

const result = await withErrorHandlingAndRefresh({
  exec: () => client.user.getProfile(),
  refresh: () => client.auth.refreshToken({ refresh_token: rt }),
  onRefreshed: (tokens) => {
    setTokensToCookies(event.cookies, tokens);
  },
  errorHandling: {
    showGlobalError: true,
    redirectOnAuthError: true,
  }
});
```

### 3. 手動エラー変換

```typescript
import { transformApiError, setError } from "$lib/errors";

try {
  await someApiCall();
} catch (error) {
  const uiError = transformApiError(error);

  // グローバルエラーにセット
  setError(uiError, 5000);  // 5秒後に自動クリア

  // またはカスタム処理
  if (uiError.details?.retryable) {
    console.log("このエラーは再試行可能です");
  }
}
```

### 4. コンポーネントでの使用

```svelte
<script lang="ts">
  import { globalError, clearError } from "$lib/stores/error";
  import ErrorToast from "$lib/components/ErrorToast.svelte";
  import { withErrorHandling, browserClient } from "$lib/api/client";

  const client = browserClient();
  let data = $state(null);

  async function loadData() {
    data = await withErrorHandling(() => client.myservice.getData());
  }
</script>

<!-- グローバルエラートースト -->
{#if $globalError}
  <ErrorToast error={$globalError} />
{/if}

<button onclick={loadData}>データを読み込む</button>
```

---

## エラーコードの追加

### 1. バックエンドでエラーコードを定義

```typescript
// backend/shared/errors/error-codes.ts

export enum OrderErrorCode {
  ORDER_NOT_FOUND = "ERR_ORDER_001",
  ORDER_ALREADY_PROCESSED = "ERR_ORDER_002",
  PAYMENT_REQUIRED = "ERR_ORDER_003",
}
```

### 2. フロントエンドでメッセージを追加

```typescript
// frontend/src/lib/errors/error-messages.ts

export const BUSINESS_ERROR_MESSAGES: Record<string, string> = {
  // ... 既存のコード ...

  // 注文系
  ERR_ORDER_001: "注文が見つかりません。",
  ERR_ORDER_002: "この注文は既に処理されています。",
  ERR_ORDER_003: "支払いが必要です。",
};
```

### 3. バックエンドで使用

```typescript
import { createBusinessError, OrderErrorCode } from "../../shared/errors";

export const processOrder = api(
  { method: "POST", path: "/orders/process", expose: true },
  async (req: ProcessOrderRequest) => {
    const order = await getOrder(req.orderId);

    if (!order) {
      throw createBusinessError(
        OrderErrorCode.ORDER_NOT_FOUND,
        `Order ${req.orderId} not found`,
        { retryable: false }
      );
    }

    if (order.status === "processed") {
      throw createBusinessError(
        OrderErrorCode.ORDER_ALREADY_PROCESSED,
        "Order has already been processed",
        { retryable: false }
      );
    }

    // 処理を続行...
  }
);
```

---

## Sentry統合

### 1. Sentryプロジェクトの作成

1. [Sentry](https://sentry.io/) にサインアップ
2. 新しいプロジェクトを作成（Node.js と JavaScript 用に2つ）
3. DSN をコピー

### 2. 環境変数の設定

#### バックエンド（Encore.dev シークレット管理）

Encoreの公式シークレット管理機能を使用します：

```bash
# ローカル開発環境用
encore secret set --dev SENTRY_DSN_BACKEND
# DSNを入力: https://your-backend-dsn@o123456.ingest.sentry.io/123456

# 本番環境用
encore secret set --prod SENTRY_DSN_BACKEND
# DSNを入力: https://your-backend-dsn@o123456.ingest.sentry.io/123456

# プレビュー環境用（オプション）
encore secret set --preview SENTRY_DSN_BACKEND
```

**ローカルオーバーライド（オプション）:**

ローカル環境でのみ異なるDSNを使う場合は、`.secrets.local.cue`を作成：

```cue
# backend/.secrets.local.cue
SENTRY_DSN_BACKEND: "https://your-local-dsn@o123456.ingest.sentry.io/123456"
```

#### フロントエンド

```bash
# frontend/.env
VITE_ENVIRONMENT=local  # 環境: local, development, production
VITE_SENTRY_DSN_FRONTEND=https://your-frontend-dsn@o123456.ingest.sentry.io/654321
```

**環境別設定:**
- `VITE_ENVIRONMENT=local`: ローカル開発環境（トレース30%、リプレイ10%、Dedupe無効）
- `VITE_ENVIRONMENT=development`: 開発環境（トレース100%、リプレイ20%、Dedupe無効）
- `VITE_ENVIRONMENT=production`: 本番環境（トレース10%、リプレイ5%、Dedupe有効+カスタムフィンガープリント）

### 3. 主な機能

#### フロントエンド

- ✅ **環境別サンプリングレート**: 環境ごとに最適化された送信レート
- ✅ **Session Replay**: ユーザー操作の録画（エラー時100%、通常時は環境別）
- ✅ **User Feedback Widget**: ユーザーがフィードバックを送信できる（日本語対応）
- ✅ **ユーザーコンテキスト**: ログイン時に自動設定、ログアウト時にクリア
- ✅ **Dedupe制御**: 開発環境で無効、本番環境ではエラーコード別に制御
- ✅ **カスタムフィンガープリント**: エラーコード+ステータスコードで異なるエラーを区別
- ✅ **分散トレーシング**: フロントエンド→バックエンドの追跡
- ✅ **リリーストラッキング**: package.jsonのバージョンを自動取得

#### バックエンド

- ✅ **環境別サンプリングレート**: Encoreの環境検出で自動設定
- ✅ **サービス別タグ**: サービス名と操作名を自動付与
- ✅ **分散トレーシング**: バックエンド→フロントエンドの追跡
- ✅ **リリーストラッキング**: package.jsonのバージョンを自動取得

### 4. ユーザーコンテキストの設定

ユーザーがログインすると、自動的にSentryにユーザー情報が設定されます：

```typescript
// frontend/src/routes/(app)/+layout.svelte
// ログイン時に自動設定（実装済み）
setSentryUser(userData.id, userData.email, userData.display_name);

// ログアウト時に自動クリア（実装済み）
clearSentryUser();
```

**手動設定が必要な場合:**

```typescript
import { setSentryUser, clearSentryUser } from '$lib/monitoring/sentry';

// ユーザー情報を設定
setSentryUser('user-123', 'user@example.com', 'John Doe');

// クリア
clearSentryUser();
```

### 5. 動作確認

#### フロントエンド起動時のログ（ブラウザコンソール）

DSNが設定されている場合：
```
[Sentry Debug] DSN configured: YES
[Sentry Debug] Environment: local
[Sentry Debug] Initializing with config: { environment, version, ... }
[Sentry] ✅ Initialized successfully
[Sentry] Environment: local
[Sentry] Version: 0.0.1
[Sentry] Trace propagation enabled for backend: http://localhost:4000
[Sentry] Sampling rates - traces: 30%, replay: 10%
[Sentry] Dedupe disabled for development
[Sentry] User context set: { id: "...", email: "..." }
```

DSNが未設定の場合：
```
[Sentry Debug] DSN configured: NO
[Sentry Debug] Environment: local
[Sentry] DSN not configured, skipping initialization
```

#### バックエンド起動時のログ

```
[Sentry Config] Using version: 0.0.1 for release tracking
[Sentry:service-name] 接続完了 (environment: local, cloud: local, tracesSampleRate: 0.3)
```

### 6. Dedupe（重複排除）について

**開発・ローカル環境:**
- Dedupeが無効化されているため、すべてのエラーがSentryに送信されます
- エラーテストページで複数のエラーをテストする際に便利です

**本番環境:**
- Dedupeが有効ですが、カスタムフィンガープリント（エラーコード+ステータスコード）により、異なる種類のエラーは別イベントとして記録されます
- 同じエラーの連続発生は適切にグループ化され、ノイズが削減されます

### 7. トラブルシューティング

#### エラーが1個しか送信されない

**原因**: 開発環境なのにDedupeが有効になっている

**確認方法**: ブラウザコンソールで以下を確認
```
[Sentry] Dedupe disabled for development  // ← これが表示されるべき
```

**解決策**: `.env` で `VITE_ENVIRONMENT=local` を確認

#### ユーザー情報が表示されない

**原因**: ログイン後にユーザーコンテキストが設定されていない

**確認方法**: ブラウザコンソールで以下を確認
```
[Sentry] User context set: { id: "...", email: "..." }
```

**解決策**: `frontend/src/routes/(app)/+layout.svelte` に実装済み（自動設定）

---

## テスト方法

### 1. エラーテストページで確認

開発ツールメニューから「エラーハンドリングテスト」にアクセス：

```
http://localhost:5173/dev_tools/error-testing
```

以下のエラーをテストできます：

- ✅ バリデーションエラー（400）
- ✅ 認証エラー（401）
- ✅ 権限エラー（403）
- ✅ リソース不在エラー（404）
- ✅ ビジネスエラー（再試行可能/不可）
- ✅ システムエラー（500）
- ✅ 正常レスポンス

### 2. 手動テスト

#### バックエンドエンドポイント

```bash
# バリデーションエラーのテスト
curl http://localhost:4000/dev_tools/error-test/validation

# 認証エラーのテスト
curl http://localhost:4000/dev_tools/error-test/auth

# システムエラーのテスト
curl http://localhost:4000/dev_tools/error-test/internal
```

### 3. ブラウザ開発者ツール

1. ブラウザの開発者ツールを開く（F12）
2. コンソールタブでエラーログを確認
3. ネットワークタブでAPIレスポンスを確認

---

## トラブルシューティング

### エラートーストが表示されない

**原因**: `+layout.svelte` に `ErrorToast` コンポーネントが追加されていない

**解決策**: ルートレイアウトファイルを確認

```svelte
<!-- frontend/src/routes/+layout.svelte -->
<script lang="ts">
  import ErrorToast from '$lib/components/ErrorToast.svelte';
  import { globalError } from '$lib/stores/error';
</script>

{#if $globalError}
  <ErrorToast error={$globalError} />
{/if}
```

### Sentryにエラーが送信されない

**原因1**: DSNが設定されていない

**解決策**: `.env` ファイルに DSN を設定

**原因2**: 開発環境でサンプリングレートが低い

**解決策**: 開発環境ではサンプリングレート100%に設定済み（問題なし）

### TypeScriptエラーが発生する

**原因**: 型定義が正しくインポートされていない

**解決策**: 以下を確認

```typescript
// 正しいインポート
import { transformApiError, setError } from "$lib/errors";
import type { UIError } from "$lib/errors/types";
```

---

## ベストプラクティス

### ✅ DO（推奨）

- **新しいコードでは `withErrorHandling()` を使用**
- **エラーコードを追加する際は、バックエンドとフロントエンドの両方を更新**
- **再試行可能性を正しく設定**（ネットワークエラーは true、バリデーションエラーは false）
- **推奨アクションを設定**（ユーザーに次の行動を示す）
- **開発環境でエラーテストページを活用**

### ❌ DON'T（非推奨）

- **エラーメッセージに機密情報を含めない**（パスワード、トークンなど）
- **catch ブロックで黙ってエラーを無視しない**
- **ユーザー向けメッセージに技術的な詳細を入れすぎない**
- **エラーコードの命名規則を破らない**（`ERR_<SERVICE>_<NUMBER>` 形式を維持）

---

## 参考リンク

- [PLAN.md](./PLAN.md) - 詳細な実装ガイド
- [Encore.dev ドキュメント](https://encore.dev/docs)
- [SvelteKit ドキュメント](https://kit.svelte.dev/)
- [Sentry ドキュメント](https://docs.sentry.io/)

---

## サポート

質問や問題がある場合は、開発チームに連絡してください。
