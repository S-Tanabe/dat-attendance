# Dashboard Accelerator - OpenSpec Integration

## 概要

dashboard-accelerator は **OpenSpec駆動開発** を採用しています。
このドキュメントでは、OpenSpec と dashboard-accelerator テンプレートの統合方法を詳しく説明します。

---

## OpenSpec とは

**OpenSpec** は、プロジェクトの仕様・タスク・アーカイブを構造化して管理する仕組みです。

```
openspec/
├── project.md        # プロジェクト全体のコンテキスト（Template Foundation含む）
├── tasks/            # 実行中のタスク
│   ├── task-001-customer-management.md
│   └── task-002-order-processing.md
└── archive/          # 完了したタスク
    └── task-001-customer-management.md
```

---

## OpenSpec × Template の関係

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
│                  Claude Skills Layer                     │
│  (テンプレート知識・実装パターン)                        │
│                                                           │
│  foundation-accelerator: テンプレート全体像              │
│  foundation-auth: 認証実装パターン                       │
│  foundation-catalog: 機能索引                            │
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

---

## project.md の推奨構成

### テンプレートメタデータ

```yaml
---
template: dashboard-accelerator
template-version: 1.0.0
base-features: [auth, user-management, notification, error-handling, ui-components, database]
---
```

### Template Foundation セクション

```markdown
# Project: [案件名]

## Template Foundation (dashboard-accelerator)

このプロジェクトは **dashboard-accelerator** テンプレートをベースに構築されています。
テンプレートが提供する機能を必ず確認してから、新規実装を開始してください。

### Provided by Template

**認証・セッション管理** (`foundation-auth`):
- JWT認証（Access Token 15分 + Refresh Token 30日）
- セッション管理（最大5同時セッション）
- RBAC権限管理（admin/manager/user/viewer）
- IP Trust評価システム

**API通信** (`foundation-api`):
- serverClient() / browserClient()
- 自動トークンリフレッシュ（401エラー時）
- 統一エラーハンドリング（自動トースト表示）
- Sentry自動送信（500系エラー）

**UIコンポーネント** (`foundation-components`):
- Header（ユーザーメニュー、通知アイコン）
- Sidebar（ナビゲーション、権限制御）
- Toast通知システム
- Modal（DaisyUI標準 + カスタム）
- Error Display

**データベース設計** (`foundation-database`):
- 物理データベース分離（auth, dev_tools, notification, app）
- 必須エクステンション（pg_trgm, fuzzystrmatch, tcn）
- 段階的検索（完全一致 → 全文検索 → 類似検索 → 編集距離）
- Migration管理（Encore.dev）

**エラーハンドリング** (`foundation-error-handling`):
- Backend: Encore APIError体系
- Frontend: 自動エラー処理（トースト、リダイレクト）
- エラーコード体系（1xxx～9xxx）
- Sentry統合

**通知システム** (`foundation-notification`):
- SSE（Server-Sent Events）リアルタイム通知
- 通知テンプレート
- 未読管理

**監視・ロギング** (`foundation-monitoring`):
- Sentry統合（Backend + Frontend）
- Encoreログ

**テスト** (`foundation-testing`):
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

1. **機能実装前**: `foundation-catalog` スキルで既存機能を確認
2. **実装中**: 該当する `foundation-*` スキルを参照
3. **OpenSpec記載**: 使用したテンプレート機能を明記

**OpenSpec記載例**:
```markdown
## Authentication

Uses: foundation-auth JWT pattern
Reference: .claude/skills/foundation-auth/references/jwt-pattern.md

## Database

Uses: foundation-database schema design
Schema: app.customers
Reference: .claude/skills/foundation-database/references/schema-design.md
```
```

### プロジェクト固有情報

