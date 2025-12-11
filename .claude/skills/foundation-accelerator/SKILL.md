---
name: foundation-accelerator
description: |
  dashboard-acceleratorテンプレートの全体像、設計思想、提供機能概要、OpenSpec連携方法を定義。
  このテンプレートが何を提供し、どう拡張すべきかを理解する最初のスキル。
  OpenSpec proposal作成前、新規プロジェクト開始時に必ず参照。

  【WHEN to use】
  - プロジェクト開始時（オンボーディング）
  - OpenSpec proposal作成前（テンプレート理解）
  - 新メンバー参加時（テンプレート説明）
  - 機能の全体像を把握したい時

  【WHEN NOT to use】
  - 具体的な実装パターン確認（foundation-*使用）
  - Critical Rules確認（foundation使用）
  - 機能索引確認（foundation-catalog使用）

  【TRIGGER keywords】
  dashboard-accelerator、テンプレート概要、設計思想、OpenSpec連携、全体像、アーキテクチャ
allowed-tools: Read, Grep
---

# Foundation Accelerator: Dashboard Accelerator テンプレート

## What is Dashboard Accelerator?

dashboard-acceleratorは、Encore.dev + SvelteKitをベースにした**AI駆動開発対応の汎用Admin Dashboardテンプレート**です。

## Quick Start Guide（最初の5分）

### For New Team Members

1. このスキル（foundation-accelerator）を読む（5分）
→ テンプレートの全体像理解

2. foundation-catalog を読む（10分）
→ 提供機能の索引把握

3. foundation を読む（5分）
→ Critical Rules 理解

4. 実際のコードを見る
→ backend/services/auth/
→ frontend/src/lib/components/


### 設計思想

1. **AI-First Architecture**: AIが理解しやすいコード構造・ドキュメント体系
2. **Contract-First**: 仕様→実装の明確な分離（OpenSpec駆動）
3. **Reusable Components**: 実案件で再利用可能な汎用機能群
4. **OpenSpec Integration**: OpenSpecでの仕様駆動開発を前提

**詳細**: `references/design-principles.md`

### 提供価値

- **開発速度**: 認証・通知・エラー処理等の基礎機能が実装済み
- **品質担保**: 統一されたパターン・制約により一貫性確保
- **AI効率**: Claude Skills / OpenSpecによるAIコンテキスト最適化
- **拡張性**: テンプレート制約を守りながら案件固有機能を追加可能

---

## Template Structure

**詳細**: `references/architecture.md`

```
dashboard-accelerator/
├── backend/              # Encore.dev (TypeScript modular monolith)
│   ├── services/
│   │   ├── auth/        # 認証・セッション・権限（テンプレート提供）
│   │   ├── app/         # ユーザー管理 + ビジネスロジック（テンプレート + 案件固有）
│   │   ├── notification/# 通知システム（テンプレート提供）
│   │   └── dev_tools/   # 開発支援（テンプレート提供）
│   └── shared/          # 共有モジュール

**ユーザー管理の構造**:
- **auth.auth_users**: 認証専用（authサービスが管理、auth物理データベース内）
- **app_users**: アプリケーション用（appサービスが管理、app物理データベース内）
  - auth.auth_usersと同じIDで自動作成
  - 実案件で拡張可能なベーステーブル
  - 基本的なプロフィール編集機能を提供
│
├── frontend/            # SvelteKit + Svelte 5 (Runes)
│   ├── src/
│   │   ├── lib/
│   │   │   ├── api/    # API通信（テンプレート提供）
│   │   │   ├── components/ # UIコンポーネント（テンプレート提供）
│   │   │   ├── errors/ # エラー処理（テンプレート提供）
│   │   │   └── stores/ # 状態管理
│   │   └── routes/
│   │       ├── (auth)/ # 認証ページ（テンプレート提供）
│   │       └── (app)/  # アプリページ（案件固有）
│
├── .claude/skills/      # Claude Code Skills（このドキュメント群）
│   ├── foundation-accelerator/  # テンプレート全体像
│   ├── foundation-catalog/      # 機能索引
│   ├── foundation/              # Critical Rules
│   └── foundation-*/            # 機能別スキル（8個）
│
└── openspec/           # OpenSpec仕様管理
    ├── project.md      # プロジェクト全体定義
    ├── proposals/      # 仕様提案
    ├── tasks/          # タスク定義
    └── archive/        # 完了仕様
```

