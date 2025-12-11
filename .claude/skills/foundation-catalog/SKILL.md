---
name: foundation-catalog
description: |
  dashboard-acceleratorテンプレートの機能索引（Feature Catalog）。
  実装開始前に必ず参照し、既存機能の再利用可能性を確認する。
  テンプレートが提供する50+機能を分類・整理し、適切なfoundation-*スキルへナビゲート。

  【WHEN to use】
  - 新機能実装開始前（必須）- 既存機能の重複確認
  - OpenSpec proposal作成時 - Template Dependencies宣言のため
  - 実装可能なコンポーネント・パターンの探索時
  - テンプレートが提供する機能の全体把握時

  【WHEN NOT to use】
  - 特定機能の詳細実装（各 foundation-* スキルを参照）
  - バグ修正のみの作業

  【TRIGGER keywords】
  テンプレート、既存機能、コンポーネント確認、機能一覧、accelerator、catalog、索引
---

# Template Catalog: dashboard-accelerator 機能索引

## About This Catalog

**このカタログの位置づけ**:

```
foundation-accelerator (テンプレート全体像)
    ↓
foundation-catalog (機能索引) ← ★ You are here
    ↓
foundation-* (各機能の詳細実装パターン)
```

**このスキルの目的**:
- **既存機能の発見**: 新機能実装前に既存機能を確認し、車輪の再発明を防止
- **機能の全体把握**: テンプレートが提供する50+機能を素早く把握
- **スキルへのナビゲート**: 適切な foundation-* スキルへの案内
- **OpenSpec連携**: OpenSpec proposal作成時の Template Dependencies 宣言をサポート

**使用フロー**:

```
1. 新機能実装の要求
    ↓
2. foundation-catalog で既存機能確認 ← ★ Start here
    ↓
3. 既存機能が見つかった？
    ├─ YES → 該当 foundation-* スキルを参照 → 拡張実装
    └─ NO  → OpenSpec proposal作成 → 新規実装
```

**重要**: このカタログは **実装前の必須チェックポイント** です。既存機能を見逃すと、重複実装やテンプレート機能との不整合が発生します。

---

## How to Use This Catalog（このカタログの使い方）

### 🔍 Search Tips

#### Pattern 1: キーワード検索

実装したい機能のキーワードで検索:

- "認証" → 認証・認可セクション
- "通知" → 通知システムセクション
- "エラー" → エラーハンドリングセクション

#### Pattern 2: 技術スタック検索

使いたい技術から検索:

- "JWT" → foundation-auth
- "SSE" → foundation-notification
- "pg_trgm" → foundation-database

#### Pattern 3: UI要素検索

実装したいUI要素から検索:

1. "ヘッダー" → foundation-components (Header)
2. "モーダル" → foundation-components (Modal)
3. "トースト" → foundation-components (Toast)

#### Pattern 4: タスクベース検索

やりたいことから検索（推奨）:
→ "Skills Navigation（タスク → Skill マッピング）" セクション参照
例: "ログイン実装" → foundation-auth + references/jwt-pattern.md


### 📊 Feature Coverage

テンプレートが提供する機能のカバレッジ:
- 認証・認可: 100%（JWT, Session, RBAC, IP Trust）
- API通信: 100%（Client, Error Handling, Auto Refresh）
- UI基盤: 80%（Header, Sidebar, Toast, Modal）
- 通知: 80%（SSE, Template）
- エラー: 100%（Unified, Sentry）
- データベース: 90%（Schema, Migration, Search）
- 監視: 100%（Sentry BE/FE）
- テスト: 80%（Vitest, Playwright）

**案件固有実装が必要な領域**:
- ビジネスロジック（100%案件固有）
- ドメイン固有UI（20-50%テンプレート活用）
- カスタムワークフロー（100%案件固有）

---

## Feature Index（機能索引表）

この表は、テンプレートが提供する全機能を一覧し、OpenSpec での宣言方法を示します。

