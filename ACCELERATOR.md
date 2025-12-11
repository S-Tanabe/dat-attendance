# Dashboard Accelerator Template - 機能説明・アーキテクチャ

**最終更新**: 2025-11-13

---

## 📋 目次

1. [dashboard-acceleratorとは](#dashboard-acceleratorとは)
2. [Quick Start Guide](#quick-start-guide)
3. [設計思想と原則](#設計思想と原則)
4. [システムアーキテクチャ](#システムアーキテクチャ)
5. [提供機能一覧](#提供機能一覧)
6. [機能別詳細説明](#機能別詳細説明)
7. [UIコンポーネント一覧](#uiコンポーネント一覧)
8. [拡張原則](#拡張原則)
9. [OpenSpec連携方法](#openspec連携方法)
10. [機能索引](#機能索引)

---

## dashboard-acceleratorとは

dashboard-acceleratorは、Encore.dev + SvelteKitをベースにした**AI駆動開発対応の汎用Admin Dashboardテンプレート**です。

### テンプレートの特徴

- **50+の実装済み機能**: 認証・通知・エラー処理等の基礎機能が予め実装済み
- **AI-First Architecture**: Claude Codeが理解しやすいコード構造・ドキュメント体系
- **Contract-First**: OpenSpec駆動開発を前提とした設計
- **Reusable Components**: 実案件で再利用可能な汎用機能群

### 提供価値

- **開発速度**: 認証・通知・エラー処理等の基礎機能が実装済みのため、ビジネスロジックに集中できる
- **品質担保**: 統一されたパターン・制約により一貫性確保
- **AI効率**: OpenSpecによるAIコンテキスト最適化、MCP統合による効率的な開発
- **拡張性**: テンプレート制約を守りながら案件固有機能を追加可能

---

## Quick Start Guide

### 最初の5分で読むべきドキュメント

1. **CLAUDE.md** (5分)
   - 開発ルール・禁止事項
   - CRITICAL RULES の理解
   - 全開発者必読

2. **ACCELERATOR.md (本ドキュメント)** (10分)
   - テンプレートの全体像
   - 提供機能の把握


### 新メンバー向けオンボーディング

```
Step 1: ドキュメント読む（20分）
  - CLAUDE.md
  - ACCELERATOR.md (本ドキュメント)
  ↓
Step 2: 実際のコードを見る（30分）
  - backend/services/auth/
  - frontend/src/lib/components/
  - frontend/src/routes/(app)/
  ↓
Step 3: 開発環境セットアップ（30分）
  - README.md を参照
  - Backend & Frontend起動
```

---

## 設計思想と原則

### 1. AI-First Architecture

**定義**: AIアシスタント（Claude Code）が理解しやすいコード構造

**実装例**:

```typescript
/**
 * ユーザー情報を取得する
 * @param userId - ユーザーID
 * @returns ユーザー情報（roles含む）
 * @throws APIError.notFound - ユーザーが見つからない場合
 */
export const getUser = api(
  { expose: true, auth: true, method: "GET", path: "/users/:userId" },
  async (params: GetUserParams): Promise<GetUserResponse> => {
    const user = await db.queryRow`
      SELECT id, name, email, roles FROM auth_users WHERE id = ${params.userId}
    `;
    if (!user) {
      throw APIError.notFound("user_not_found", "ユーザーが見つかりません");
    }
    return user;
  }
);
```

**原則**:
- 全ての関数にJSDocコメント
- 明確な型定義（interface/type）
- エラーハンドリングを明示

### 2. Contract-First Development

**定義**: 仕様定義 → 実装の順序を厳守

**ワークフロー**:

```
1. OpenSpec proposal 作成
   ↓
2. Template Dependencies 宣言
   ↓
3. ACCELERATOR.md で実装パターン確認
   ↓
4. 既存実装を参考に実装
   ↓
5. OpenSpec archive 記録
```

### 3. Reusable Components

**定義**: 複数プロジェクトで再利用可能なコンポーネント設計

**再利用性の判断**:

```
コンポーネント作成
    ↓
汎用性がある？
    ├─ YES → src/lib/components/ に配置
    └─ NO → routes/.../components/ に配置（Colocation）
```

### 4. Colocation Principle

**定義**: 関連ファイルは近くに配置する

**ルール**:

```
routes/(app)/customers/
├── list/
│   ├── +page.svelte                # ページ本体
│   ├── +page.server.ts             # サーバーロジック（API呼び出し）
│   └── components/                 # このページ専用コンポーネント
│       ├── CustomerTable.svelte
│       ├── CustomerFilter.svelte
│       └── CustomerPagination.svelte
└── [id]/
    ├── +page.svelte
    ├── +page.server.ts
    └── components/
        ├── CustomerProfile.svelte
        └── CustomerEditModal.svelte
```

### 5. Unified Error Handling

**定義**: Backend + Frontend で一貫したエラー処理

**エラーフロー**:

```
Backend APIError
    ↓
serverClient/browserClient
    ↓
handleAPIError
    ├─ 401 → /login リダイレクト
    ├─ 400/404 → トースト表示
    └─ 500 → トースト表示 + Sentry送信
```

---

## システムアーキテクチャ

### 全体構成

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
│  │              OpenSpec (Project Context)              │    │
│  │  project.md, tasks/, archive/                        │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Backend Architecture (Encore.dev)

**モジュラモノリス構成**:

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

### Frontend Architecture (SvelteKit + Svelte 5)

**Colocation原則**:

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

**Svelte 5 Runes パターン**:

```typescript
// src/lib/notifications/store.ts (実例)
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
```

### Database Architecture (PostgreSQL)

**Encore物理データベース分離**:

Encore.devは各サービスに物理的に独立したデータベースを提供します:
- `auth`: 認証サービス専用
- `notification`: 通知サービス専用
- `dev_tools`: 開発ツール専用
- `app`: アプリケーションサービス専用

**プロジェクト推奨パターン: PostgreSQL論理スキーマ分割**:

**注意**: この論理スキーマ分割はプロジェクト実装時の推奨パターンであり、テンプレート自体には実装されていません。

業務系サービスは全て `app` 物理データベースを使用し、マイグレーションでPostgreSQL論理スキーマを作成して機能別に分割することを推奨します:

```sql
-- 推奨パターン: app物理DB内で論理スキーマ分割
CREATE SCHEMA IF NOT EXISTS crm;           -- CRM機能
CREATE SCHEMA IF NOT EXISTS inventory;     -- 在庫管理
CREATE SCHEMA IF NOT EXISTS analytics;     -- 分析機能
```

**必須エクステンション**:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;          -- 類似検索
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;    -- 編集距離
CREATE EXTENSION IF NOT EXISTS tcn;              -- 変更通知
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- UUID生成
```

---

## 提供機能一覧

### Technology Stack

**Backend**:
- **Framework**: Encore.dev v1.51.4 (TypeScript modular monolith)
- **Database**: PostgreSQL 14+
- **Extensions**: pg_trgm, fuzzystrmatch, tcn
- **Monitoring**: Sentry v8.55.0
- **Testing**: Vitest v4.0.6

**Frontend**:
- **Framework**: SvelteKit v2.47.1 + Svelte 5.41.0 (Runes)
- **UI Library**: DaisyUI v5.4.3
- **CSS**: Tailwind CSS v4.1.14
- **Monitoring**: Sentry v8.55.0 (SvelteKit)
- **Testing**: Playwright

**Development Tools**:
- **ESLint**: @antfu/eslint-config v6.2.0
- **Git Hooks**: Husky + lint-staged
- **Type Checking**: TypeScript (Backend), svelte-check (Frontend)

### Core Features

| 機能カテゴリ | 機能 | 説明 |
|------------|------|------|
| **認証・セッション** | JWT認証 | Access Token (15分) + Refresh Token (30日) |
| | セッション管理 | 最大5同時セッション、family-based rotation |
| | RBAC権限管理 | admin/manager/user/viewer 階層 |
| | IP Trust評価 | 0-100スコアリング、異常検知 |
| **ユーザー管理** | CRUD | ユーザー作成・更新・削除・一覧 |
| | プロフィール | アバター、プロフィール設定 |
| **API通信** | serverClient | SSR用APIクライアント（Cookie自動付与） |
| | browserClient | ブラウザ用APIクライアント |
| | 自動リフレッシュ | 401エラー時の自動トークン更新 |
| | 統一エラー処理 | 自動トースト表示、Sentry送信 |
| **UIコンポーネント** | Header | ユーザーメニュー、通知アイコン |
| | Sidebar | ナビゲーション、権限制御 |
| | Toast | 4種類通知（success/error/info/warning） |
| | Modal | DaisyUI標準 + カスタム |
| | Error Display | グローバルエラー表示 |
| **データベース** | 物理データベース分離 | auth, dev_tools, notification, app |
| | Migration管理 | Encore.dev migration system |
| | 高度検索 | 完全一致→全文→類似→編集距離 |
| | 必須カラム | id, created_at, updated_at, created_by, updated_by |
| **エラーハンドリング** | Backend | Encore APIError体系 |
| | Frontend | 自動エラー処理（トースト、リダイレクト） |
| | エラーコード | 1xxx～9xxx 体系 |
| | Sentry統合 | 500系エラー自動送信 |
| **通知システム** | SSE | Server-Sent Events リアルタイム通知 |
| | 通知テンプレート | 再利用可能なメッセージテンプレート |
| | 未読管理 | 未読件数カウント |
| **監視・ロギング** | Sentry Backend | Backend エラー追跡 |
| | Sentry Frontend | Frontend エラー追跡 |
| | Encoreログ | 構造化ログ |
| **テスト** | Vitest | Backend ユニットテスト |
| | Playwright | E2Eテスト |
| | Encore Test | Encore統合テスト |

---

## 機能別詳細説明

### 🔐 認証・認可システム

**提供機能**:
- **JWT認証**: Access Token (15分) + Refresh Token (30日)、HS256アルゴリズム
- **セッション管理**: 最大5同時セッション、セッションファミリー管理
- **RBAC権限管理**: admin/manager/user/viewer 階層
- **IP Trust評価**: 0-100スコアリング、異常検知
- **Trust Scoring**: ユーザー行動パターン学習
- **異常検知システム**: ログイン異常検知
- **地理情報取得**: IPアドレスからの地理情報取得
- **リアルタイム監視**: セッション活動記録・通知

**実装パス**:
- Backend: `backend/services/auth/`
- Frontend: `frontend/src/lib/api/client.ts`（認証フロー統合）

**使用場面**:
- ログイン/ログアウト機能
- 権限チェック
- APIエンドポイントの保護

**JWT構成**:

```
Access Token (15分)
├── Payload: { sub (userId), email }
└── Signature: HS256

Refresh Token (30日)
├── 形式: ランダム生成されたbase64url文字列
├── 保存: SHA-256ハッシュ値のみDBに保存
└── セッションファミリーで管理
```

**Session Family Rotation**:

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

#### 実装ガイド

**Backend: 認証付きエンドポイントの作成**

```typescript
// backend/services/app/api.ts
import { api } from "encore.dev/api";
import { getAuthData } from "encore.dev/auth";

// 認証必須のエンドポイント
export const getProfile = api(
  { expose: true, auth: true, method: "GET", path: "/profile" },
  async (): Promise<UserProfile> => {
    // getAuthData()で認証済みユーザー情報を取得
    const auth = getAuthData()!;
    const userId = auth.userID;

    // ユーザー情報を取得して返す
    const user = await db.queryRow`
      SELECT id, email, display_name, avatar_url
      FROM app_users
      WHERE id = ${userId}
    `;

    return user;
  }
);
```

**Backend: 権限チェックの実装**

```typescript
// backend/services/app/modules/users/permissions.ts
import { APIError } from "encore.dev/api";
import { getAuthData } from "encore.dev/auth";

export type Role = "admin" | "manager" | "user" | "viewer";

// 権限チェック関数
export async function requireRole(requiredRole: Role): Promise<void> {
  const auth = getAuthData()!;
  const userId = auth.userID;

  // ユーザーのロールを取得
  const result = await db.queryRow<{ roles: Role[] }>`
    SELECT roles FROM auth_users WHERE id = ${userId}
  `;

  const userRoles = result?.roles || [];

  // ロール階層チェック
  const roleHierarchy: Record<Role, number> = {
    admin: 4,
    manager: 3,
    user: 2,
    viewer: 1,
  };

  const userLevel = Math.max(...userRoles.map(r => roleHierarchy[r] || 0));
  const requiredLevel = roleHierarchy[requiredRole];

  if (userLevel < requiredLevel) {
    throw APIError.permissionDenied("insufficient_permissions",
      `Required role: ${requiredRole}`);
  }
}

// 使用例
export const deleteUser = api(
  { expose: true, auth: true, method: "DELETE", path: "/users/:id" },
  async ({ id }: { id: string }): Promise<{ success: boolean }> => {
    // 管理者権限チェック
    await requireRole("admin");

    // 削除処理
    await db.exec`DELETE FROM app_users WHERE id = ${id}`;
    return { success: true };
  }
);
```

**Frontend: ログイン処理**

```typescript
// routes/(public)/login/+page.server.ts
import { serverClient, setTokensToCookies } from '$lib/api/client';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions = {
  default: async ({ request, cookies }) => {
    const data = await request.formData();
    const email = data.get('email') as string;
    const password = data.get('password') as string;

    try {
      // Backend APIでログイン
      const client = serverClient(cookies);
      const response = await client.auth.login({ email, password });

      // トークンをCookieに保存
      setTokensToCookies(
        cookies,
        response.access_token,
        response.refresh_token
      );

      // ダッシュボードにリダイレクト
      throw redirect(303, '/dashboard');
    } catch (error) {
      return fail(401, {
        error: 'ログインに失敗しました',
        email
      });
    }
  }
} satisfies Actions;
```

**Frontend: 認証状態の確認**

```typescript
// routes/(authenticated)/+layout.server.ts
import { serverClient } from '$lib/api/client';
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load = (async ({ cookies }) => {
  try {
    const client = serverClient(cookies);

    // 認証済みか確認（プロフィール取得）
    const profile = await client.app.getProfile();

    return {
      user: profile
    };
  } catch (error) {
    // 認証エラーの場合はログインページへ
    throw redirect(303, '/login');
  }
}) satisfies LayoutServerLoad;
```

**Frontend: ロール別表示制御**

```svelte
<!-- routes/(authenticated)/+layout.svelte -->
<script lang="ts">
  import type { LayoutData } from './$types';

  let { data }: { data: LayoutData } = $props();

  // ロールチェック関数
  function hasRole(role: string): boolean {
    return data.user.roles.includes(role);
  }
</script>

<nav>
  <a href="/dashboard">Dashboard</a>

  {#if hasRole('manager') || hasRole('admin')}
    <a href="/users">User Management</a>
  {/if}

  {#if hasRole('admin')}
    <a href="/settings">System Settings</a>
  {/if}
</nav>

<slot />
```

---

### 🌐 API通信システム

**提供機能**:
- **serverClient()**: SSR用APIクライアント（Cookie自動付与）
- **browserClient()**: ブラウザ用APIクライアント
- **withAutoRefresh()**: 401エラー時の自動トークンリフレッシュ
- **withErrorHandling()**: 統一エラーハンドリング
- **HttpOnly Cookie管理**: ACCESS_COOKIE / REFRESH_COOKIE 管理
- **Token自動管理**: setTokensToCookies / clearTokens

**実装パス**:
- `frontend/src/lib/api/client.ts`

**使用場面**:
- Backend APIとの通信
- SSR/ブラウザでの API呼び出し
- 認証付きAPIリクエスト

**使用例**:

```typescript
// SSRでの使用（+page.server.ts）
import { serverClient } from '$lib/api/client';

export const load = async ({ cookies }) => {
  const client = serverClient(cookies);
  const users = await client.app.get_users();
  return { users };
};

// ブラウザでの使用（+page.svelte）
import { browserClient } from '$lib/api/client';

const client = browserClient();
const result = await client.app.create_user({ name: 'John', email: 'john@example.com' });
```

#### 実装ガイド

**SSRでのAPI呼び出し（+page.server.ts）**

```typescript
// routes/(app)/users/+page.server.ts
import { serverClient } from '$lib/api/client';
import type { PageServerLoad } from './$types';

export const load = (async ({ cookies }) => {
  // serverClient()でCookieを自動付与
  const client = serverClient(cookies);

  // API呼び出し（認証トークンは自動的に送信される）
  const users = await client.app.list_users();

  return {
    users
  };
}) satisfies PageServerLoad;
```

**SSRでのフォーム送信（+page.server.ts）**

```typescript
// routes/(app)/users/create/+page.server.ts
import { serverClient } from '$lib/api/client';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions = {
  default: async ({ request, cookies }) => {
    const data = await request.formData();
    const name = data.get('name') as string;
    const email = data.get('email') as string;

    try {
      const client = serverClient(cookies);
      await client.app.create_user({ name, email });

      // 成功したらリダイレクト
      throw redirect(303, '/users');
    } catch (error) {
      // エラーハンドリング（統一エラー処理により自動的にトースト表示）
      return fail(400, {
        error: 'ユーザーの作成に失敗しました',
        name,
        email
      });
    }
  }
} satisfies Actions;
```

**ブラウザでのAPI呼び出し（+page.svelte）**

```svelte
<script lang="ts">
  import { browserClient } from '$lib/api/client';

  let name = $state('');
  let email = $state('');
  let loading = $state(false);

  async function handleSubmit() {
    loading = true;
    try {
      const client = browserClient();

      // API呼び出し（自動的にエラーハンドリングされる）
      await client.app.create_user({ name, email });

      // 成功時の処理（トーストは自動表示される）
      name = '';
      email = '';
    } catch (error) {
      // エラーは自動的にトースト表示される
      console.error('Failed to create user:', error);
    } finally {
      loading = false;
    }
  }
</script>

<form onsubmit={handleSubmit}>
  <input bind:value={name} placeholder="Name" />
  <input bind:value={email} type="email" placeholder="Email" />
  <button type="submit" disabled={loading}>
    {loading ? '作成中...' : 'ユーザーを作成'}
  </button>
</form>
```

**IP/User-Agentヘッダーの転送（SSR）**

```typescript
// routes/(app)/sensitive-action/+page.server.ts
import { serverClientWithForwardedHeaders } from '$lib/api/client';
import type { Actions } from './$types';

export const actions = {
  default: async ({ request, cookies }) => {
    // IP/User-Agentを転送するクライアント
    const client = serverClientWithForwardedHeaders(request, cookies);

    // Backend側でIP Trust評価やログイン異常検知が動作
    await client.auth.sensitiveAction();

    return { success: true };
  }
} satisfies Actions;
```

**自動トークンリフレッシュの仕組み**

テンプレートでは`withAutoRefresh()`により、401エラー発生時に自動的にRefresh Tokenでトークン更新を試みます。

```typescript
// frontend/src/lib/api/client.ts（実装済み）
export function browserClient() {
  return withAutoRefresh(
    withErrorHandling(
      new Client(BACKEND_URL, {
        // Cookieから自動的にトークンを取得
        header: () => ({
          Authorization: `Bearer ${getAccessToken()}`
        })
      })
    )
  );
}

// 401エラー時の自動リフレッシュ処理
// 1. Refresh Tokenで新しいAccess Tokenを取得
// 2. Cookieを更新
// 3. 元のリクエストを再試行
// 4. リフレッシュ失敗時は /login にリダイレクト
```

---

### 🎨 UIコンポーネントシステム

**提供コンポーネント**:

**基本レイアウト**:
- **Header**: ユーザーアイコン、プロフィールドロップダウン、通知バッジ
- **Sidebar**: 開閉式サイドバー、ロール別メニュー表示
- **SidebarItem**: サイドバーメニューアイテム
- **SidebarToggle**: サイドバー開閉ボタン

**通知・フィードバック**:
- **ToastHost**: 一時通知表示ホスト
- **ErrorToast**: エラー専用トースト
- **ErrorBoundary**: エラーバウンダリ

**UI要素**:
- **ThemeSelector**: DaisyUIテーマ切り替え
- **RoleSelect**: ロール選択UI

**実装パス**:
- `frontend/src/lib/components/`

**使用場面**:
- 管理画面レイアウト構築
- ユーザーフィードバック表示
- 設定画面UI

#### 実装ガイド

**基本レイアウトの構築**

```svelte
<!-- routes/(app)/+layout.svelte -->
<script lang="ts">
  import Header from '$lib/components/Header.svelte';
  import { Sidebar } from '$lib/components/sidebar';
  import ToastHost from '$lib/components/ToastHost.svelte';
  import ErrorToast from '$lib/components/ErrorToast.svelte';
  import type { LayoutData } from './$types';

  let { data, children }: { data: LayoutData; children: any } = $props();
</script>

<div class="min-h-screen flex flex-col">
  <Header />

  <div class="flex flex-1">
    <Sidebar />

    <main class="flex-1 p-6 bg-base-200">
      {@render children()}
    </main>
  </div>
</div>

<!-- グローバルコンポーネント -->
<ToastHost />
<ErrorToast />
```

**トースト通知の表示**

```typescript
// 任意のコンポーネントから
import { showToast } from '$lib/stores/toast';

// 成功メッセージ
showToast({
  message: '保存しました',
  type: 'success',
  duration: 3000
});

// エラーメッセージ
showToast({
  message: '保存に失敗しました',
  type: 'error',
  duration: 5000
});

// 情報メッセージ
showToast({
  message: '処理を開始しました',
  type: 'info'
});
```

**モーダルの実装（DaisyUI）**

```svelte
<script lang="ts">
  let showModal = $state(false);

  function openModal() {
    showModal = true;
  }

  function closeModal() {
    showModal = false;
  }

  async function handleSubmit() {
    // 処理
    closeModal();
  }
</script>

<button class="btn btn-primary" onclick={openModal}>
  Open Modal
</button>

{#if showModal}
  <dialog class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg">確認</h3>
      <p class="py-4">この操作を実行しますか？</p>

      <div class="modal-action">
        <button class="btn" onclick={closeModal}>キャンセル</button>
        <button class="btn btn-primary" onclick={handleSubmit}>実行</button>
      </div>
    </div>

    <!-- モーダル外クリックで閉じる -->
    <form method="dialog" class="modal-backdrop">
      <button onclick={closeModal}>close</button>
    </form>
  </dialog>
{/if}
```

**カスタムコンポーネントの作成**

```svelte
<!-- src/lib/components/UserCard.svelte -->
<script lang="ts">
  interface Props {
    user: {
      id: string;
      name: string;
      email: string;
      avatar_url?: string;
    };
    onEdit?: (id: string) => void;
  }

  let { user, onEdit }: Props = $props();
</script>

<div class="card bg-base-100 shadow-xl">
  <div class="card-body">
    <div class="flex items-center gap-4">
      {#if user.avatar_url}
        <img src={user.avatar_url} alt={user.name} class="w-12 h-12 rounded-full" />
      {:else}
        <div class="avatar placeholder">
          <div class="bg-neutral text-neutral-content rounded-full w-12">
            <span>{user.name[0]}</span>
          </div>
        </div>
      {/if}

      <div class="flex-1">
        <h3 class="card-title">{user.name}</h3>
        <p class="text-sm text-base-content/70">{user.email}</p>
      </div>

      {#if onEdit}
        <button class="btn btn-sm btn-ghost" onclick={() => onEdit?.(user.id)}>
          編集
        </button>
      {/if}
    </div>
  </div>
</div>
```

---

### 🗄️ データベース設計

**提供機能**:

**スキーマ統合**:
- `auth`: 認証関連
- `dev_tools`: 開発ツール
- `notification`: 通知システム
- **`app`**: 業務ロジック統合スキーマ（**ここにschema.tableを作成**）

**PostgreSQL拡張**:
- `pg_trgm`: トライグラム類似検索
- `fuzzystrmatch`: 編集距離・あいまい検索
- `tcn`: テーブル変更通知

**高度検索パターン**:
- 3段階検索（完全一致 → 全文検索 → 類似検索）
- GINインデックス（全文検索用）
- GiSTインデックス（類似検索用）
- search_vector / search_text カラム
- 自動更新トリガー

**実装パス**:
- `backend/services/app/migrations/`
- `backend/services/auth/migrations/`
- `backend/services/notification/migrations/`

**使用場面**:
- 新規テーブル設計
- 高度検索機能実装
- データベースMigration作成

**段階的検索実装例**:

```typescript
// 1. 完全一致検索
const exactMatch = await db.query`
  SELECT * FROM app.customers WHERE name = ${query}
`;

// 2. 全文検索
if (exactMatch.length === 0) {
  const fullTextMatch = await db.query`
    SELECT * FROM app.customers
    WHERE search_vector @@ plainto_tsquery('japanese', ${query})
  `;
}

// 3. 類似検索（pg_trgm）
if (fullTextMatch.length === 0) {
  const similarMatch = await db.query`
    SELECT * FROM app.customers
    WHERE name % ${query}
    ORDER BY similarity(name, ${query}) DESC
    LIMIT 20
  `;
}
```

#### 実装ガイド

**Migration作成**

```bash
# backend/ ディレクトリで実行
cd backend

# Migrationファイル作成
encore db migrate create create_products_table

# 生成されるファイル:
# backend/services/app/migrations/XXXX_create_products_table.up.sql
# backend/services/app/migrations/XXXX_create_products_table.down.sql
```

**基本的なテーブル作成（up.sql）**

```sql
-- backend/services/app/migrations/0010_create_products_table.up.sql

-- 商品テーブル作成（app物理データベース内）
CREATE TABLE app.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    category TEXT,

    -- 検索用カラム（テンプレート推奨パターン）
    search_vector tsvector,
    search_text TEXT,

    -- 監査カラム（必須）
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

-- インデックス作成
CREATE INDEX idx_products_category ON app.products(category);
CREATE INDEX idx_products_search_vector ON app.products USING GIN(search_vector);
CREATE INDEX idx_products_search_text ON app.products USING GIST(search_text gist_trgm_ops);

-- 検索フィールド自動更新トリガー
CREATE TRIGGER update_products_search_fields
    BEFORE INSERT OR UPDATE ON app.products
    FOR EACH ROW
    EXECUTE FUNCTION update_search_fields();
```

**Rollback用SQL（down.sql）**

```sql
-- backend/services/app/migrations/0010_create_products_table.down.sql
DROP TRIGGER IF EXISTS update_products_search_fields ON app.products;
DROP INDEX IF EXISTS idx_products_search_text;
DROP INDEX IF EXISTS idx_products_search_vector;
DROP INDEX IF EXISTS idx_products_category;
DROP TABLE IF EXISTS app.products;
```

**段階的検索の実装**

```typescript
// backend/services/app/products.ts
import { api } from "encore.dev/api";
import { db } from "./database";

interface SearchParams {
  query: string;
  limit?: number;
}

export const searchProducts = api(
  { expose: true, auth: true, method: "GET", path: "/products/search" },
  async ({ query, limit = 20 }: SearchParams) => {
    // 1. 完全一致検索
    let results = await db.query`
      SELECT * FROM app.products
      WHERE name = ${query} OR category = ${query}
      LIMIT ${limit}
    `;

    if (results.length > 0) return results;

    // 2. 全文検索（tsvector）
    results = await db.query`
      SELECT *,
        ts_rank(search_vector, plainto_tsquery('japanese', ${query})) as rank
      FROM app.products
      WHERE search_vector @@ plainto_tsquery('japanese', ${query})
      ORDER BY rank DESC
      LIMIT ${limit}
    `;

    if (results.length > 0) return results;

    // 3. 類似検索（pg_trgm）
    results = await db.query`
      SELECT *,
        similarity(search_text, ${query}) as similarity
      FROM app.products
      WHERE search_text % ${query}
      ORDER BY similarity DESC
      LIMIT ${limit}
    `;

    return results;
  }
);
```

**論理スキーマ分割パターン（推奨）**

```sql
-- CRM機能用の論理スキーマ作成
CREATE SCHEMA IF NOT EXISTS crm;

CREATE TABLE crm.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name TEXT NOT NULL,
    contact_person TEXT,
    email TEXT UNIQUE,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 在庫管理用の論理スキーマ
CREATE SCHEMA IF NOT EXISTS inventory;

CREATE TABLE inventory.warehouses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    location TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- app.products と inventory.warehouses の関連付け
CREATE TABLE inventory.stock (
    product_id UUID REFERENCES app.products(id),
    warehouse_id UUID REFERENCES inventory.warehouses(id),
    quantity INT NOT NULL DEFAULT 0,
    PRIMARY KEY (product_id, warehouse_id)
);
```

---

### ⚠️ エラーハンドリング

**提供機能**:

**Backend**:
- ビジネスエラーコード体系
- エラー生成ヘルパー:
  - `createValidationError()`
  - `createBusinessError()`
  - `createNotFoundError()`
  - `createPermissionError()`

**Frontend**:
- UIError型定義
- エラーメッセージ日本語マッピング
- APIError → UIError 変換
- グローバルエラー状態管理
- 自動処理:
  - 401エラー → `/login` リダイレクト
  - システムエラー → Sentry自動レポート
  - グローバルトースト自動表示

**実装パス**:
- Backend: `backend/shared/errors/`
- Frontend: `frontend/src/lib/errors/`, `frontend/src/lib/stores/error.ts`

**使用場面**:
- APIエラーハンドリング
- バリデーションエラー
- ユーザー向けエラー表示

**エラーフロー**:

```
Backend APIError
    ↓
serverClient/browserClient
    ↓
handleAPIError
    ├─ 401 → /login リダイレクト
    ├─ 400/404 → トースト表示
    └─ 500 → トースト表示 + Sentry送信
```

#### 実装ガイド

**Backend: エラーの生成**

```typescript
// backend/services/app/products.ts
import { APIError } from "encore.dev/api";
import { createNotFoundError, createValidationError } from "~/shared/errors/helpers";

export const getProduct = api(
  { expose: true, auth: true, method: "GET", path: "/products/:id" },
  async ({ id }: { id: string }) => {
    const product = await db.queryRow`
      SELECT * FROM app.products WHERE id = ${id}
    `;

    if (!product) {
      // 統一されたNotFoundエラー
      throw createNotFoundError("product_not_found", "商品が見つかりません");
    }

    return product;
  }
);

export const createProduct = api(
  { expose: true, auth: true, method: "POST", path: "/products" },
  async (params: CreateProductParams) => {
    // バリデーション
    if (!params.name || params.name.length < 3) {
      throw createValidationError(
        "invalid_product_name",
        "商品名は3文字以上である必要があります",
        { field: "name", value: params.name }
      );
    }

    if (params.price < 0) {
      throw createValidationError(
        "invalid_price",
        "価格は0以上である必要があります",
        { field: "price", value: params.price }
      );
    }

    // 作成処理
    const product = await db.queryRow`
      INSERT INTO app.products (name, price, description, stock)
      VALUES (${params.name}, ${params.price}, ${params.description}, ${params.stock})
      RETURNING *
    `;

    return product;
  }
);
```

**Backend: カスタムエラーコードの定義**

```typescript
// backend/shared/errors/error-codes.ts
export const ErrorCodes = {
  // 既存のコード...

  // 商品関連エラー（5000番台）
  PRODUCT_NOT_FOUND: { code: 5001, message: "商品が見つかりません" },
  PRODUCT_OUT_OF_STOCK: { code: 5002, message: "在庫切れです" },
  INVALID_PRODUCT_NAME: { code: 5003, message: "商品名が不正です" },
} as const;
```

**Frontend: エラーの自動処理**

テンプレートでは`withErrorHandling()`により、APIエラーが自動的に処理されます。

```typescript
// frontend/src/lib/api/client.ts（実装済み）
// エラー処理の仕組み:

// 1. 401エラー → /login にリダイレクト（自動）
// 2. 400/404エラー → エラートースト表示（自動）
// 3. 500エラー → エラートースト表示 + Sentry送信（自動）

// そのため、通常はtry-catchは不要
```

**Frontend: 手動エラー処理が必要な場合**

```typescript
// routes/(app)/products/create/+page.server.ts
import { serverClient } from '$lib/api/client';
import { fail } from '@sveltejs/kit';
import { transformAPIError } from '$lib/errors/transformer';
import type { Actions } from './$types';

export const actions = {
  default: async ({ request, cookies }) => {
    const data = await request.formData();

    try {
      const client = serverClient(cookies);
      await client.app.createProduct({
        name: data.get('name') as string,
        price: Number(data.get('price')),
        // ...
      });

      return { success: true };
    } catch (error) {
      // APIエラーをUIエラーに変換
      const uiError = transformAPIError(error);

      // フォームにエラーを返す
      return fail(uiError.statusCode, {
        error: uiError.message,
        code: uiError.code
      });
    }
  }
} satisfies Actions;
```

**Frontend: グローバルエラー状態の使用**

```svelte
<script lang="ts">
  import { errorStore, setError, clearError } from '$lib/stores/error';

  // エラー状態を監視
  $effect(() => {
    if ($errorStore) {
      console.error('Global error:', $errorStore);
    }
  });

  async function handleAction() {
    try {
      // 何か処理
      clearError();
    } catch (error) {
      setError({
        message: '処理に失敗しました',
        code: 'OPERATION_FAILED',
        statusCode: 500
      });
    }
  }
</script>

{#if $errorStore}
  <div class="alert alert-error">
    <span>{$errorStore.message}</span>
    <button onclick={clearError}>閉じる</button>
  </div>
{/if}
```

---

### 🔔 通知システム

**提供機能**:

**Backend**:
- 通知生成API（POST /notifications）
- SSEストリーム配信（`/notifications/stream`）
- Pub/Sub統合
- 通知テンプレート管理
- ユーザー通知設定
- 管理者通知プロファイル

**Frontend**:
- `NotificationStream`: SSE接続管理
- `notificationCenter`: 通知状態管理（store）
- SSEプロキシ
- 型定義

**実装パス**:
- Backend: `backend/services/notification/`
- Frontend: `frontend/src/lib/notifications/`

**使用場面**:
- リアルタイム通知機能
- システムアラート
- ユーザー向け通知

**SSE実装例**:

```typescript
// Backend (SSE Stream)
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

// Frontend (SSE Client)
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

#### 実装ガイド

**Backend: 通知の生成**

```typescript
// backend/services/app/orders.ts
import { notification } from "~encore/clients";

export const createOrder = api(
  { expose: true, auth: true, method: "POST", path: "/orders" },
  async (params: CreateOrderParams) => {
    const auth = getAuthData()!;

    // 注文作成処理
    const order = await db.queryRow`
      INSERT INTO app.orders (user_id, total_amount, status)
      VALUES (${auth.userID}, ${params.totalAmount}, 'pending')
      RETURNING *
    `;

    // 通知を生成（notification サービスを呼び出し）
    await notification.createNotification({
      userId: auth.userID,
      type: "order_created",
      title: "注文を受け付けました",
      message: `注文番号: ${order.id}\n合計金額: ¥${order.total_amount}`,
      data: {
        orderId: order.id,
        totalAmount: order.total_amount
      }
    });

    return order;
  }
);
```

**Backend: カスタム通知テンプレート**

```typescript
// backend/services/notification/templates/order.ts
import type { NotificationTemplate } from "./types";

export const orderTemplates: Record<string, NotificationTemplate> = {
  order_created: {
    title: "注文を受け付けました",
    getMessage: (data: { orderId: string; totalAmount: number }) =>
      `注文番号: ${data.orderId}\n合計金額: ¥${data.totalAmount.toLocaleString()}`,
    type: "info",
    priority: "normal"
  },

  order_shipped: {
    title: "商品を発送しました",
    getMessage: (data: { orderId: string; trackingNumber: string }) =>
      `注文番号: ${data.orderId}\n追跡番号: ${data.trackingNumber}`,
    type: "success",
    priority: "high"
  },

  order_cancelled: {
    title: "注文がキャンセルされました",
    getMessage: (data: { orderId: string; reason: string }) =>
      `注文番号: ${data.orderId}\n理由: ${data.reason}`,
    type: "warning",
    priority: "high"
  }
};
```

**Frontend: 通知の受信と表示**

```svelte
<!-- routes/(app)/+layout.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { notificationCenter } from '$lib/notifications/store';

  onMount(() => {
    // SSE接続を開始
    notificationCenter.connect();

    // クリーンアップ
    return () => {
      notificationCenter.disconnect();
    };
  });

  // 未読件数を取得
  let unreadCount = $derived(notificationCenter.unreadCount);
</script>

<!-- ヘッダーに未読件数バッジ表示 -->
<Header unreadCount={unreadCount} />

<slot />
```

**Frontend: 通知一覧の表示**

```svelte
<!-- routes/(app)/notifications/+page.svelte -->
<script lang="ts">
  import { notificationCenter } from '$lib/notifications/store';

  // 通知一覧を取得
  let notifications = $derived(notificationCenter.notifications);

  // 通知を既読にする
  async function markAsRead(id: string) {
    await notificationCenter.markAsRead(id);
  }

  // 全て既読にする
  async function markAllAsRead() {
    await notificationCenter.markAllAsRead();
  }
</script>

<div class="container mx-auto p-6">
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-2xl font-bold">通知</h1>
    <button class="btn btn-sm" onclick={markAllAsRead}>
      全て既読にする
    </button>
  </div>

  <div class="space-y-2">
    {#each notifications as notification (notification.id)}
      <div
        class="card bg-base-100 shadow"
        class:bg-base-200={!notification.read}
      >
        <div class="card-body">
          <div class="flex justify-between">
            <h3 class="card-title text-lg">{notification.title}</h3>
            <span class="text-sm text-base-content/60">
              {new Date(notification.created_at).toLocaleString('ja-JP')}
            </span>
          </div>

          <p class="whitespace-pre-wrap">{notification.message}</p>

          {#if !notification.read}
            <div class="card-actions justify-end">
              <button
                class="btn btn-sm btn-primary"
                onclick={() => markAsRead(notification.id)}
              >
                既読にする
              </button>
            </div>
          {/if}
        </div>
      </div>
    {:else}
      <div class="text-center text-base-content/60 py-12">
        通知はありません
      </div>
    {/each}
  </div>
</div>
```

**Frontend: リアルタイム通知トースト**

```svelte
<!-- src/lib/components/NotificationToast.svelte -->
<script lang="ts">
  import { notificationCenter } from '$lib/notifications/store';
  import { showToast } from '$lib/stores/toast';
  import { onMount } from 'svelte';

  onMount(() => {
    // 新しい通知を受信したらトースト表示
    const unsubscribe = notificationCenter.subscribe((notifications) => {
      const latestNotification = notifications[0];
      if (latestNotification && !latestNotification.shown) {
        showToast({
          message: latestNotification.title,
          type: latestNotification.type,
          duration: 5000
        });
        latestNotification.shown = true;
      }
    });

    return unsubscribe;
  });
</script>
```

---

### 📊 監視・ロギング

**提供機能**:

**Sentry統合（Backend）**:
- 環境別サンプリングレート:
  - local: 30%
  - production: 20%
  - development: 100%
  - ephemeral: 50%
- リリースバージョン自動取得
- 機密情報マスキング
- サービスタグ自動設定
- ユーザーコンテキスト設定

**Sentry統合（Frontend）**:
- Session Replay統合
- User Feedback Widget（日本語）
- 分散トレーシング
- エラーコードベースのフィンガープリント
- 環境別サンプリング

**実装パス**:
- Backend: `backend/config/sentry.config.ts`
- Frontend: `frontend/src/lib/monitoring/sentry.ts`

**使用場面**:
- エラートラッキング
- パフォーマンス監視
- ユーザー行動分析

---

### ✅ テスト戦略

**提供機能**:

**Backend (Vitest)**:

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

**Frontend Testing**:

**注意**: テンプレートにはE2Eテストは含まれていません。必要に応じてPlaywrightまたはCypressを追加してください。

**実装パス**:
- Backend Tests: `backend/services/*/`
- Frontend Tests: （未実装）

**使用場面**:
- Backend Unit Test作成
- Frontend E2E Test作成

---

## UIコンポーネント一覧

### 基本レイアウトコンポーネント

#### Header.svelte

**実装パス**: `frontend/src/lib/components/Header.svelte`

**提供機能**:
- ユーザーアイコン表示
- プロフィールドロップダウン
  - プロフィールページへのリンク
  - ログアウトボタン
- 通知バッジ（unreadCount表示）
- 通知ドロップダウン（フィルタ機能付き）

**使用方法**:
```svelte
<Header />
```

---

#### Sidebar.svelte

**実装パス**: `frontend/src/lib/components/sidebar/components/Sidebar.svelte`

**提供機能**:
- 開閉式サイドバー
- ロール別メニュー表示
- ホバー時の自動展開
- メニュー項目アイコン表示

**使用方法**:
```svelte
<Sidebar />
```

**設定ファイル**: `sidebar/menu-config.ts`

---

#### SidebarItem.svelte

**実装パス**: `frontend/src/lib/components/sidebar/components/SidebarItem.svelte`

**提供機能**:
- メニューアイテム表示
- アクティブ状態ハイライト
- アイコン + ラベル表示

**Props**:
```typescript
{
  href: string;
  label: string;
  icon?: string;
  activeRoutePattern?: RegExp;
}
```

**使用方法**:
```svelte
<SidebarItem
  href="/customers"
  label="顧客管理"
  icon="👥"
/>
```

---

#### SidebarToggle.svelte

**実装パス**: `frontend/src/lib/components/sidebar/components/SidebarToggle.svelte`

**提供機能**:
- サイドバー開閉ボタン
- 開閉アイコンアニメーション

**使用方法**:
```svelte
<SidebarToggle />
```

---

### 通知・フィードバックコンポーネント

#### ToastHost.svelte

**実装パス**: `frontend/src/lib/components/ToastHost.svelte`

**提供機能**:
- 一時通知（Toast）表示ホスト
- 自動消去タイマー
- 複数トースト管理

**使用方法**:
```svelte
<!-- +layout.svelte に配置 -->
<ToastHost />
```

**トリガー**:
```typescript
import { showToast } from '$lib/stores/toast';

showToast({
  message: '保存しました',
  type: 'success',
  duration: 3000
});
```

---

#### ErrorToast.svelte

**実装パス**: `frontend/src/lib/components/ErrorToast.svelte`

**提供機能**:
- エラー専用トースト表示
- エラーコード表示
- 詳細メッセージ表示

**使用方法**:
```svelte
<!-- +layout.svelte に配置 -->
<ErrorToast />
```

**自動トリガー**:
- API通信エラー時に自動表示（withErrorHandling()）
- グローバルエラー発生時に自動表示

---

#### ErrorBoundary.svelte

**実装パス**: `frontend/src/lib/components/ErrorBoundary.svelte`

**提供機能**:
- 子コンポーネントのエラーキャッチ
- フォールバックUI表示
- エラー詳細の Sentry 送信

**使用方法**:
```svelte
<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>
```

**Props**:
```typescript
{
  fallback?: Component; // カスタムフォールバックUI
}
```

---

### UI要素コンポーネント

#### ThemeSelector.svelte

**実装パス**: `frontend/src/lib/components/ThemeSelector.svelte`

**提供機能**:
- DaisyUI テーマ切り替え
- テーマプレビュー
- localStorage への保存

**使用方法**:
```svelte
<ThemeSelector />
```

**対応テーマ**:
- light, dark, cupcake, bumblebee, emerald, corporate, synthwave, retro, cyberpunk, valentine, halloween, garden, forest, aqua, lofi, pastel, fantasy, wireframe, black, luxury, dracula, cmyk, autumn, business, acid, lemonade, night, coffee, winter

---

#### RoleSelect.svelte

**実装パス**: `frontend/src/lib/components/RoleSelect.svelte`

**提供機能**:
- ロール選択ドロップダウン
- ロール名の日本語表示

**使用方法**:
```svelte
<RoleSelect
  bind:value={selectedRole}
  roles={['admin', 'user', 'viewer']}
/>
```

**Props**:
```typescript
{
  value: string; // 選択されたロール
  roles: string[]; // 選択可能なロール一覧
  onChange?: (role: string) => void;
}
```

---

### 基本レイアウトの構築

```svelte
<!-- routes/(app)/+layout.svelte -->
<script>
  import Header from '$lib/components/Header.svelte';
  import { Sidebar } from '$lib/components/sidebar';
  import ToastHost from '$lib/components/ToastHost.svelte';
  import ErrorToast from '$lib/components/ErrorToast.svelte';
</script>

<div class="app-container">
  <Header />
  <div class="main-content">
    <Sidebar />
    <main>
      <slot />
    </main>
  </div>
</div>

<ToastHost />
<ErrorToast />
```

---

## 拡張原則

### ✅ 推奨される拡張

#### 1. 新しいドメインサービス追加

```typescript
// services/inventory/inventory.ts (新規作成)
import { api } from "encore.dev/api";

export const getInventory = api(
  { expose: true, auth: true },
  async (params: GetInventoryParams): Promise<InventoryResponse> => {
    // 新しいビジネスロジック実装
  }
);
```

```sql
-- services/app/migrations/X_create_inventory.up.sql
-- 注意: この例は、app物理データベース内でPostgreSQL論理スキーマを使用する
--      プロジェクト推奨パターンです（テンプレート自体には実装されていません）

-- inventoryサブスキーマを作成（app物理データベース内）
CREATE SCHEMA IF NOT EXISTS inventory;

CREATE TABLE inventory.inventory_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL,
  quantity INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 2. カスタムコンポーネント作成

```svelte
<!-- src/lib/components/domain/ProductCard.svelte -->
<script lang="ts">
  import { Card } from "$lib/components/ui"; // テンプレート再利用

  interface Props {
    product: Product;
    onAddToCart: (id: string) => void;
  }

  let { product, onAddToCart }: Props = $props();
</script>

<Card>
  <h3>{product.name}</h3>
  <p>{product.price}</p>
  <button class="btn btn-primary" onclick={() => onAddToCart(product.id)}>
    カートに追加
  </button>
</Card>
```

#### 3. app.* スキーマ拡張

```sql
-- services/app/migrations/10_create_orders.up.sql
CREATE TABLE app.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES app.customers(id),
  total_amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 4. 既存コンポーネントの拡張

```svelte
<!-- src/lib/components/layout/Header.svelte -->
<script lang="ts">
  import { authStore } from "$lib/stores/auth.svelte";
  import { notificationStore } from "$lib/stores/notification.svelte";

  // ✅ 新しいメニューアイテム追加
  const menuItems = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Customers", href: "/customers" },
    { label: "Orders", href: "/orders" },        // 追加
    { label: "Inventory", href: "/inventory" },  // 追加
  ];
</script>

<!-- 既存のHeader構造を維持しつつ拡張 -->
```

---

### ❌ 禁止される変更

#### 1. テンプレート機能の削除

```typescript
// ❌ Bad: 既存の認証機能を削除
// services/auth/auth.ts
// export const login = api(...);  // コメントアウト・削除禁止

// ✅ Good: 既存機能を拡張
export const loginWithOTP = api(
  { expose: true, auth: false },
  async (params: LoginWithOTPParams): Promise<LoginResponse> => {
    // OTP検証
    const isValid = await verifyOTP(params.email, params.otp);
    if (!isValid) {
      throw APIError.invalidArgument("invalid_otp", "OTPが無効です");
    }

    // 既存のlogin処理を再利用
    return internalLogin(params.email);
  }
);
```

#### 2. エラーハンドリングの迂回

```typescript
// ❌ Bad: 統一エラーハンドリングを無視
export const actions = {
  create: async ({ request }) => {
    try {
      const customer = await serverClient.customer.create(data);
      console.log("Success"); // トースト表示しない
    } catch (error) {
      console.error(error); // Sentry送信しない
    }
  },
};

// ✅ Good: 統一エラーハンドリング使用
export const actions = {
  create: async ({ request }) => {
    try {
      const customer = await serverClient.customer.create(data);
      return { success: true };
    } catch (error) {
      return handleAPIError(error); // 自動トースト + Sentry
    }
  },
};
```

#### 3. ESLintルールの無効化

```typescript
// ❌ Bad: ESLintルールを無効化
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data: any = await fetch(...);

// ✅ Good: 適切な型定義
interface FetchResponse {
  id: string;
  name: string;
}
const data: FetchResponse = await fetch(...);
```

#### 4. 技術スタック変更

```bash
# ❌ Bad: PostgreSQLをMySQLに変更
# encore.app
database:
  type: mysql  # 禁止

# ✅ Good: PostgreSQLを維持
database:
  type: postgresql
```

---

### 🟡 慎重に検討が必要な変更

#### 1. テンプレートコンポーネントの上書き

```svelte
<!-- ⚠️ Careful: Headerコンポーネントを完全に上書き -->
<!-- src/lib/components/layout/Header.svelte -->

<!-- 既存の機能が失われる可能性 -->
<header>
  <h1>My Custom Header</h1>
</header>

<!-- ✅ Better: 既存機能を維持しつつ拡張 -->
<script lang="ts">
  import { authStore } from "$lib/stores/auth.svelte";
  import { notificationStore } from "$lib/stores/notification.svelte";

  // テンプレート提供の authStore, notificationStore を継続使用
</script>

<header>
  <!-- 既存のユーザーメニュー、通知アイコン維持 -->
  <div class="navbar">
    <div class="navbar-start">
      <a href="/dashboard">Logo</a>
      <!-- カスタムメニュー追加 -->
      <nav>...</nav>
    </div>
    <div class="navbar-end">
      <!-- テンプレート提供の通知アイコン -->
      <NotificationIcon count={$notificationStore.unreadCount} />
      <!-- テンプレート提供のユーザーメニュー -->
      <UserMenu user={$authStore.user} />
    </div>
  </div>
</header>
```

#### 2. DBスキーマの大幅変更

```sql
-- ⚠️ Careful: auth_users の大幅変更
ALTER TABLE auth_users DROP COLUMN roles;  -- 既存機能が壊れる

-- ✅ Better: 新しいテーブル作成で拡張
CREATE TABLE app.user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth_users(id),
  department VARCHAR(100),
  position VARCHAR(100),
  extended_permissions JSONB
);
```

---

## OpenSpec連携方法

### OpenSpec × Template の関係

```
┌─────────────────────────────────────────────────────────┐
│                    OpenSpec Layer                        │
│  (プロジェクト固有の仕様・タスク)                        │
│                                                           │
│  project.md: "Template: dashboard-accelerator を使用"    │
│  tasks/xxx.md: "Depends on: template-auth"               │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│                 Implementation Layer                     │
│  (実際のコード)                                          │
│                                                           │
│  backend/services/auth/auth.ts                           │
│  frontend/src/routes/(auth)/login/                       │
└─────────────────────────────────────────────────────────┘
```

### OpenSpec project.md 推奨構造

**テンプレートメタデータ**:

```yaml
---
template: dashboard-accelerator
template-version: 1.0.0
base-features: [auth, user-management, notification, error-handling, ui-components, database]
---
```

**Template Foundation セクション**:

```markdown
# Project: [案件名]

## Template Foundation (dashboard-accelerator)

このプロジェクトは **dashboard-accelerator** テンプレートをベースに構築されています。
テンプレートが提供する機能を必ず確認してから、新規実装を開始してください。

### Provided by Template

**認証・セッション管理**:
- JWT認証（Access Token 15分 + Refresh Token 30日）
- セッション管理（最大5同時セッション）
- RBAC権限管理（admin/manager/user/viewer）
- IP Trust評価システム

**API通信**:
- serverClient() / browserClient()
- 自動トークンリフレッシュ（401エラー時）
- 統一エラーハンドリング（自動トースト表示）
- Sentry自動送信（500系エラー）

**UIコンポーネント**:
- Header（ユーザーメニュー、通知アイコン）
- Sidebar（ナビゲーション、権限制御）
- Toast通知システム
- Modal（DaisyUI標準 + カスタム）
- Error Display

**データベース設計**:
- 物理データベース分離（auth, dev_tools, notification, app）
- 必須エクステンション（pg_trgm, fuzzystrmatch, tcn）
- 段階的検索（完全一致 → 全文検索 → 類似検索 → 編集距離）
- Migration管理（Encore.dev）

**エラーハンドリング**:
- Backend: Encore APIError体系
- Frontend: 自動エラー処理（トースト、リダイレクト）
- エラーコード体系（1xxx～9xxx）
- Sentry統合

**通知システム**:
- SSE（Server-Sent Events）リアルタイム通知
- 通知テンプレート
- 未読管理

**監視・ロギング**:
- Sentry統合（Backend + Frontend）
- Encoreログ

**テスト**:
- Vitest（Backend ユニットテスト）
- Playwright（E2Eテスト）
- Encore Test

### Template Constraints

- ❌ テンプレート提供機能の削除禁止
- ❌ 既存エラーハンドリングの迂回禁止
- ❌ ESLintルールの無効化禁止
- ❌ 技術スタック変更禁止
- ✅ 既存コンポーネント優先活用
- ✅ app.* スキーマでの新規テーブル作成
- ✅ 新規ドメインサービス追加

### Development Workflow

1. **機能実装前**: ACCELERATOR.md で既存機能を確認
2. **実装中**: ACCELERATOR.md で実装パターンを参照、または既存実装コードを確認
3. **OpenSpec記載**: 使用したテンプレート機能を明記
```

### OpenSpec Proposal 推奨記載

```markdown
# Proposal: [機能名]

## Template Dependencies

- **Auth**: JWT認証を使用
- **Components**: Header, Sidebar, Toast を再利用
- **API**: serverClient + 統一エラーハンドリング適用
- **DB**: スキーマ分割パターン適用（`app.*`）

## Template Constraints Check

✅ テンプレート機能削除なし
✅ 既存コンポーネント再利用
✅ 統一エラー処理適用
✅ DB設計パターン遵守

## Implementation

[実装詳細]
```

### Development Workflow with OpenSpec

**1. プロジェクト開始**:

```
1. ACCELERATOR.md 読み込み → テンプレート全体理解
2. ACCELERATOR.md 参照 → 提供済み機能確認
3. CLAUDE.md 参照 → Critical Rules 確認
4. OpenSpec project.md 作成 → テンプレート依存明記
```

**2. 新機能開発**:

```
1. OpenSpec proposal 作成
   → "Template Dependencies"セクションでテンプレート機能明記

2. ACCELERATOR.md 確認
   → 再利用可能な機能特定

3. 既存実装を参照
   → 実装パターン取得

4. 実装
   → テンプレートパターンに従う

5. OpenSpec archive
   → 仕様蓄積
```

---

## 機能索引

### 実装タスク別ガイド

#### 認証・セッション関連

| やりたいこと | 参照実装 |
|-------------|---------|
| ログイン/ログアウト実装 | `backend/services/auth/auth.ts` |
| セッション管理実装 | `backend/services/auth/session_management.ts` |
| 権限チェック実装 | `backend/services/app/modules/users/permissions.ts` |
| IP Trust評価実装 | `backend/services/auth/iptrust/` |

#### API通信関連

| やりたいこと | 参照実装 |
|-------------|---------|
| SSRでAPI呼び出し | `frontend/src/lib/api/client.ts` (serverClient) |
| ブラウザでAPI呼び出し | `frontend/src/lib/api/client.ts` (browserClient) |
| エラーハンドリング統合 | `frontend/src/lib/api/client.ts` (withErrorHandling) |
| 認証付きAPIリクエスト | `frontend/src/lib/api/client.ts` |

#### UIコンポーネント関連

| やりたいこと | 参照実装 |
|-------------|---------|
| レイアウト構築 | `frontend/src/lib/components/Header.svelte`, `Sidebar.svelte` |
| トースト通知表示 | `frontend/src/lib/components/ToastHost.svelte` |
| モーダル実装 | DaisyUI標準コンポーネント使用 |
| 全コンポーネント確認 | `frontend/src/lib/components/` |

#### 通知システム関連

| やりたいこと | 参照実装 |
|-------------|---------|
| リアルタイム通知実装 | `backend/services/notification/web_delivery.ts`, `frontend/src/lib/notifications/` |
| 通知テンプレート作成 | `backend/services/notification/templates/` |

#### エラーハンドリング関連

| やりたいこと | 参照実装 |
|-------------|---------|
| Backendエラー定義 | `backend/shared/errors/` |
| Frontendエラー処理 | `frontend/src/lib/errors/` |
| エラーコード追加 | `backend/shared/errors/error-codes.ts` |
| Sentry統合 | `backend/config/sentry.config.ts`, `frontend/src/lib/monitoring/sentry.ts` |

#### データベース関連

| やりたいこと | 参照実装 |
|-------------|---------|
| スキーマ設計 | `backend/services/*/migrations/` |
| Migration作成 | `encore db migrate create` コマンド使用 |
| 検索機能実装 | Migration 0004, 0005 の段階的検索パターン |
| PostgreSQL拡張活用 | Migration 0001 の拡張機能有効化パターン |

#### 監視・ロギング関連

| やりたいこと | 参照実装 |
|-------------|---------|
| Sentry設定（Backend） | `backend/config/sentry.config.ts` |
| Sentry設定（Frontend） | `frontend/src/lib/monitoring/sentry.ts` |

#### テスト関連

| やりたいこと | 参照実装 |
|-------------|---------|
| Backend Unit Test作成 | `backend/services/notification/*.test.ts` |
| Frontend E2E Test作成 | （未実装、Playwright設定済み） |

### Quick Links

**テンプレート全体像を知りたい**:
→ **ACCELERATOR.md（本ドキュメント）** を参照
→ システムアーキテクチャセクションを確認

**設計原則を知りたい**:
→ **ACCELERATOR.md** の「設計思想と原則」セクションを参照
→ 「拡張原則」セクションで拡張ルール確認

**OpenSpec連携方法を知りたい**:
→ **ACCELERATOR.md** の「OpenSpec連携方法」セクションを参照

**プロジェクトルールを確認したい**:
→ **CLAUDE.md** を参照
→ Critical Rules, MCP使用ルール確認

---

## まとめ

dashboard-acceleratorは、**AI駆動開発**と**OpenSpec仕様駆動**を前提にした Admin Dashboard テンプレートです。

### Key Takeaways

1. **50+の実装済み機能** - 認証・通知・エラー処理等がすぐ使える
2. **OpenSpec統合設計** - proposal に依存関係を明記して効率化
3. **AI-First Architecture** - Claude Code が理解しやすいドキュメント体系
4. **明確な拡張原則** - ✅推奨 vs ❌禁止が明確

### Next Steps

1. **ACCELERATOR.md（本ドキュメント）** で提供機能を確認
2. **CLAUDE.md** で Critical Rules を理解
3. `openspec/project.md` にテンプレート依存を記載
4. 案件固有機能の開発開始

### ドキュメント体系

**Level 1: エントリーポイント**:
- **CLAUDE.md**: プロジェクト基盤原則、CRITICAL RULES、技術スタック
- **ACCELERATOR.md（本ドキュメント）**: テンプレート全機能説明、アーキテクチャ
- **README.md**: セットアップ手順、実行方法

**Level 2: 領域別開発ルール**:
- **backend/CLAUDE.md**: Backend開発ルール・ワークフロー
- **frontend/CLAUDE.md**: Frontend開発ルール・ワークフロー