---

## Provided Features（提供機能）

### Core Features

**詳細**: `foundation-catalog` スキル参照

| 機能カテゴリ | 機能 | 説明 | Skill |
|------------|------|------|-------|
| **認証・セッション** | JWT認証 | Access Token (15分) + Refresh Token (30日) | `foundation-auth` |
| | セッション管理 | 最大5同時セッション、family-based rotation | `foundation-auth` |
| | RBAC権限管理 | admin/manager/user/viewer 階層 | `foundation-auth` |
| | IP Trust評価 | 0-100スコアリング、異常検知 | `foundation-auth` |
| **ユーザー管理** | CRUD | ユーザー作成・更新・削除・一覧 | `foundation-auth` |
| | プロフィール | アバター、プロフィール設定 | `foundation-auth` |
| **API通信** | serverClient | SSR用APIクライアント（Cookie自動付与） | `foundation-api` |
| | browserClient | ブラウザ用APIクライアント | `foundation-api` |
| | 自動リフレッシュ | 401エラー時の自動トークン更新 | `foundation-api` |
| | 統一エラー処理 | 自動トースト表示、Sentry送信 | `foundation-api` |
| **UIコンポーネント** | Header | ユーザーメニュー、通知アイコン | `foundation-components` |
| | Sidebar | ナビゲーション、権限制御 | `foundation-components` |
| | Toast | 4種類通知（success/error/info/warning） | `foundation-components` |
| | Modal | DaisyUI標準 + カスタム | `foundation-components` |
| | Error Display | グローバルエラー表示 | `foundation-components` |
| **データベース** | 物理データベース分離 | auth, dev_tools, notification, app | `foundation-database` |
| | Migration管理 | Encore.dev migration system | `foundation-database` |
| | 高度検索 | 完全一致→全文→類似→編集距離 | `foundation-database` |
| | 必須カラム | id, created_at, updated_at, created_by, updated_by | `foundation-database` |
| **エラーハンドリング** | Backend | Encore APIError体系 | `foundation-error-handling` |
| | Frontend | 自動エラー処理（トースト、リダイレクト） | `foundation-error-handling` |
| | エラーコード | 1xxx～9xxx 体系 | `foundation-error-handling` |
| | Sentry統合 | 500系エラー自動送信 | `foundation-error-handling` |
| **通知システム** | SSE | Server-Sent Events リアルタイム通知 | `foundation-notification` |
| | 通知テンプレート | 再利用可能なメッセージテンプレート | `foundation-notification` |
| | 未読管理 | 未読件数カウント | `foundation-notification` |
| **監視・ロギング** | Sentry Backend | Backend エラー追跡 | `foundation-monitoring` |
| | Sentry Frontend | Frontend エラー追跡 | `foundation-monitoring` |
| | Encoreログ | 構造化ログ | `foundation-monitoring` |
| **テスト** | Vitest | Backend ユニットテスト | `foundation-testing` |
| | Playwright | E2Eテスト | `foundation-testing` |
| | Encore Test | Encore統合テスト | `foundation-testing` |

---

## Technology Stack

### Backend
- **Framework**: Encore.dev v1.51.4 (TypeScript modular monolith)
- **Database**: PostgreSQL 14+
- **Extensions**: pg_trgm, fuzzystrmatch, tcn
- **Monitoring**: Sentry v8.55.0
- **Testing**: Vitest v4.0.6

### Frontend
- **Framework**: SvelteKit v2.47.1 + Svelte 5.41.0 (Runes)
- **UI Library**: DaisyUI v5.4.3
- **CSS**: Tailwind CSS v4.1.14
- **Monitoring**: Sentry v8.55.0 (SvelteKit)
- **Testing**: Playwright

### Development Tools
- **ESLint**: @antfu/eslint-config v6.2.0
- **Git Hooks**: Husky + lint-staged
- **Type Checking**: TypeScript (Backend), svelte-check (Frontend)

---

## OpenSpec Integration（重要）

**詳細**: `references/openspec-integration.md`

### OpenSpec × Template の関係

```
OpenSpec (案件固有の仕様)
    ↓
    "Depends on: template-auth"（テンプレート依存を明示）
    ↓
Claude Skills (テンプレート知識)
    ↓
    foundation-auth（実装パターン取得）
    ↓
Implementation (実際のコード)
```