| カテゴリ | 機能 | Skill | OpenSpec 宣言例 |
|---------|------|-------|----------------|
| **認証・認可** | JWT認証 | `foundation-auth` | `Depends on: template-auth (JWT)` |
| | セッション管理 | `foundation-auth` | `Depends on: template-auth (Session)` |
| | 権限管理（RBAC） | `foundation-auth` | `Depends on: template-auth (Permission)` |
| | IP Trust評価 | `foundation-auth` | `Depends on: template-auth (IP Trust)` |
| **API通信** | serverClient | `foundation-api` | `Depends on: template-api (serverClient)` |
| | browserClient | `foundation-api` | `Depends on: template-api (browserClient)` |
| | 自動トークンリフレッシュ | `foundation-api` | `Depends on: template-api (Auto Refresh)` |
| | 統一エラーハンドリング | `foundation-api` | `Depends on: template-api (Error Handling)` |
| **UIコンポーネント** | Header | `foundation-components` | `Depends on: template-components (Header)` |
| | Sidebar | `foundation-components` | `Depends on: template-components (Sidebar)` |
| | Toast | `foundation-components` | `Depends on: template-components (Toast)` |
| | Modal | `foundation-components` | `Depends on: template-components (Modal)` |
| | ErrorBoundary | `foundation-components` | `Depends on: template-components (ErrorBoundary)` |
| **通知システム** | SSEストリーム | `foundation-notification` | `Depends on: template-notification (SSE)` |
| | 通知テンプレート | `foundation-notification` | `Depends on: template-notification (Template)` |
| | 通知設定 | `foundation-notification` | `Depends on: template-notification (Settings)` |
| **エラーハンドリング** | エラーコード体系 | `foundation-error-handling` | `Depends on: template-error (Error Codes)` |
| | 自動エラー表示 | `foundation-error-handling` | `Depends on: template-error (Auto Display)` |
| | Sentry統合 | `foundation-error-handling` | `Depends on: template-error (Sentry)` |
| **データベース** | スキーマ分割 | `foundation-database` | `Depends on: template-database (Schema: app.*)` |
| | pg_trgm検索 | `foundation-database` | `Depends on: template-database (Search: pg_trgm)` |
| | fuzzystrmatch | `foundation-database` | `Depends on: template-database (Search: fuzzy)` |
| | Migration管理 | `foundation-database` | `Depends on: template-database (Migration)` |
| **監視・ロギング** | Sentry（Backend） | `foundation-monitoring` | `Depends on: template-monitoring (Sentry BE)` |
| | Sentry（Frontend） | `foundation-monitoring` | `Depends on: template-monitoring (Sentry FE)` |
| **テスト** | Vitest | `foundation-testing` | `Depends on: template-testing (Vitest)` |
| | Playwright | `foundation-testing` | `Depends on: template-testing (Playwright)` |

**使い方**:
1. 実装したい機能を上記表から探す
2. 該当する Skill を参照
3. OpenSpec proposal に依存関係を宣言（右列の形式）

詳細は各セクションを参照してください。

---

## Provided Features（提供機能詳細）

### 🔐 認証・認可

**詳細スキル**: `foundation-auth`

**提供機能**:
- JWT認証（Access Token 15分 + Refresh Token 30日）
- セッション管理（同時5セッション上限、PostgreSQL）
- 権限管理（Role-Based Access Control）
- IP Trust評価システム
- Trust Scoring（ユーザー行動パターン学習）
- 異常検知システム
- 地理情報取得（IPベース）
- リアルタイムセッション監視

**実装パス**:
- Backend: `backend/services/auth/`
- Frontend: `frontend/src/lib/api/client.ts`（認証フロー統合）

**使用場面**:
- ログイン/ログアウト機能
- 権限チェック
- APIエンドポイントの保護

---

### 🌐 API通信

**詳細スキル**: `foundation-api`

