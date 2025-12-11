# Migration 管理パターン

## Overview

Encore.dev のMigration システムを使用して、データベーススキーマを管理します。

---

## Migration 作成

### 基本コマンド

```bash
# Migration作成
cd backend/services/app
encore db migrate create create_customers_table

# 作成されるファイル:
# migrations/1_create_customers_table.up.sql
# migrations/1_create_customers_table.down.sql
```

---

### Migration ファイル構造

```
backend/services/app/
├── migrations/
│   ├── 1_create_schema.up.sql
│   ├── 1_create_schema.down.sql
│   ├── 2_create_customers.up.sql
│   ├── 2_create_customers.down.sql
│   ├── 3_add_search_indexes.up.sql
│   └── 3_add_search_indexes.down.sql
└── app.go (or app.ts)
```

---

## Migration 実行

### 基本コマンド

```bash
# Migration実行（up）
encore db migrate

# Migration状態確認
encore db migrate status

# Rollback（down）
encore db migrate down

# 特定のバージョンまでRollback
encore db migrate down --to 2
```

---

## Migration パターン

### パターン1: 論理スキーマ作成

```sql
-- 1_create_crm_schema.up.sql

-- crm論理スキーマ作成（app物理データベース内）
CREATE SCHEMA IF NOT EXISTS crm;

-- Trigger関数作成（updated_at 自動更新）
CREATE OR REPLACE FUNCTION crm.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

```sql
-- 1_create_crm_schema.down.sql

DROP FUNCTION IF EXISTS crm.update_updated_at();
DROP SCHEMA IF EXISTS crm CASCADE;
```

---

### パターン2: テーブル作成

```sql
-- 2_create_customers.up.sql

CREATE TABLE crm.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ビジネスカラム
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  segment TEXT,

  -- 監査カラム
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.auth_users(id),
  updated_by UUID NOT NULL REFERENCES auth.auth_users(id)
);

-- インデックス作成
CREATE INDEX idx_customers_email ON crm.customers(email);
CREATE INDEX idx_customers_name ON crm.customers(name);
CREATE INDEX idx_customers_created_by ON crm.customers(created_by);
CREATE INDEX idx_customers_updated_by ON crm.customers(updated_by);

-- Trigger設定（updated_at 自動更新）
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON crm.customers
  FOR EACH ROW
  EXECUTE FUNCTION crm.update_updated_at();
```

```sql
-- 2_create_customers.down.sql

DROP TRIGGER IF EXISTS update_customers_updated_at ON crm.customers;
DROP INDEX IF EXISTS idx_customers_updated_by;
DROP INDEX IF EXISTS idx_customers_created_by;
DROP INDEX IF EXISTS idx_customers_name;
DROP INDEX IF EXISTS idx_customers_email;
DROP TABLE IF EXISTS crm.customers;
```

---

### パターン3: カラム追加

```sql
-- 3_add_customer_segment.up.sql

ALTER TABLE crm.customers
ADD COLUMN segment TEXT;

-- デフォルト値を設定
UPDATE crm.customers SET segment = 'regular' WHERE segment IS NULL;

-- NOT NULL 制約追加
ALTER TABLE crm.customers
ALTER COLUMN segment SET NOT NULL;
```

```sql
-- 3_add_customer_segment.down.sql

ALTER TABLE crm.customers
DROP COLUMN IF EXISTS segment;
```

---

### パターン4: インデックス追加

```sql
-- 4_add_search_indexes.up.sql

-- PostgreSQL拡張機能のインストール
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- 全文検索インデックス
CREATE INDEX idx_customers_name_gin ON crm.customers
USING GIN (to_tsvector('japanese', name));

-- 類似検索インデックス（pg_trgm）
CREATE INDEX idx_customers_name_trgm ON crm.customers
USING GIN (name gin_trgm_ops);
```

```sql
-- 4_add_search_indexes.down.sql

DROP INDEX IF EXISTS idx_customers_name_trgm;
DROP INDEX IF EXISTS idx_customers_name_gin;

DROP EXTENSION IF EXISTS fuzzystrmatch;
DROP EXTENSION IF EXISTS pg_trgm;
```

---

### パターン5: FOREIGN KEY追加

```sql
-- 5_add_customer_orders.up.sql

CREATE TABLE crm.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  customer_id UUID NOT NULL REFERENCES crm.customers(id) ON DELETE CASCADE,

  total NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  ordered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.auth_users(id),
  updated_by UUID NOT NULL REFERENCES auth.auth_users(id)
);