### OpenSpec project.md 推奨構造

```markdown
---
template: dashboard-accelerator
template-version: 1.0.0
base-features: [auth, user-management, notification, error-handling, ui-components]
---

# Project: [案件名]

## Template Foundation

このプロジェクトは **dashboard-accelerator** をベースにしています。

### Provided by Template

- **認証システム**（`foundation-auth`）
  - JWT認証（Access 15分 + Refresh 30日）
  - セッション管理（最大5同時）
  - RBAC権限管理（admin/manager/user/viewer）
  - IP Trust評価

- **ユーザー管理**（`foundation-auth`）
  - CRUD操作
  - プロフィール管理

- **API通信**（`foundation-api`）
  - serverClient / browserClient
  - 自動トークンリフレッシュ
  - 統一エラーハンドリング

- **UIコンポーネント**（`foundation-components`）
  - Header, Sidebar, Toast, Modal
  - Error Display

- **データベース**（`foundation-database`）
  - 物理データベース分離（auth, dev_tools, notification, app）
  - Migration管理
  - 高度検索（pg_trgm）

- **エラー処理**（`foundation-error-handling`）
  - Backend: Encore APIError
  - Frontend: 自動トースト + Sentry

- **通知システム**（`foundation-notification`）
  - SSE リアルタイム通知

- **監視・ロギング**（`foundation-monitoring`）
  - Sentry統合（Backend + Frontend）

- **テスト**（`foundation-testing`）
  - Vitest, Playwright

### Template Constraints

- ❌ テンプレート提供機能の削除禁止
- ❌ 既存エラーハンドリングの迂回禁止
- ❌ ESLintルールの無効化禁止
- ✅ 既存コンポーネント優先活用
- ✅ テンプレート制約遵守（`foundation`参照）

## Project-Specific Features

[案件固有機能をここに記述]

### Business Domain: [ドメイン名]

[ビジネスロジック記述]

### Custom Features

[案件固有のカスタム機能]
```

### OpenSpec Proposal 推奨記載

```markdown
# Proposal: [機能名]

## Template Dependencies

- **Auth**: JWT認証を使用（Skill: `foundation-auth`）
- **Components**: Header, Sidebar, Toast を再利用（Skill: `foundation-components`）
- **API**: serverClient + 統一エラーハンドリング適用（Skill: `foundation-api`）
- **DB**: スキーマ分割パターン適用（`app.*`）（Skill: `foundation-database`）

## Template Constraints Check

✅ テンプレート機能削除なし
✅ 既存コンポーネント再利用
✅ 統一エラー処理適用
✅ DB設計パターン遵守

## Implementation

[実装詳細]
```

---

## Development Workflow with OpenSpec

### 1. プロジェクト開始

```
1. foundation-accelerator 読み込み → テンプレート全体理解
2. foundation-catalog 参照 → 提供済み機能確認
3. foundation 参照 → Critical Rules 確認
4. OpenSpec project.md 作成 → テンプレート依存明記
```

### 2. 新機能開発

```
1. OpenSpec proposal 作成
   → "Template Dependencies"セクションでテンプレート機能明記

2. foundation-catalog 確認
   → 再利用可能な機能特定

3. 該当 foundation-* 参照
   → 実装パターン取得

4. 実装
   → テンプレートパターンに従う

5. OpenSpec archive
   → 仕様蓄積
```

### 3. テンプレート機能拡張

```
1. foundation-* の references/ に新パターン追加
2. foundation-catalog 更新 → 新機能を索引に追加
3. 既存案件への影響確認
```

---

## Extension Principles（拡張原則）

**詳細**: `references/design-principles.md`

### ✅ 推奨される拡張

- **新しいドメインサービス追加**: `backend/services/[domain]/`
- **新しいページ追加**: `frontend/src/routes/(app)/[feature]/`
- **カスタムコンポーネント追加**: `frontend/src/lib/components/custom/`
- **新しいDBスキーマ追加**: `app.*` スキーマに追加
- **ビジネスロジック追加**: `backend/services/app/` 配下

### ❌ 禁止される変更

- テンプレート提供機能の削除・無効化
- 既存エラーハンドリングの迂回
- ESLintルールの無効化・変更
- 技術スタックの代替（例: Tailwind v4→v3）
- auth/dev_tools/notification スキーマの変更
- テンプレートコンポーネントの削除