```markdown
## Purpose

[プロジェクトの目的・目標を記載]

この案件は製造業向けの顧客管理システムです。
顧客情報の一元管理、注文履歴追跡、在庫連携を提供します。

## Tech Stack

- Backend: Encore.dev v1.51.4 (TypeScript modular monolith)
- Frontend: SvelteKit v2 + Svelte 5 (Runes)
- Database: PostgreSQL 14+ (pg_trgm, fuzzystrmatch, tcn)
- UI: DaisyUI v5.4.3 + Tailwind CSS v4.1.14
- Monitoring: Sentry v8.55.0
- Testing: Vitest v4.0.6, Playwright

## Domain Context

**製造業特有の用語**:
- 案件: 顧客からの製造依頼
- 工程: 製造プロセスのステップ
- 納期: 製品納品期限

**主要エンティティ**:
- 顧客（Customer）
- 案件（Project）
- 注文（Order）
- 在庫（Inventory）

## Important Constraints

- 納期遅延アラートは3日前に通知
- 在庫が閾値を下回った場合、自動発注
- 顧客情報は manager 以上のみ編集可

## External Dependencies

- 在庫管理システム（REST API連携）
- メール送信サービス（SendGrid）
```

---

## tasks/ ディレクトリのタスク定義

### タスクファイル構造

```markdown
---
id: task-001
title: Customer Management Implementation
status: in-progress
created: 2025-01-08
updated: 2025-01-10
assignee: Claude Code
---

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
- **DB**: スキーマ分割パターン適用（`app.customers`）（Skill: `foundation-database`）
  - app.customers テーブル作成
  - pg_trgm で検索インデックス
  - created_by で auth.users を参照

## Template Constraints Check

✅ テンプレート機能削除なし
✅ 既存コンポーネント再利用
✅ 統一エラー処理適用
✅ DB設計パターン遵守

## Objectives

顧客管理機能を実装する:
- 顧客CRUD操作（作成・表示・更新・削除）
- 検索機能（名前・会社名・メールアドレス）
- 権限チェック（manager以上のみ編集可）
- エラーハンドリング統合

## Implementation Tasks

### Backend (Encore.dev)

- [ ] Migration作成（`app.customers`）
  - Skill: `foundation-database` 参照
  - Reference: `.claude/skills/foundation-database/references/migration.md`
- [ ] API実装（`services/app/customers.ts`）
  - Skill: `foundation-api` 参照
  - エンドポイント: createCustomer, getCustomer, updateCustomer, deleteCustomer, searchCustomers
- [ ] Permission middleware 統合
  - Skill: `foundation-auth` 参照
  - Reference: `.claude/skills/foundation-auth/references/permission-pattern.md`
- [ ] エラーハンドリング統合
  - Skill: `foundation-error-handling` 参照
  - Reference: `.claude/skills/foundation-error-handling/references/backend-errors.md`

### Frontend (SvelteKit)

- [ ] 顧客一覧画面（`/customers/list`）
  - Skill: `foundation-components` 参照
  - Components: CustomerTable, CustomerFilter, CustomerPagination
- [ ] 顧客詳細画面（`/customers/[id]`）
  - Components: CustomerProfile, CustomerEditModal
- [ ] 顧客作成画面（`/customers/new`）
  - Form validation
  - use:enhance でフォーム送信
- [ ] API通信実装
  - serverClient() 使用（+page.server.ts）
  - handleAPIError() でエラー処理

### Testing

- [ ] Backend Unit Tests (Vitest)
  - Skill: `foundation-testing` 参照
  - Reference: `.claude/skills/foundation-testing/references/vitest-backend.md`
- [ ] Frontend E2E Tests (Playwright)
  - Reference: `.claude/skills/foundation-testing/references/playwright-e2e.md`

## Expected Behavior

**顧客作成**:
1. ユーザーが `/customers/new` にアクセス
2. フォームに顧客情報入力
3. 送信ボタンクリック
4. Backend API (`createCustomer`) 呼び出し
5. 成功: トースト表示 + 詳細画面へ遷移
6. エラー: トースト表示 + フォームにエラーメッセージ

**顧客検索**:
1. ユーザーが検索ボックスに入力
2. Backend API (`searchCustomers`) 呼び出し
3. 段階的検索（完全一致 → 全文検索 → 類似検索）
4. 結果をテーブル表示

**権限チェック**:
- viewer: 閲覧のみ
- user: 閲覧のみ
- manager: 作成・編集・削除
- admin: 作成・編集・削除

## Acceptance Criteria

- [ ] 顧客CRUD操作が正常に動作
- [ ] 検索機能が正常に動作（pg_trgm活用）
- [ ] 権限チェックが正常に動作（manager以上のみ編集可）
- [ ] エラー時に適切なトースト表示
- [ ] Backend Unit Tests がパス
- [ ] Frontend E2E Tests がパス

## Notes

- 顧客削除は論理削除（soft delete）を検討
- 検索結果は20件ごとにページネーション
- 顧客作成時に自動でウェルカムメール送信（通知システム活用）

## References

- Skill: `foundation-catalog` - 全機能索引
- Skill: `foundation-auth` - 認証・権限
- Skill: `foundation-api` - API通信
- Skill: `foundation-database` - DB設計
- Skill: `foundation-error-handling` - エラー処理
- Skill: `foundation-components` - UIコンポーネント
```