**提供機能**:
- **serverClient()**: SSR用APIクライアント（Cookie自動付与）
- **browserClient()**: ブラウザ用APIクライアント
- **withAutoRefresh()**: 401エラー時の自動トークンリフレッシュ
- **withErrorHandling()**: 統一エラーハンドリング
- HttpOnly Cookie管理
- Token自動管理（setTokensToCookies / clearTokens）

**実装パス**:
- `frontend/src/lib/api/client.ts`

**使用場面**:
- Backend APIとの通信
- SSR/ブラウザでの API呼び出し
- 認証付きAPIリクエスト

---

### 🎨 UIコンポーネント

**詳細スキル**: `foundation-components`
**詳細一覧**: `references/component-index.md`

**提供コンポーネント**:

**基本レイアウト**:
- `Header.svelte`: ユーザーアイコン、プロフィール、通知バッジ
- `Sidebar.svelte`: 開閉式サイドバー、ロール別メニュー表示
- `SidebarItem.svelte`: サイドバーメニューアイテム
- `SidebarToggle.svelte`: サイドバー開閉ボタン

**通知・フィードバック**:
- `ToastHost.svelte`: 一時通知表示ホスト
- `ErrorToast.svelte`: エラー専用トースト
- `ErrorBoundary.svelte`: エラーバウンダリ

**UI要素**:
- `ThemeSelector.svelte`: DaisyUIテーマ切り替え
- `RoleSelect.svelte`: ロール選択UI

**実装パス**:
- `frontend/src/lib/components/`

**使用場面**:
- 管理画面レイアウト構築
- ユーザーフィードバック表示
- 設定画面UI

---

### 🔔 通知システム

**詳細スキル**: `foundation-notification`

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

---

### ⚠️ エラーハンドリング

**詳細スキル**: `foundation-error-handling`

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

---

### 🗄️ データベース設計パターン

**詳細スキル**: `foundation-database`

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

**Migration例**:
- 12個の実装済みMigration

**実装パス**:
- `backend/services/app/migrations/`
- `backend/services/auth/migrations/`
- `backend/services/notification/migrations/`

**使用場面**:
- 新規テーブル設計
- 高度検索機能実装
- データベースMigration作成

---

### 📊 監視・ロギング

**詳細スキル**: `foundation-monitoring`

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

### ✅ 品質チェック機構

**詳細スキル**: `foundation-testing`（テスト）

**提供機能**:

**ESLint**:
- @antfu/eslint-config ベース
- TypeScript type-aware ルール
- Svelte 5対応
- Promise・非同期処理厳格チェック
- any型禁止
- 未使用変数エラー

**SvelteCheck**:
- 型チェック専任

**Husky pre-commit hooks**:
- ESLint --fix 自動実行
- ステージされたファイルのみ

**実装パス**:
- `frontend/eslint.config.js`
- `.lintstagedrc.json`

**使用場面**:
- コード品質維持
- コミット前チェック

---

## Skills Navigation（タスク → Skill マッピング）

このセクションでは、実装タスクから適切な foundation-* スキルへナビゲートします。

### 📋 実装タスク別ガイド

#### 認証・セッション関連

| やりたいこと | 参照Skill | Reference |
|-------------|----------|-----------|
| ログイン/ログアウト実装 | `foundation-auth` | `references/jwt-pattern.md` |
| セッション管理実装 | `foundation-auth` | `references/session-pattern.md` |
| 権限チェック実装 | `foundation-auth` | `references/permission-pattern.md` |
| IP Trust評価実装 | `foundation-auth` | `references/ip-trust-pattern.md` |

#### API通信関連

| やりたいこと | 参照Skill | Reference |
|-------------|----------|-----------|
| SSRでAPI呼び出し | `foundation-api` | `references/client-pattern.md` (serverClient) |
| ブラウザでAPI呼び出し | `foundation-api` | `references/client-pattern.md` (browserClient) |
| エラーハンドリング統合 | `foundation-api` | `references/error-handling.md` |
| 認証付きAPIリクエスト | `foundation-api` | `references/client-pattern.md` |

