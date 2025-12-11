---
name: foundation-database
description: |
  dashboard-acceleratorテンプレートが提供するPostgreSQLデータベース設計ルール。
  pg_trgm・fuzzystrmatch・tcn エクステンション活用、物理データベース分離、論理スキーマ分割（推奨）、段階的高度検索実装を提供。

  【WHEN to use】
  - データベース設計時
  - Migration作成時
  - 検索機能実装時
  - Database操作時

  【TRIGGER keywords】
  データベース、PostgreSQL、Migration、スキーマ、検索、pg_trgm、fuzzystrmatch
allowed-tools: Read, Grep
---

# Template Database: PostgreSQL設計ルール

## Overview

**PostgreSQL Version**: 14+

### Provided Features

dashboard-acceleratorテンプレートは、以下のデータベース設計ルールを提供しています:

- **物理データベース分離**: auth、dev_tools、notification、app の4つの物理DB
- **論理スキーマ分割（推奨）**: app物理DB内で業務ごとに論理スキーマを作成
- **必須エクステンション**: pg_trgm、fuzzystrmatch、tcn
- **段階的検索**: 完全一致 → 全文検索 → 類似検索 → 編集距離
- **Migration管理**: Encore.dev migration system
- **必須カラム**: id (UUID), created_at, updated_at, created_by, updated_by
- **制約管理**: NOT NULL、UNIQUE、FOREIGN KEY の統一ルール

---

## Quick Reference

### 1. データベース構成

**詳細**: `references/schema-design.md`

**Encore物理データベース分離** (テンプレート提供):
- `auth`: 認証・セッション・ユーザー管理専用
- `notification`: 通知システム専用
- `dev_tools`: 開発ツール専用
- `app`: ビジネスロジック専用

**プロジェクト推奨パターン** (app物理DB内でPostgreSQL論理スキーマ分割):

```sql
-- app物理データベース内に論理スキーマを作成（案件ごとに追加）
CREATE SCHEMA IF NOT EXISTS crm;
CREATE SCHEMA IF NOT EXISTS inventory;

-- テーブル作成例
CREATE TABLE crm.customers (...);
CREATE TABLE inventory.products (...);
```

**原則**:
- ビジネスロジックは必ずapp物理データベース内の論理スキーマ（crm, inventoryなど）に配置
- `auth.*` はテンプレート提供済み（変更禁止）
- `notification.*` はテンプレート提供済み（変更禁止）
- 拡張方法: app物理データベース内に crm, inventory などの論理スキーマを作成し、`crm.customers`, `inventory.products` のようにテーブルを配置

---

### 2. 必須エクステンション

**詳細**: `references/extensions.md`

```sql
-- 類似検索（trigram）
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 編集距離（levenshtein）
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- 変更通知（Trigger Change Notification）
CREATE EXTENSION IF NOT EXISTS tcn;
```

---

### 3. Migration作成

**詳細**: `references/migration.md`

```bash
# Migration作成
cd backend/services/app
encore db migrate create create_customers_table

# Migration実行
encore db migrate

# Rollback
encore db migrate down
```

---

### 4. 段階的検索実装

**詳細**: `references/search.md`

```typescript
// 1. 完全一致
// 2. 全文検索（tsvector）
// 3. 類似検索（pg_trgm）
// 4. 編集距離（levenshtein）

export async function searchCustomers(query: string): Promise<Customer[]> {
  // Step 1: 完全一致
  let results = await db.query(`
    SELECT * FROM crm.customers
    WHERE name = $1
  `, [query]);

  if (results.length > 0) return results;

  // Step 2: 全文検索
  results = await db.query(`
    SELECT * FROM crm.customers
    WHERE to_tsvector('japanese', name) @@ plainto_tsquery('japanese', $1)
  `, [query]);

  if (results.length > 0) return results;

  // Step 3: 類似検索（pg_trgm）
  results = await db.query(`
    SELECT * FROM crm.customers
    WHERE name % $1
    ORDER BY similarity(name, $1) DESC
    LIMIT 10
  `, [query]);

  return results;
}
```

---

## テーブル設計ルール

### 必須カラム

