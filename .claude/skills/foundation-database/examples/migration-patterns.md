# Migration パターン実例集

このファイルは、実際のプロジェクトで使用されているMigrationパターンの実例を提供します。

---

## パターン1: 初期スキーマ作成

### 1_create_crm_schema.up.sql

```sql
-- crm論理スキーマ作成（app物理データベース内）
CREATE SCHEMA IF NOT EXISTS crm;

-- UUID生成関数の有効化
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Trigger関数作成（updated_at 自動更新）
CREATE OR REPLACE FUNCTION crm.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 検索用エクステンション
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
```

### 1_create_crm_schema.down.sql

```sql
DROP EXTENSION IF EXISTS fuzzystrmatch;
DROP EXTENSION IF EXISTS pg_trgm;
DROP FUNCTION IF EXISTS crm.update_updated_at();
DROP EXTENSION IF EXISTS "uuid-ossp";
DROP SCHEMA IF EXISTS crm CASCADE;
```

---

## パターン2: 顧客テーブル作成

### 2_create_customers.up.sql

```sql
CREATE TABLE crm.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 基本情報
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,

  -- セグメント情報
  segment TEXT NOT NULL DEFAULT 'regular',
  tags TEXT[] NOT NULL DEFAULT '{}',

  -- 監査カラム
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.auth_users(id),
  updated_by UUID NOT NULL REFERENCES auth.auth_users(id)
);

-- インデックス作成
CREATE INDEX idx_customers_email ON crm.customers(email);
CREATE INDEX idx_customers_name ON crm.customers(name);
CREATE INDEX idx_customers_segment ON crm.customers(segment);
CREATE INDEX idx_customers_created_by ON crm.customers(created_by);
CREATE INDEX idx_customers_updated_by ON crm.customers(updated_by);

-- 検索用インデックス（pg_trgm）
CREATE INDEX idx_customers_name_trgm ON crm.customers USING GIN (name gin_trgm_ops);
CREATE INDEX idx_customers_email_trgm ON crm.customers USING GIN (email gin_trgm_ops);

-- 全文検索インデックス
CREATE INDEX idx_customers_name_gin ON crm.customers USING GIN (to_tsvector('japanese', name));

-- Trigger設定（updated_at 自動更新）
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON crm.customers
  FOR EACH ROW
  EXECUTE FUNCTION crm.update_updated_at();

-- 制約チェック
ALTER TABLE crm.customers
  ADD CONSTRAINT chk_customers_segment
  CHECK (segment IN ('vip', 'regular', 'new'));
```

### 2_create_customers.down.sql

```sql
DROP TRIGGER IF EXISTS update_customers_updated_at ON crm.customers;
DROP INDEX IF EXISTS idx_customers_name_gin;
DROP INDEX IF EXISTS idx_customers_email_trgm;
DROP INDEX IF EXISTS idx_customers_name_trgm;
DROP INDEX IF EXISTS idx_customers_updated_by;
DROP INDEX IF EXISTS idx_customers_created_by;
DROP INDEX IF EXISTS idx_customers_segment;
DROP INDEX IF EXISTS idx_customers_name;
DROP INDEX IF EXISTS idx_customers_email;
DROP TABLE IF EXISTS crm.customers;
```

---

## パターン3: 関連テーブル作成（FOREIGN KEY）

### 3_create_addresses.up.sql

```sql
CREATE TABLE crm.addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- FOREIGN KEY
  customer_id UUID NOT NULL REFERENCES crm.customers(id) ON DELETE CASCADE,

  -- 住所情報
  label TEXT NOT NULL, -- 'home', 'work', 'billing'
  postal_code TEXT NOT NULL,
  prefecture TEXT NOT NULL,
  city TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,

  -- メタデータ
  is_default BOOLEAN NOT NULL DEFAULT false,

  -- 監査カラム
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.auth_users(id),
  updated_by UUID NOT NULL REFERENCES auth.auth_users(id)
);

-- インデックス作成
CREATE INDEX idx_addresses_customer_id ON crm.addresses(customer_id);
CREATE INDEX idx_addresses_label ON crm.addresses(label);

-- Trigger設定
CREATE TRIGGER update_addresses_updated_at
  BEFORE UPDATE ON crm.addresses
  FOR EACH ROW
  EXECUTE FUNCTION crm.update_updated_at();

-- 制約: 1顧客につきデフォルト住所は1つまで
CREATE UNIQUE INDEX idx_addresses_customer_default
  ON crm.addresses(customer_id)
  WHERE is_default = true;
```

### 3_create_addresses.down.sql

```sql
DROP INDEX IF EXISTS idx_addresses_customer_default;
DROP TRIGGER IF EXISTS update_addresses_updated_at ON crm.addresses;
DROP INDEX IF EXISTS idx_addresses_label;
DROP INDEX IF EXISTS idx_addresses_customer_id;
DROP TABLE IF EXISTS crm.addresses;
```

---

## パターン4: カラム追加（NOT NULL）

### 4_add_customer_birthday.up.sql

```sql
-- Step 1: カラム追加（NULL許容）
ALTER TABLE crm.customers
ADD COLUMN birthday DATE;

-- Step 2: デフォルト値設定（既存データ）
UPDATE crm.customers
SET birthday = '1990-01-01'
WHERE birthday IS NULL;

-- Step 3: NOT NULL 制約追加
ALTER TABLE crm.customers
ALTER COLUMN birthday SET NOT NULL;
```

### 4_add_customer_birthday.down.sql

```sql
ALTER TABLE crm.customers
DROP COLUMN IF EXISTS birthday;
```

---

## パターン5: ENUM型の追加

### 5_add_customer_status.up.sql