#### UIコンポーネント関連

| やりたいこと | 参照Skill | Reference |
|-------------|----------|-----------|
| レイアウト構築 | `foundation-components` | `references/header-pattern.md`, `sidebar-pattern.md` |
| トースト通知表示 | `foundation-components` | `references/toast-pattern.md` |
| モーダル実装 | `foundation-components` | `references/modal-pattern.md` |
| 全コンポーネント確認 | `foundation-components` | `references/component-index.md` |

#### 通知システム関連

| やりたいこと | 参照Skill | Reference |
|-------------|----------|-----------|
| リアルタイム通知実装 | `foundation-notification` | `references/sse-backend.md`, `sse-frontend.md` |
| 通知テンプレート作成 | `foundation-notification` | `references/sse-backend.md` |

#### エラーハンドリング関連

| やりたいこと | 参照Skill | Reference |
|-------------|----------|-----------|
| Backendエラー定義 | `foundation-error-handling` | `references/backend-errors.md` |
| Frontendエラー処理 | `foundation-error-handling` | `references/frontend-errors.md` |
| エラーコード追加 | `foundation-error-handling` | `references/error-codes.md` |
| Sentry統合 | `foundation-error-handling` | `references/sentry.md` |

#### データベース関連

| やりたいこと | 参照Skill | Reference |
|-------------|----------|-----------|
| スキーマ設計 | `foundation-database` | `references/schema-design.md` |
| Migration作成 | `foundation-database` | `references/migration.md` |
| 検索機能実装 | `foundation-database` | `references/search.md` |
| PostgreSQL拡張活用 | `foundation-database` | `references/extensions.md` |

#### 監視・ロギング関連

| やりたいこと | 参照Skill | Reference |
|-------------|----------|-----------|
| Sentry設定（Backend） | `foundation-monitoring` | `references/sentry-backend.md` |
| Sentry設定（Frontend） | `foundation-monitoring` | `references/sentry-frontend.md` |

#### テスト関連

| やりたいこと | 参照Skill | Reference |
|-------------|----------|-----------|
| Backend Unit Test作成 | `foundation-testing` | `references/vitest-backend.md` |
| Frontend E2E Test作成 | `foundation-testing` | `references/playwright-e2e.md` |

### 🔍 Quick Links

#### テンプレート全体像を知りたい
→ **foundation-accelerator** スキルを参照
→ `references/architecture.md` でシステムアーキテクチャ確認

#### 設計原則を知りたい
→ **foundation-accelerator** スキルを参照
→ `references/design-principles.md` で拡張ルール確認

#### OpenSpec連携方法を知りたい
→ **foundation-accelerator** スキルを参照
→ `references/openspec-integration.md` で詳細パターン確認

#### プロジェクトルールを確認したい
→ **foundation** スキルを参照
→ Critical Rules, MCP使用ルール確認

---

## Important Constraints（テンプレート制約）

テンプレート上で開発する際の重要な制約：

1. **既存機能の最大限活用**
   - 新規実装前に必ずこのカタログで既存機能を確認
   - 既存機能を優先的に使用

2. **スキーマ統合ルール**
   - `auth`/`dev_tools`/`notification`/`app` 以外の SQLDatabase 新設禁止
   - 業務テーブルは `app` 内に `schema.table` 形式で作成

3. **API通信制約**
   - 直接fetch禁止
   - 必ず `generated/client` 経由

4. **MCP必須使用**
   - Encore MCP、Svelte MCP、Serena MCP を優先使用

5. **Critical Rules**
   - 削除禁止
   - ESLint厳守
   - 代替手段禁止

詳細は **foundation** スキル参照。

---

## References（詳細一覧）

- **機能一覧表**: `references/feature-index.md`
- **コンポーネント一覧表**: `references/component-index.md`

---

