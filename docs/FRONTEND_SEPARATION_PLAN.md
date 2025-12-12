# Frontend分離計画 - 管理画面 / ユーザー向け画面

**作成日**: 2025-12-12
**ステータス**: 計画中

---

## 1. 背景と目的

### 現状
- dashboard-accelerator テンプレートをベースにした管理画面システムのみ存在
- ユーザー向けシステムは未実装

### 要件
- 管理画面とユーザー向け画面を**別々のサブドメイン**で運用
- 独立したビルド・デプロイが必要

### 決定事項
- **frontend-admin** と **frontend-user** の2つのディレクトリに分離
- 共通コードは **packages/shared** で管理（pnpm workspace）

---

## 2. 分離の理由

### 単一ディレクトリでサブドメイン分離する場合の問題

| 問題 | 詳細 |
|------|------|
| **ビルド複雑化** | 同一ソースから2つの異なるビルドを生成する仕組みが必要 |
| **不要コードの混入** | admin用コンポーネントがuser側バンドルに含まれるリスク |
| **環境変数管理** | サブドメインごとに異なる設定の管理が煩雑 |
| **デプロイ連動** | 片方だけ更新したい場合も両方ビルドが走る |

### 別ディレクトリのメリット

| メリット | 詳細 |
|---------|------|
| **独立したビルド・デプロイ** | 各サブドメインを個別にデプロイ可能 |
| **バンドルサイズ最適化** | 必要なコードのみ含まれる |
| **チーム分離可能** | 将来的に別チームで開発可能 |
| **設定の明確化** | 環境変数・設定ファイルが分離 |

---

## 3. 目標構造

```
dat-attendance/
├── backend/                    # 共通Backend（現状維持）
│   └── services/
│       ├── auth/              # 認証（共用）
│       ├── app/               # 業務ロジック（共用）
│       ├── notification/      # 通知（共用）
│       └── dev_tools/         # 開発ツール
│
├── frontend-admin/             # 管理画面（現在のfrontendをリネーム）
│   ├── src/
│   │   ├── lib/
│   │   │   ├── api/           # API client（共通パッケージから参照）
│   │   │   └── components/    # 管理画面専用コンポーネント
│   │   └── routes/
│   ├── package.json
│   └── svelte.config.js
│
├── frontend-user/              # ユーザー向け（新規作成）
│   ├── src/
│   │   ├── lib/
│   │   │   ├── api/           # API client（共通パッケージから参照）
│   │   │   └── components/    # ユーザー向けコンポーネント
│   │   └── routes/
│   ├── package.json
│   └── svelte.config.js
│
├── packages/                   # 【新規】共通パッケージ
│   └── shared/
│       ├── api/               # 生成されたAPI client
│       ├── types/             # 共通型定義
│       ├── utils/             # 共通ユーティリティ
│       └── package.json
│
├── CLAUDE.md
├── ACCELERATOR.md
└── pnpm-workspace.yaml         # pnpm workspace設定
```

---

## 4. 共通化 / 分離の方針

### 共通化するもの（packages/shared）

| 対象 | 説明 |
|------|------|
| **API client** | Encore.devから生成される `generated.ts` |
| **認証フロー** | token管理、Cookie操作、自動リフレッシュ |
| **エラー型定義** | UIError、エラーコード、変換関数 |
| **基本ユーティリティ** | 日付処理、文字列操作等 |
| **通知store基盤** | SSE接続、通知状態管理の基盤 |

### 分離するもの（各frontend）

| 対象 | 説明 |
|------|------|
| **レイアウト・デザイン** | 管理画面とユーザー画面で異なるUI |
| **ルーティング** | 各アプリ固有のページ構成 |
| **専用コンポーネント** | 各アプリでのみ使用するUI部品 |
| **環境変数** | サブドメイン、API URL等 |
| **ビルド設定** | svelte.config.js、vite.config.ts |

---

## 5. pnpm workspace 設定

### pnpm-workspace.yaml

```yaml
packages:
  - 'packages/*'
  - 'frontend-admin'
  - 'frontend-user'
```

### packages/shared/package.json

```json
{
  "name": "@dat-attendance/shared",
  "version": "1.0.0",
  "type": "module",
  "exports": {
    "./api": "./api/index.ts",
    "./types": "./types/index.ts",
    "./utils": "./utils/index.ts",
    "./errors": "./errors/index.ts",
    "./auth": "./auth/index.ts"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

### 各frontendからの参照

```json
// frontend-admin/package.json
{
  "dependencies": {
    "@dat-attendance/shared": "workspace:*"
  }
}
```

```typescript
// frontend-admin/src/lib/api/client.ts
import { Client } from '@dat-attendance/shared/api';
import { handleAPIError } from '@dat-attendance/shared/errors';
```

---

## 6. 移行手順

### Phase 1: Workspace基盤構築

```
Step 1.1: pnpm-workspace.yaml 作成
Step 1.2: packages/shared ディレクトリ作成
Step 1.3: 共通コードの抽出・移動
   - api/generated.ts
   - api/client.ts（共通部分）
   - errors/
   - types/
