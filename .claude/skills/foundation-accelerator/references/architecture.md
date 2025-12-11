# Dashboard Accelerator - System Architecture

## 概要

dashboard-accelerator は **AI駆動開発に最適化された Admin Dashboard テンプレート** です。
このドキュメントでは、テンプレートの詳細なシステムアーキテクチャを説明します。

---

## 全体構成

```
┌─────────────────────────────────────────────────────────────┐
│                    Dashboard Accelerator                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐   │
│  │   Frontend    │  │    Backend    │  │   Database    │   │
│  │  SvelteKit v2 │◄─┤  Encore.dev   │◄─┤ PostgreSQL 14+│   │
│  │  Svelte 5     │  │  TypeScript   │  │  + Extensions │   │
│  │  Runes        │  │  Modular      │  │  (pg_trgm,    │   │
│  │  DaisyUI v5   │  │  Monolith     │  │   fuzzy...)   │   │
│  └───────────────┘  └───────────────┘  └───────────────┘   │
│         ▲                  ▲                   ▲            │
│         │                  │                   │            │
│  ┌──────┴──────────────────┴───────────────────┴──────┐    │
│  │          Claude Skills (Template Knowledge)         │    │
│  │  foundation-* スキル体系（11スキル）                │    │
│  └─────────────────────────────────────────────────────┘    │
│         ▲                                                    │
│         │                                                    │
│  ┌──────┴──────────────────────────────────────────────┐    │
│  │              OpenSpec (Project Context)              │    │
│  │  project.md, tasks/, archive/                        │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Frontend Architecture (SvelteKit v2 + Svelte 5)

### ディレクトリ構造

```
frontend/
├── src/
│   ├── lib/
│   │   ├── components/          # 共通UIコンポーネント
│   │   │   ├── sidebar/         # Sidebarコンポーネント群
│   │   │   ├── Header.svelte
│   │   │   ├── ToastHost.svelte
│   │   │   ├── ErrorToast.svelte
│   │   │   ├── ErrorBoundary.svelte
│   │   │   ├── ThemeSelector.svelte
│   │   │   └── RoleSelect.svelte
│   │   ├── generated/           # Encore SDK（自動生成）
│   │   │   └── client.ts        # API Client
│   │   ├── stores/              # Svelte Stores
│   │   │   ├── toast.ts         # トースト通知
│   │   │   ├── error.ts         # エラー状態
│   │   │   ├── theme.ts         # テーマ設定
│   │   │   └── cache.ts         # キャッシュ管理
│   │   ├── notifications/       # 通知システム
│   │   │   ├── client.ts        # SSE Client
│   │   │   ├── store.ts         # 通知Store
│   │   │   ├── proxy.ts         # SSE Proxy
│   │   │   └── types.ts
│   │   ├── api/                 # API通信
│   │   │   └── client.ts        # serverClient, browserClient
│   │   ├── errors/              # エラーハンドリング
│   │   │   ├── types.ts
│   │   │   ├── error-codes.ts
│   │   │   ├── error-messages.ts
│   │   │   ├── transformer.ts
│   │   │   └── index.ts
│   │   ├── monitoring/          # 監視・ロギング
│   │   │   └── sentry.ts
│   │   └── utils/               # ユーティリティ
│   │       ├── forms.ts
│   │       ├── avatar.ts
│   │       └── data-fetching.ts
│   │
│   ├── routes/                  # SvelteKit Routes
│   │   ├── login/               # ログインページ
│   │   ├── logout/              # ログアウト処理
│   │   ├── (app)/               # 認証必要ページ
│   │   │   ├── dashboard/
│   │   │   ├── users/
│   │   │   ├── user-settings/
│   │   │   ├── dev_tools/
│   │   │   ├── notifications/
│   │   │   │   └── stream/      # SSE Endpoint
│   │   │   ├── +layout.svelte
│   │   │   └── +layout.server.ts
│   │   ├── +layout.svelte       # ルートレイアウト
│   │   ├── +layout.ts
│   │   └── +error.svelte        # エラーページ
│   │
│   ├── hooks.server.ts          # SvelteKit Hooks
│   ├── hooks.client.ts          # Client Hooks
│   └── app.html                 # HTMLテンプレート
│
├── static/                      # 静的ファイル
├── svelte.config.js             # Svelte設定
├── vite.config.ts               # Vite設定
└── package.json
```

### Colocation原則

```
routes/
└── (app)/
    └── users/
        ├── list/
        │   ├── +page.svelte              # ページコンポーネント
        │   ├── +page.server.ts           # サーバーロジック
        │   └── components/               # このページ専用コンポーネント
        │       ├── UserTable.svelte
        │       ├── UserFilter.svelte
        │       └── UserPagination.svelte
        └── [id]/
            ├── +page.svelte
            ├── +page.server.ts
            └── components/
                ├── UserProfile.svelte
                └── UserEditModal.svelte