```sql
CREATE TABLE crm.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ビジネスカラム
  name TEXT NOT NULL,
  email TEXT,

  -- 必須メタデータカラム
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.auth_users(id),
  updated_by UUID NOT NULL REFERENCES auth.auth_users(id)
);
```

### NOT NULL ルール

```sql
-- ✅ 推奨: ビジネス上必須のカラムは NOT NULL
name TEXT NOT NULL,
email TEXT NOT NULL,

-- ✅ 推奨: オプショナルなカラムは NULL 許容
phone TEXT,
address TEXT,

-- ❌ 非推奨: NULL の代わりに空文字列を使わない
name TEXT NOT NULL DEFAULT '', -- 使わない
```

---

## インデックス戦略

### 基本インデックス

```sql
-- PRIMARY KEY（自動作成）
CREATE INDEX idx_customers_pkey ON crm.customers(id);

-- FOREIGN KEY
CREATE INDEX idx_customers_created_by ON crm.customers(created_by);
CREATE INDEX idx_customers_updated_by ON crm.customers(updated_by);

-- 検索対象カラム
CREATE INDEX idx_customers_name ON crm.customers(name);
CREATE INDEX idx_customers_email ON crm.customers(email);
```

### 全文検索インデックス

```sql
-- GIN インデックス（全文検索用）
CREATE INDEX idx_customers_name_gin ON crm.customers
USING GIN (to_tsvector('japanese', name));
```

### 類似検索インデックス

```sql
-- GIN インデックス（pg_trgm用）
CREATE INDEX idx_customers_name_trgm ON crm.customers
USING GIN (name gin_trgm_ops);
```

---

## Encore.dev Integration

### Migration ファイル構造

```
backend/services/app/migrations/
├── 1_create_schema.up.sql
├── 1_create_schema.down.sql
├── 2_create_customers.up.sql
├── 2_create_customers.down.sql
├── 3_add_search_indexes.up.sql
└── 3_add_search_indexes.down.sql
```

### Migration実行

```bash
# Migration作成
encore db migrate create migration_name

# Migration実行
encore db migrate

# Migration状態確認
encore db migrate status

# Rollback
encore db migrate down
```

---

## OpenSpec Integration

OpenSpecでDB設計時、テンプレートのスキーマ設計ルールを明記してください:

```markdown
## Database Schema

### Table: crm.customers

Uses: foundation-database schema design
Schema: app (business logic)
Reference: .claude/skills/foundation-database/references/schema-design.md

Columns:
- id UUID PRIMARY KEY (auto-generated)
- name TEXT NOT NULL
- email TEXT NOT NULL
- phone TEXT
- created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
- updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
- created_by UUID NOT NULL REFERENCES auth.auth_users(id)
- updated_by UUID NOT NULL REFERENCES auth.auth_users(id)

Indexes:
- idx_customers_name (search)
- idx_customers_email (unique constraint)
- idx_customers_name_gin (full-text search)
- idx_customers_name_trgm (similarity search)
```

---

## Related Skills

- **foundation-api**: Database接続とクエリ実行
- **foundation-accelerator**: プロジェクト全体構造

---

## 制約

### ❌ 禁止事項

- `auth.*` スキーマのテーブル変更禁止
- `notification.*` スキーマのテーブル変更禁止
- ビジネスロジックを `public` スキーマに配置しない
- Migration を手動で SQL 実行しない（必ず `encore db migrate`）
- `created_at`、`updated_at` を手動で更新しない（Trigger で自動更新）

### ✅ 推奨事項

- ビジネスロジックは `app.*` に配置
- テーブル名は複数形（`customers`、`orders`）
- カラム名は snake_case（`created_at`、`updated_at`）
- UUID を PRIMARY KEY に使用
- 検索対象カラムにインデックスを作成
- 全文検索が必要なカラムに GIN インデックス作成
- Migration は必ず up/down ペアで作成

---

## Next Steps

各設計パターンの詳細な実装ガイドは、references/ 内のファイルを参照してください:

- `references/schema-design.md` - スキーマ設計詳細
- `references/extensions.md` - PostgreSQL拡張機能
- `references/migration.md` - Migration管理
- `references/search.md` - 段階的検索実装
- `examples/migration-patterns.md` - Migration実例