```sql
-- ENUM型作成
CREATE TYPE crm.customer_status AS ENUM ('active', 'inactive', 'suspended');

-- カラム追加
ALTER TABLE crm.customers
ADD COLUMN status crm.customer_status NOT NULL DEFAULT 'active';

-- インデックス作成
CREATE INDEX idx_customers_status ON crm.customers(status);
```

### 5_add_customer_status.down.sql

```sql
DROP INDEX IF EXISTS idx_customers_status;

ALTER TABLE crm.customers
DROP COLUMN IF EXISTS status;

DROP TYPE IF EXISTS crm.customer_status;
```

---

## パターン6: データマイグレーション

### 6_migrate_customer_segments.up.sql

```sql
-- 既存データのセグメント更新
UPDATE crm.customers
SET segment = CASE
  -- VIP顧客（注文総額 >= 100万円）
  WHEN (
    SELECT COALESCE(SUM(total), 0)
    FROM crm.orders
    WHERE crm.orders.customer_id = crm.customers.id
  ) >= 1000000 THEN 'vip'

  -- 通常顧客（注文総額 >= 1万円）
  WHEN (
    SELECT COALESCE(SUM(total), 0)
    FROM crm.orders
    WHERE crm.orders.customer_id = crm.customers.id
  ) >= 10000 THEN 'regular'

  -- 新規顧客
  ELSE 'new'
END;
```

### 6_migrate_customer_segments.down.sql

```sql
-- セグメントをデフォルト値に戻す
UPDATE crm.customers
SET segment = 'regular';
```

---

## パターン7: パーティショニング

### 7_partition_orders.up.sql

```sql
-- 既存テーブルのリネーム
ALTER TABLE crm.orders RENAME TO orders_old;

-- パーティションテーブル作成
CREATE TABLE crm.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  total NUMERIC(10, 2) NOT NULL,
  ordered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL,
  updated_by UUID NOT NULL
) PARTITION BY RANGE (ordered_at);

-- 月次パーティション作成
CREATE TABLE crm.orders_2024_01 PARTITION OF crm.orders
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE crm.orders_2024_02 PARTITION OF crm.orders
  FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

CREATE TABLE crm.orders_2024_03 PARTITION OF crm.orders
  FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');

-- データ移行
INSERT INTO crm.orders
SELECT * FROM crm.orders_old;

-- 旧テーブル削除
DROP TABLE crm.orders_old;
```

### 7_partition_orders.down.sql

```sql
-- パーティションテーブルのリネーム
ALTER TABLE crm.orders RENAME TO orders_partitioned;

-- 通常テーブルに戻す
CREATE TABLE crm.orders AS
SELECT * FROM crm.orders_partitioned;

-- パーティションテーブル削除
DROP TABLE crm.orders_partitioned CASCADE;
```

---

## パターン8: JSONBカラム追加

### 8_add_customer_metadata.up.sql

```sql
-- JSONB カラム追加
ALTER TABLE crm.customers
ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}';

-- GIN インデックス作成（JSONB検索用）
CREATE INDEX idx_customers_metadata ON crm.customers USING GIN (metadata);

-- 既存データに初期値設定
UPDATE crm.customers
SET metadata = jsonb_build_object(
  'preferences', jsonb_build_object(
    'newsletter', true,
    'email_notifications', true
  )
);
```

### 8_add_customer_metadata.down.sql

```sql
DROP INDEX IF EXISTS idx_customers_metadata;
ALTER TABLE crm.customers DROP COLUMN IF EXISTS metadata;
```

---

## パターン9: Materialized View作成

### 9_create_customer_stats.up.sql

```sql
-- Materialized View作成
CREATE MATERIALIZED VIEW crm.customer_stats AS
SELECT
  c.id AS customer_id,
  c.name,
  c.segment,
  COUNT(o.id) AS total_orders,
  COALESCE(SUM(o.total), 0) AS total_revenue,
  MAX(o.ordered_at) AS last_order_date
FROM crm.customers c
LEFT JOIN crm.orders o ON o.customer_id = c.id
GROUP BY c.id, c.name, c.segment;

-- インデックス作成
CREATE UNIQUE INDEX idx_customer_stats_customer_id ON crm.customer_stats(customer_id);
CREATE INDEX idx_customer_stats_segment ON crm.customer_stats(segment);

-- 定期更新（Cron Job）
-- NOTE: Encore.dev の CronJob で実装
```

### 9_create_customer_stats.down.sql

```sql
DROP MATERIALIZED VIEW IF EXISTS crm.customer_stats;
```

---

## パターン10: 全文検索用Materialized View

### 10_create_search_view.up.sql

```sql
-- 検索用Materialized View
CREATE MATERIALIZED VIEW crm.customers_search AS
SELECT
  c.id,
  c.name,
  c.email,
  c.phone,
  c.segment,
  to_tsvector('japanese', c.name) AS name_vector,
  to_tsvector('simple', c.email) AS email_vector
FROM crm.customers c;

-- GIN インデックス作成
CREATE INDEX idx_customers_search_name ON crm.customers_search USING GIN (name_vector);
CREATE INDEX idx_customers_search_email ON crm.customers_search USING GIN (email_vector);

-- pg_trgm インデックス
CREATE INDEX idx_customers_search_name_trgm ON crm.customers_search USING GIN (name gin_trgm_ops);
```

### 10_create_search_view.down.sql

```sql
DROP MATERIALIZED VIEW IF EXISTS crm.customers_search;
```

---

## Related Patterns

- **schema-design.md**: スキーマ設計詳細
- **migration.md**: Migration管理
- **search.md**: 検索実装
- **extensions.md**: PostgreSQL拡張機能