```

**ルール**:
- ページ固有コンポーネントは `components/` 配下に配置
- 2箇所以上で使う場合のみ `src/lib/components/` に移動
- API通信は `+page.server.ts` で実行（serverClient使用）

### Svelte 5 Runes パターン

```typescript
// src/lib/notifications/store.ts (実例)
import { writable } from 'svelte/store';

export function createNotificationStore() {
  let notifications = $state<Notification[]>([]);
  let unreadCount = $derived(notifications.filter(n => !n.read).length);

  return {
    get notifications() { return notifications; },
    get unreadCount() { return unreadCount; },

    addNotification(notification: Notification) {
      notifications = [notification, ...notifications];
    },

    markAsRead(id: string) {
      notifications = notifications.map(n =>
        n.id === id ? { ...n, read: true } : n
      );
    },

    clear() {
      notifications = [];
    },
  };
}

// Toast Store の実例
// src/lib/stores/toast.ts
export const toastStore = writable<ToastMessage[]>([]);

export function addToast(message: ToastMessage) {
  toastStore.update(toasts => [...toasts, message]);
}
```

---

## Backend Architecture (Encore.dev)

### ディレクトリ構造

```
backend/
├── encore.app                   # Encore設定
├── services/                    # サービスディレクトリ
│   ├── auth/                    # 認証サービス
│   │   ├── auth.ts              # エンドポイント定義
│   │   ├── auth_handler.ts      # 認証ハンドラ
│   │   ├── session_management.ts # セッション管理
│   │   ├── session_cleanup.ts   # セッションクリーンアップ
│   │   ├── trust_scoring.ts     # Trust Score計算
│   │   ├── anomaly_detection.ts # 異常検知
│   │   ├── geo_location.ts      # 地理情報取得
│   │   ├── realtime_monitoring.ts # リアルタイム監視
│   │   ├── iptrust/             # IP Trust評価
│   │   │   ├── evaluate.ts
│   │   │   ├── settings.ts
│   │   │   └── api.ts
│   │   ├── database.ts
│   │   └── migrations/          # DBマイグレーション
│   │
│   ├── notification/            # 通知サービス
│   │   ├── notification.ts
│   │   ├── web_delivery.ts      # SSE実装
│   │   ├── processor.ts         # 通知処理
│   │   ├── preferences.ts       # ユーザー通知設定
│   │   ├── admin_preferences.ts # 管理者通知設定
│   │   ├── repository.ts
│   │   ├── database.ts
│   │   ├── templates/
│   │   └── migrations/
│   │
│   ├── dev_tools/               # 開発ツールサービス
│   │   ├── dev_tools.ts
│   │   ├── audit_log.ts
│   │   ├── storage_buckets.ts
│   │   ├── storage_objects.ts
│   │   ├── device_management.ts
│   │   ├── database.ts
│   │   └── migrations/
│   │
│   └── app/                     # アプリケーションサービス（ユーザー管理含む）
│       ├── modules/
│       │   └── users/           # ユーザー管理モジュール
│       │       ├── user_management.ts  # ユーザー管理API
│       │       ├── user_settings.ts    # ユーザー設定API
│       │       ├── permissions.ts      # 権限管理
│       │       └── storage.ts          # ストレージ管理
│       ├── database.ts
│       └── migrations/
│
├── shared/                      # 共通ライブラリ
│   ├── errors/                  # エラー定義
│   └── monitoring/              # 監視・ロギング
│
├── scripts/                     # スクリプト
│   └── seed_create_default_account.ts
│
└── package.json
```

### モジュラモノリス構成

```
Services (Modular Monolith)
├── auth (認証・セッション)
│   └── DB: auth 物理データベース
├── notification (通知)
│   └── DB: notification 物理データベース
├── dev_tools (開発ツール)
│   └── DB: dev_tools 物理データベース
└── app (アプリケーション機能 + ユーザー管理)
    └── DB: app 物理データベース