CREATE INDEX idx_orders_customer_id ON crm.orders(customer_id);
CREATE INDEX idx_orders_status ON crm.orders(status);
```

```sql
-- 5_add_customer_orders.down.sql

DROP INDEX IF EXISTS idx_orders_status;
DROP INDEX IF EXISTS idx_orders_customer_id;
DROP TABLE IF EXISTS crm.orders;
```

---

## データMigration

### パターン: 既存データの更新

```sql
-- 6_migrate_customer_segments.up.sql

-- Step 1: 新しいカラム追加（NULL許容）
ALTER TABLE crm.customers
ADD COLUMN segment TEXT;

-- Step 2: 既存データを移行
UPDATE crm.customers
SET segment = CASE
  WHEN email LIKE '%@vip.com' THEN 'vip'
  WHEN created_at < NOW() - INTERVAL '1 year' THEN 'regular'
  ELSE 'new'
END;

-- Step 3: NOT NULL 制約追加
ALTER TABLE crm.customers
ALTER COLUMN segment SET NOT NULL;
```

```sql
-- 6_migrate_customer_segments.down.sql

ALTER TABLE crm.customers
DROP COLUMN IF EXISTS segment;
```

---

## Migration のベストプラクティス

### 1. 小さく分割

```bash
# ❌ 悪い例: 1つのMigrationで複数の変更
encore db migrate create big_change

# ✅ 良い例: 変更ごとにMigration作成
encore db migrate create create_customers_table
encore db migrate create add_customer_segment
encore db migrate create add_search_indexes
```

---

### 2. Rollback可能に

```sql
-- ✅ 必ず down.sql を作成
-- up.sql
CREATE TABLE crm.customers (...);

-- down.sql
DROP TABLE IF EXISTS crm.customers;
```

---

### 3. 既存データへの配慮

```sql
-- ✅ NOT NULL 制約追加時は既存データにデフォルト値を設定
ALTER TABLE crm.customers ADD COLUMN segment TEXT;
UPDATE crm.customers SET segment = 'regular' WHERE segment IS NULL;
ALTER TABLE crm.customers ALTER COLUMN segment SET NOT NULL;

-- ❌ 既存データがある状態で NOT NULL を追加するとエラー
ALTER TABLE crm.customers ADD COLUMN segment TEXT NOT NULL;
```

---

### 4. インデックス作成は CONCURRENTLY

```sql
-- ✅ CONCURRENTLY を使用（本番環境でロックを避ける）
CREATE INDEX CONCURRENTLY idx_customers_name ON crm.customers(name);

-- ❌ CONCURRENTLY なし（テーブルロックが発生）
CREATE INDEX idx_customers_name ON crm.customers(name);
```

**注意**: `CONCURRENTLY` は Transaction 内では使用不可

---

## Encore.dev Migration 実行フロー

### 1. Local開発環境

```bash
# Migration作成
encore db migrate create create_customers_table

# Migration実行
encore db migrate

# アプリ起動（自動でMigration実行）
encore run
```

---

### 2. Staging/Production環境

```bash
# Migration状態確認
encore db migrate status --env staging

# Migration実行
encore db migrate --env staging

# Rollback
encore db migrate down --env staging
```

---

## トラブルシューティング

### 問題1: Migration が失敗する

**原因**: SQL構文エラー、制約違反

**確認**:
```bash
# Migration実行（詳細ログ）
encore db migrate --verbose
```

**対処**:
```bash
# Migration ファイルを修正
# Rollback してから再実行
encore db migrate down
encore db migrate
```

---

### 問題2: Rollback できない

**原因**: down.sql が不完全、データ損失の可能性

**確認**:
```sql
-- down.sql の内容確認
cat migrations/2_create_customers.down.sql
```

**対処**:
```sql
-- down.sql を修正
-- 必要に応じて手動でSQL実行
encore db conn-uri app | psql -f migrations/2_create_customers.down.sql
```

---

### 問題3: Migration の順序が狂う

**原因**: 複数人が同時にMigration作成

**対処**:
```bash
# Migration番号を手動で調整
mv migrations/3_add_indexes.up.sql migrations/4_add_indexes.up.sql
mv migrations/3_add_indexes.down.sql migrations/4_add_indexes.down.sql
```

---

## Related Patterns

- **schema-design.md**: スキーマ設計
- **extensions.md**: エクステンションのMigration
- **examples/migration-patterns.md**: Migration実例集