## OpenSpec Integration（OpenSpec連携）

### OpenSpec Proposal での Template Dependencies 宣言

OpenSpec の `tasks/` ディレクトリのタスクファイルで、以下のように Template Dependencies を宣言します。

#### 基本パターン

```markdown
# Task: Customer Management Implementation

## Template Dependencies

- **Auth**: JWT認証を使用（Skill: `foundation-auth`）
  - Permission check: manager 以上で編集可
  - Access Token を使用した API 認証
- **Components**: Header, Sidebar, Toast を再利用（Skill: `foundation-components`）
  - Header: ユーザーメニュー表示
  - Sidebar: ナビゲーション
  - Toast: 成功・エラー通知
- **API**: serverClient + 統一エラーハンドリング適用（Skill: `foundation-api`）
  - serverClient() で Backend API 呼び出し
  - エラー時自動トースト表示
- **DB**: スキーマ分割パターン適用（`crm.customers`）（Skill: `foundation-database`）
  - crm.customers テーブル作成
  - pg_trgm で検索インデックス
  - created_by で auth.auth_users を参照

## Template Constraints Check

✅ テンプレート機能削除なし
✅ 既存コンポーネント再利用
✅ 統一エラー処理適用
✅ DB設計パターン遵守
```

#### Archive での記録

タスク完了後、`archive/` に移動し、実装結果を記録：

```markdown
# Task: Customer Management Implementation (Completed)

## Template Dependencies Used

- ✅ **Auth**: JWT認証、Permission middleware（Skill: `foundation-auth`）
  - `services/auth/middleware.ts` の `requirePermission("manager")` を使用
  - Access Token で API 認証
- ✅ **Components**: Header, Sidebar, Toast（Skill: `foundation-components`）
  - `src/lib/components/layout/Header.svelte` 再利用
  - `src/lib/stores/toast.svelte.ts` 再利用
- ✅ **API**: serverClient + handleAPIError（Skill: `foundation-api`）
  - `src/lib/utils/api/server-client.ts` 使用
  - `src/lib/utils/api/error-handler.ts` 使用
- ✅ **DB**: crm.customers テーブル、pg_trgm検索（Skill: `foundation-database`）
  - Migration: `backend/services/app/migrations/1_create_customers.up.sql`
  - pg_trgm インデックス作成済み

## Files Created

**Backend**:
- `backend/services/app/customers.ts`
- `backend/services/app/migrations/1_create_customers.up.sql`

**Frontend**:
- `frontend/src/routes/(app)/customers/list/+page.svelte`
- `frontend/src/routes/(app)/customers/[id]/+page.svelte`

## References

- Skill: `foundation-auth` - 認証・権限
- Skill: `foundation-api` - API通信
- Skill: `foundation-database` - DB設計
```

### AI Assistant へのガイド

**タスク開始時**:
1. `foundation-catalog` で既存機能確認
2. 該当する foundation-* スキルを読み込み
3. 実装パターンに従って実装
4. Template Constraints チェック（削除禁止、エラー処理迂回禁止等）

**詳細**: `foundation-accelerator` の `references/openspec-integration.md` を参照

---

## まとめ

このカタログは、dashboard-accelerator テンプレートの **機能索引** です。

**使用フロー**:
1. **新機能実装前**: このカタログで既存機能を確認（必須）
2. **機能が見つかった**: 該当 foundation-* スキルを参照 → 拡張実装
3. **機能が見つからない**: OpenSpec proposal作成 → 新規実装
4. **OpenSpec連携**: Template Dependencies を宣言
5. **Archive記録**: 完了後、使用した template 機能を記録

**重要リンク**:
- **テンプレート全体像**: `foundation-accelerator`
- **プロジェクトルール**: `foundation`
- **機能詳細一覧**: `references/feature-index.md`
- **コンポーネント一覧**: `references/component-index.md`

このカタログを起点に、適切な foundation-* スキルを参照して実装を進めてください。