```

**サービス間通信**:

```typescript
// services/notification/notification.ts
import { app } from "~encore/clients"; // サービス間通信

export const sendWelcomeNotification = api(
  { expose: false, auth: true },
  async (params: { userId: string }): Promise<void> => {
    // app サービスからユーザー情報取得
    const userProfile = await app.get_user_profile({ id: params.userId });

    // 通知送信
    await createNotification({
      userId: params.userId,
      type: "welcome",
      message: `Welcome, ${userProfile.profile.display_name || 'User'}!`,
    });
  }
);
```

### API エンドポイント設計

```typescript
// services/app/modules/users/user_management.ts
import { api, APIError } from "encore.dev/api";
import { ensureMinimumRoleLevel, RoleLevel } from "./permissions";
import { getAuthData } from "~encore/auth";

interface GetUserProfileParams {
  id: string;
}

interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  role_level: number;
}

export const get_user_profile = api(
  {
    expose: true,          // Frontend からアクセス可能
    auth: true,            // 認証必須
    method: "GET",
    path: "/users/:id/profile",
  },
  async (params: GetUserProfileParams): Promise<{ profile: UserProfile }> => {
    // 権限チェック（manager以上）
    await ensureMinimumRoleLevel(RoleLevel.MANAGER);

    // ユーザープロフィール取得（app物理データベース）
    const profile = await db.queryRow`
      SELECT au.id, au.email, ap.display_name, r.level as role_level
      FROM app_users ap
      JOIN roles r ON ap.role_id = r.id
      -- auth物理DBへのアクセスはクロスサービス参照で実装
    `;

    if (!profile) {
      throw APIError.notFound("user_not_found", "ユーザーが見つかりません");
    }

    return { profile };
  }
);
```

---

## Database Architecture (PostgreSQL)

### Encore物理データベース分離

Encore.devは各サービスに物理的に独立したデータベースを提供します:
- `auth`: 認証サービス専用
- `notification`: 通知サービス専用
- `dev_tools`: 開発ツール専用
- `app`: アプリケーションサービス専用

### プロジェクト推奨パターン: PostgreSQL論理スキーマ分割

**注意**: この論理スキーマ分割はプロジェクト実装時の推奨パターンであり、テンプレート自体には実装されていません。

業務系サービスは全て `app` 物理データベースを使用し、マイグレーションでPostgreSQL論理スキーマを作成して機能別に分割することを推奨します:

```sql
-- 推奨パターン: app物理DB内で論理スキーマ分割
CREATE SCHEMA IF NOT EXISTS crm;           -- CRM機能
CREATE SCHEMA IF NOT EXISTS inventory;     -- 在庫管理
CREATE SCHEMA IF NOT EXISTS analytics;     -- 分析機能
-- etc.
```

### 必須エクステンション

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;          -- 類似検索
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;    -- 編集距離
CREATE EXTENSION IF NOT EXISTS tcn;              -- 変更通知
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- UUID生成
```