### 🟡 慎重に検討が必要な変更

- テンプレートコンポーネントの拡張（既存動作を壊さない）
- 新しい認証方式の追加（既存JWT認証と共存）
- 新しいエラーコードの追加（既存体系に準拠）

**詳細**: `foundation` スキルの Critical Rules 参照

---

## Skills Navigation（スキル体系）

### Layer 1: 理解層

- **foundation-accelerator**（このスキル）: テンプレート全体像
- **foundation-catalog**: 提供機能索引・スキルナビゲーション
- **foundation**: Critical Rules・絶対的禁止事項

### Layer 2: 実装層

| Skill | 提供内容 | 主要パターン数 |
|-------|---------|--------------|
| `foundation-auth` | 認証・セッション・権限 | 4 patterns |
| `foundation-api` | API通信・エラー処理 | 3 patterns |
| `foundation-components` | UIコンポーネント | 5 patterns |
| `foundation-database` | DB設計・Migration・検索 | 5 patterns |
| `foundation-error-handling` | エラーハンドリング | 5 patterns |
| `foundation-notification` | 通知システム | 2 patterns |
| `foundation-monitoring` | 監視・ロギング | 2 patterns |
| `foundation-testing` | テスト戦略 | 2 patterns |

### 推奨参照順序

```
新機能開発時:
1. foundation-accelerator（このスキル）
   → テンプレート全体像把握

2. foundation-catalog
   → 既存機能確認、再利用可能性判断

3. foundation
   → Critical Rules 確認

4. 該当 foundation-*
   → 具体的な実装パターン取得
```

---

## For AI Assistants

Session Start:

1. Load foundation-accelerator (Always)
2. Load foundation-catalog (Always)
3. Load foundation (Always)

Task Execution:
4. Check foundation-catalog for existing features
5. Load relevant foundation-* as needed
6. Implement following template patterns



### AI実装時の原則

1. **OpenSpec優先**: 必ずOpenSpec proposal/tasks参照
2. **Template Awareness**: proposal内の"Template Dependencies"確認
3. **Skills参照**: 各タスクの"Skill: foundation-*"参照
4. **Pattern Reuse**: テンプレートパターン最大限活用
5. **Constraint Respect**: `foundation` の Critical Rules 遵守

### AI判断フロー

```
タスク受領
    ↓
OpenSpec tasks確認
    ↓
"Depends on: template-auth"？
    ↓ YES
foundation-auth 読み込み
    ↓
実装パターン取得
    ↓
パターンに従って実装生成
    ↓
foundation 参照 → Critical Rules 違反チェック
    ↓
実装
```

### 新規実装 vs テンプレート拡張の判断

```
機能要求
    ↓
foundation-catalog で確認
    ↓
機能が存在？
    ├─ YES → 該当 foundation-* 参照 → 拡張方法確認
    └─ NO → OpenSpec proposal作成 → 新規実装
```

---

## Version & Maintenance

- **Current Version**: 1.0.0
- **Last Updated**: 2025-11-08
- **Template Repository**: [URL]
- **Changelog**: See `CHANGELOG.md`

### Upgrade Policy

- **Minor Updates** (v1.x.y): 後方互換性あり、自動適用推奨
- **Major Updates** (vX.0.0): 破壊的変更あり、慎重な移行が必要

---

## Quick Links

- **Skills Index**: `foundation-catalog`
- **Critical Rules**: `foundation`
- **Architecture Details**: `references/architecture.md`
- **Design Principles**: `references/design-principles.md`
- **OpenSpec Integration**: `references/openspec-integration.md`

---

## Summary

dashboard-acceleratorは、**AI駆動開発**と**OpenSpec仕様駆動**を前提にした Admin Dashboard テンプレートです。

### Key Takeaways

1. **50+の実装済み機能** - 認証・通知・エラー処理等がすぐ使える
2. **OpenSpec統合設計** - proposal に依存関係を明記して効率化
3. **11の Claude Skills** - AIが理解しやすいドキュメント体系
4. **明確な拡張原則** - ✅推奨 vs ❌禁止が明確

### Next Steps

1. `foundation-catalog` で提供機能を確認
2. `foundation` で Critical Rules を理解
3. `openspec/project.md` にテンプレート依存を記載
4. 案件固有機能の開発開始