```

### Phase 2: frontend-admin 移行

```
Step 2.1: frontend → frontend-admin にリネーム
Step 2.2: package.json に @dat-attendance/shared 依存追加
Step 2.3: import パスを shared パッケージ参照に修正
Step 2.4: 動作確認
```

### Phase 3: frontend-user 新規作成

```
Step 3.1: SvelteKit プロジェクト新規作成
Step 3.2: 基本設定（TypeScript, Tailwind, DaisyUI）
Step 3.3: @dat-attendance/shared 依存追加
Step 3.4: 認証フロー実装
Step 3.5: ユーザー向けレイアウト作成
Step 3.6: 基本ページ実装
```

### Phase 4: CI/CD・デプロイ設定

```
Step 4.1: 各frontendのビルドスクリプト整備
Step 4.2: サブドメイン設定
Step 4.3: デプロイパイプライン構築
```

---

## 7. デプロイ構成

```
                    ┌─────────────────────────┐
                    │      Load Balancer      │
                    └───────────┬─────────────┘
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
            ▼                   ▼                   ▼
   admin.example.com    app.example.com    api.example.com
            │                   │                   │
   ┌────────┴────────┐ ┌───────┴───────┐  ┌───────┴───────┐
   │ frontend-admin  │ │ frontend-user │  │    backend    │
   │   (Vercel等)    │ │  (Vercel等)   │  │  (Encore.dev) │
   └─────────────────┘ └───────────────┘  └───────────────┘
```

### サブドメイン例

| サブドメイン | 用途 | デプロイ先 |
|-------------|------|-----------|
| `admin.example.com` | 管理画面 | Vercel / Cloudflare Pages |
| `app.example.com` | ユーザー向け | Vercel / Cloudflare Pages |
| `api.example.com` | Backend API | Encore.dev Cloud |

---

## 8. 認証フローの共有

### 共通認証基盤（packages/shared/auth）

```typescript
// packages/shared/auth/index.ts
export { setTokensToCookies, clearTokens, getAccessToken } from './tokens';
export { withAutoRefresh, withErrorHandling } from './middleware';
export type { AuthState, TokenPair } from './types';
```

### 各frontendでの利用

```typescript
// frontend-admin/src/lib/api/client.ts
import { withAutoRefresh, withErrorHandling } from '@dat-attendance/shared/auth';
import { Client } from '@dat-attendance/shared/api';

export function browserClient() {
  return withAutoRefresh(
    withErrorHandling(
      new Client(BACKEND_URL)
    )
  );
}
```

### 権限による分岐

```typescript
// frontend-admin: 管理者権限チェック
export const load = async ({ cookies }) => {
  const client = serverClient(cookies);
  const profile = await client.app.get_user_profile();

  if (!profile.roles.includes('admin') && !profile.roles.includes('manager')) {
    throw redirect(303, USER_APP_URL);  // ユーザー画面へリダイレクト
  }

  return { user: profile };
};

// frontend-user: 認証済みであればOK
export const load = async ({ cookies }) => {
  const client = serverClient(cookies);
  const profile = await client.app.get_user_profile();
  return { user: profile };
};
```

---

## 9. 検討事項・未決定事項

| 項目 | 状態 | 備考 |
|------|------|------|
| サブドメイン名 | 未決定 | 例: admin.xxx.com / app.xxx.com |
| デプロイ先 | 未決定 | Vercel / Cloudflare Pages / 自前 |
| ユーザー向け機能スコープ | 未決定 | 要件定義が必要 |
| Cookie共有方針 | 要検討 | 同一ドメインならCookie共有可能 |
| Backend追加サービス | 要検討 | user_portal サービスが必要か |

---

## 10. 関連ドキュメント

- [CLAUDE.md](../CLAUDE.md) - 開発ルール・禁止事項
- [ACCELERATOR.md](../ACCELERATOR.md) - テンプレート機能説明
- [backend/CLAUDE.md](../backend/CLAUDE.md) - Backend開発ルール
- [frontend/CLAUDE.md](../frontend/CLAUDE.md) - Frontend開発ルール

---

## 更新履歴

| 日付 | 更新内容 |
|------|---------|
| 2025-12-12 | 初版作成 |