### テーブル設計例

#### テンプレート実装済みテーブル（auth物理DB）

```sql
-- auth_users (auth物理データベース内)
CREATE TABLE auth_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  roles TEXT[] DEFAULT ARRAY['user']::TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 全文検索インデックス
CREATE INDEX idx_auth_users_name_trgm ON auth_users USING gin (name gin_trgm_ops);
```

#### テンプレート実装済みテーブル（app物理DB）

```sql
-- app_users (app物理データベース内)
CREATE TABLE app_users (
  id UUID PRIMARY KEY,  -- auth_usersと同じID
  display_name VARCHAR(255),
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### プロジェクト推奨パターン例（app物理DB内で論理スキーマ分割）

```sql
-- crm.customers (app物理データベース内のcrm論理スキーマ)
CREATE TABLE crm.customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  company VARCHAR(255),
  created_by UUID,  -- auth物理DBへの参照はEncoreクロスサービス参照で実装
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 段階的検索用インデックス
CREATE INDEX idx_customers_name_trgm ON crm.customers USING gin (name gin_trgm_ops);
CREATE INDEX idx_customers_company_trgm ON crm.customers USING gin (company gin_trgm_ops);
```

### Migration管理

```
backend/services/auth/migrations/
└── 0001_create_auth_tables.up.sql  # 認証関連テーブル作成（統合）
```

**注意**: テンプレートでは認証関連テーブル（users, sessions, permissions等）を1つのマイグレーションファイルに統合しています。

```bash
# Migration作成
cd backend/services/auth
encore db migrate create create_auth_tables

# Migration適用
encore db migrate
```

---

## 統一エラーハンドリング

### Backend (Encore APIError)

```typescript
// Encore.dev標準のAPIErrorを使用
import { APIError } from "encore.dev/api";

// 使用例
if (!user) {
  throw APIError.notFound("user_not_found", "ユーザーが見つかりません");
}

// Encore APIError メソッド:
// - APIError.notFound()         → 404
// - APIError.invalidArgument()  → 400
// - APIError.unauthenticated()  → 401
// - APIError.permissionDenied() → 403
// - APIError.alreadyExists()    → 409
// - APIError.internal()         → 500
```

### Frontend (自動エラー処理)

```typescript
// frontend/src/lib/api/client.ts
import { withErrorHandling } from '$lib/api/client';

// withErrorHandling()が自動的に処理:
// - 401エラー → /login リダイレクト
// - 400系エラー → トースト表示
// - 500系エラー → Sentry送信 + トースト表示

const client = browserClient(accessToken);

try {
  await withErrorHandling(
    () => client.app.updateSettings({ ... })
  );
  // 成功時の処理
} catch (err) {
  // エラーは既にグローバルエラーストアにセット済み
  // 追加処理が必要な場合のみここで処理
}
```

---

## 認証・セッション管理

### JWT構成

```
Access Token (15分)
├── Payload: { sub (userId), email }
└── Signature: HS256

Refresh Token (30日)
├── 形式: ランダム生成されたbase64url文字列
├── 保存: SHA-256ハッシュ値のみDBに保存
└── セッションファミリーで管理
```

### Session Family Rotation

```
Initial Login
    ↓
Session Family Created (family_id: abc123)
    ↓
Access Token 有効期限切れ
    ↓
Refresh → New Access Token + New Refresh Token (same family)
    ↓
Refresh Token 再利用検知
    ↓