---

## archive/ ディレクトリのアーカイブ

タスク完了後、`tasks/` から `archive/` に移動し、実装結果を記録します。

```markdown
---
id: task-001
title: Customer Management Implementation
status: completed
created: 2025-01-08
completed: 2025-01-15
assignee: Claude Code
---

# Task: Customer Management Implementation (Completed)

## Template Dependencies Used

- ✅ **Auth**: JWT認証、Permission middleware（Skill: `foundation-auth`）
  - `services/auth/middleware.ts` の `requirePermission("manager")` を使用
  - Access Token で API 認証
- ✅ **Components**: Header, Sidebar, Toast（Skill: `foundation-components`）
  - `src/lib/components/layout/Header.svelte` 再利用
  - `src/lib/components/layout/Sidebar.svelte` 再利用
  - `src/lib/stores/toast.svelte.ts` 再利用
- ✅ **API**: serverClient + handleAPIError（Skill: `foundation-api`）
  - `src/lib/utils/api/server-client.ts` 使用
  - `src/lib/utils/api/error-handler.ts` 使用
- ✅ **DB**: app.customers テーブル、pg_trgm検索（Skill: `foundation-database`）
  - Migration: `backend/services/app/migrations/1_create_customers.up.sql`
  - pg_trgm インデックス作成済み

## Implementation Summary

### Backend

**Migration作成**:
```sql
-- backend/services/app/migrations/1_create_customers.up.sql
CREATE TABLE app.customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  company VARCHAR(255),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customers_name_trgm ON app.customers USING gin (name gin_trgm_ops);
CREATE INDEX idx_customers_company_trgm ON app.customers USING gin (company gin_trgm_ops);
```

**API実装**:
- `backend/services/app/customers.ts` 作成
- エンドポイント: createCustomer, getCustomer, updateCustomer, deleteCustomer, searchCustomers
- Permission middleware 統合（manager以上）
- APIError 使用（foundation-error-handling パターン）

**検索実装**:
```typescript
// 段階的検索（foundation-database パターン）
const customers = await db.query`
  SELECT * FROM app.customers
  WHERE name % ${query}
  ORDER BY similarity(name, ${query}) DESC
  LIMIT 20
`;
```

### Frontend

**画面作成**:
- `/customers/list` - 顧客一覧
- `/customers/[id]` - 顧客詳細
- `/customers/new` - 顧客作成

**コンポーネント作成**:
- `routes/(app)/customers/list/components/CustomerTable.svelte`
- `routes/(app)/customers/list/components/CustomerFilter.svelte`
- `routes/(app)/customers/[id]/components/CustomerProfile.svelte`
- `routes/(app)/customers/[id]/components/CustomerEditModal.svelte`

**API通信**:
- serverClient() 使用（+page.server.ts）
- handleAPIError() でエラー処理
- 成功時: トースト表示 + ページ遷移
- エラー時: トースト表示

### Testing

**Backend Unit Tests**:
- `backend/services/app/customers.test.ts` 作成
- Vitest でテスト（foundation-testing パターン）
- カバレッジ: 85%

**Frontend E2E Tests**:
- `tests/customers/create.spec.ts`
- `tests/customers/search.spec.ts`
- Playwright でテスト（foundation-testing パターン）
- 全テストパス

## Acceptance Criteria Results

- ✅ 顧客CRUD操作が正常に動作
- ✅ 検索機能が正常に動作（pg_trgm活用）
- ✅ 権限チェックが正常に動作（manager以上のみ編集可）
- ✅ エラー時に適切なトースト表示
- ✅ Backend Unit Tests がパス
- ✅ Frontend E2E Tests がパス

## Files Created

**Backend**:
- `backend/services/app/customers.ts`
- `backend/services/app/migrations/1_create_customers.up.sql`
- `backend/services/app/customers.test.ts`

**Frontend**:
- `frontend/src/routes/(app)/customers/list/+page.svelte`
- `frontend/src/routes/(app)/customers/list/+page.server.ts`
- `frontend/src/routes/(app)/customers/list/components/CustomerTable.svelte`
- `frontend/src/routes/(app)/customers/list/components/CustomerFilter.svelte`
- `frontend/src/routes/(app)/customers/[id]/+page.svelte`
- `frontend/src/routes/(app)/customers/[id]/+page.server.ts`
- `frontend/src/routes/(app)/customers/[id]/components/CustomerProfile.svelte`
- `frontend/src/routes/(app)/customers/[id]/components/CustomerEditModal.svelte`
- `frontend/src/routes/(app)/customers/new/+page.svelte`
- `frontend/src/routes/(app)/customers/new/+page.server.ts`

**Tests**:
- `tests/customers/create.spec.ts`
- `tests/customers/search.spec.ts`

## Lessons Learned

- pg_trgm の類似検索は非常に強力（部分一致・typo許容）
- serverClient() + handleAPIError() で統一されたエラー処理が可能
- Colocation原則により、コンポーネント管理が容易
- Permission middleware の再利用性が高い

## Future Improvements

- 顧客削除を論理削除（soft delete）に変更
- 顧客作成時のウェルカムメール送信（通知システム活用）
- エクスポート機能（CSV/Excel）追加
```