Family 全セッション無効化（セキュリティ違反）
```

### IP Trust評価

```typescript
// services/auth/iptrust/evaluate.ts
export function calculateIPTrustScore(params: {
  ipAddress: string;
  userId: string;
  previousLogins: LoginHistory[];
}): number {
  let score = 50; // ベーススコア

  // 同一IPからの過去ログイン (+30)
  if (previousLogins.some(l => l.ipAddress === params.ipAddress)) {
    score += 30;
  }

  // 同一国からのアクセス (+10)
  if (previousLogins.some(l => l.country === getCurrentCountry(params.ipAddress))) {
    score += 10;
  }

  // VPN/Proxy検知 (-20)
  if (isVPN(params.ipAddress)) {
    score -= 20;
  }

  return Math.max(0, Math.min(100, score));
}
```

---

## 通知システム (SSE)

### Backend (SSE Stream)

```typescript
// services/notification/web_delivery.ts
export const streamNotifications = api(
  { expose: true, auth: true, raw: true },
  async (req, res) => {
    const userId = getAuthData()!.userId;

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });

    const listener = (notification: Notification) => {
      res.write(`data: ${JSON.stringify(notification)}\n\n`);
    };

    subscribeToUserNotifications(userId, listener);

    req.on("close", () => {
      unsubscribeFromUserNotifications(userId, listener);
    });
  }
);
```

### Frontend (SSE Client)

```typescript
// src/lib/notifications/store.ts + client.ts
export function createNotificationStore() {
  let notifications = $state<Notification[]>([]);
  let eventSource: EventSource | null = null;

  function connect() {
    eventSource = new EventSource("/notifications/stream");

    eventSource.onmessage = (event) => {
      const notification = JSON.parse(event.data);
      notifications = [notification, ...notifications];
    };
  }

  return {
    get notifications() { return notifications; },
    connect,
    disconnect() { eventSource?.close(); },
  };
}
```

---

## 監視・ロギング

### Sentry統合

```typescript
// Frontend (hooks.client.ts)
import * as Sentry from "@sentry/sveltekit";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [new Sentry.BrowserTracing()],
  tracesSampleRate: 0.1,
});

// Backend (Encore自動統合)
// encore.app で Sentry DSN 設定済み
```

### Encoreログ

```bash
# リアルタイムログ表示
encore logs

# サービス別ログ
encore logs --service=auth

# エラーログのみ
encore logs --level=error
```

---

## テスト戦略

### Backend (Vitest)

テンプレートには以下のテストファイルが含まれています:

- `backend/services/notification/processor.test.ts` - 通知プロセッサのテスト
- `backend/services/notification/templates/index.test.ts` - テンプレートテスト
- `backend/hello/hello.test.ts` - サンプルテスト

```typescript
// 実例: services/notification/processor.test.ts
import { describe, it, expect } from "vitest";
import { processNotification } from "./processor";

describe("Notification Processor", () => {
  it("should process notification successfully", async () => {
    const result = await processNotification({
      userId: "test-user",
      type: "info",
      message: "Test notification"
    });
    expect(result.success).toBe(true);
  });
});
```

### Frontend Testing

**注意**: テンプレートにはE2Eテストは含まれていません。必要に応じてPlaywrightまたはCypressを追加してください。

---

## デプロイメント

### Encore Cloud

```bash
# Production デプロイ
encore deploy --env=production

# Staging デプロイ
encore deploy --env=staging
```

### Frontend (Vercel/Netlify)

```bash
# ビルド
cd frontend
pnpm run build

# プレビュー
pnpm run preview
```

---

## まとめ

dashboard-accelerator のアーキテクチャは以下の原則に基づいています:

1. **モジュラモノリス** - サービス分割による保守性向上
2. **AI-First** - Claude Code が理解しやすい構造
3. **Contract-First** - OpenSpec → Skills → Implementation
4. **Colocation** - 関連ファイルを近くに配置
5. **統一エラーハンドリング** - Backend + Frontend 一貫性
6. **段階的検索** - PostgreSQL拡張を活用した高度検索
7. **SSEリアルタイム通知** - WebSocketよりシンプルな実装
8. **Sentry統合監視** - エラー自動追跡