---

## AI Assistant への指示

### タスク開始時の判断フロー

```
タスク受領
    ↓
openspec/tasks/xxx.md を読む
    ↓
"Template Dependencies" セクション確認
    ↓
依存関係あり？
    ├─ YES → 該当する foundation-* Skill を読み込み
    │         ↓
    │         実装パターン取得
    │         ↓
    │         パターンに従って実装
    │
    └─ NO → openspec/project.md の "Template Foundation" 確認
              ↓
              使用可能な機能を確認
              ↓
              foundation-catalog で機能索引確認
              ↓
              実装 or 新規作成提案
```

### 新規実装 vs テンプレート拡張の判断

```
機能要求
    ↓
foundation-catalog で確認
    ↓
類似機能が存在？
    ├─ YES → 該当 foundation-* 参照
    │         ↓
    │         拡張方法確認
    │         ↓
    │         拡張実装
    │
    └─ NO → OpenSpec proposal作成提案
              ↓
              Template Constraints チェック
              ↓
              新規実装
```

### Template Constraints チェック

```
実装前チェック
    ↓
テンプレート機能を削除していない？
    ├─ YES → ❌ 実装禁止、ユーザーに通知
    └─ NO → ✅ 次へ
    ↓
エラーハンドリングを迂回していない？
    ├─ YES → ❌ 実装禁止、handleAPIError使用を提案
    └─ NO → ✅ 次へ
    ↓
ESLintルールを無効化していない？
    ├─ YES → ❌ 実装禁止、適切な型定義を提案
    └─ NO → ✅ 次へ
    ↓
技術スタックを変更していない？
    ├─ YES → ❌ 実装禁止、PostgreSQL継続を提案
    └─ NO → ✅ 実装開始
```

---

## まとめ

dashboard-accelerator と OpenSpec の統合ポイント:

1. **project.md に Template Foundation セクション** - テンプレート提供機能を明記
2. **tasks/ に Template Dependencies セクション** - 使用する template 機能を宣言
3. **archive/ に実装結果記録** - 使用したテンプレート機能と成果物を記録
4. **AI は Template Constraints をチェック** - 禁止事項違反を防止

この統合により、**テンプレート機能の最大活用** と **プロジェクト品質の維持** が可能になります。
