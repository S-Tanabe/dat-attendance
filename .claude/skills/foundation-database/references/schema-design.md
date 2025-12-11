# スキーマ設計パターン

## データベース構成

dashboard-acceleratorテンプレートは、Encore.devの4つの物理データベースで構成されています:

```
Encore Physical Databases
│
├─ auth (認証・ユーザー管理) - 物理データベース
│  ├─ auth_users
│  ├─ auth_sessions
│  └─ auth_user_devices
│
├─ dev_tools (開発者ツール) - 物理データベース
│  └─ dev_admin_audit_logs
│
├─ notification (通知システム) - 物理データベース
│  ├─ notifications
│  └─ notification_deliveries
│
└─ app (ビジネスロジック) - 物理データベース
   ├─ public (デフォルト論理スキーマ) ※テンプレート提供
   │  ├─ roles
   │  └─ app_users
   └─ (推奨パターン: crm, inventoryなどの論理スキーマをプロジェクト実装時に追加)
```

**重要**: Encoreは各サービスに物理的に独立したデータベースを提供します。上記の `auth`, `dev_tools`, `notification`, `app` は PostgreSQL スキーマではなく、**物理的に分離されたデータベース**です。

**推奨パターン**: 業務系サービスは全て `app` 物理データベースを使用し、マイグレーションでPostgreSQL論理スキーマ（`crm`, `inventory`等）を作成して機能別に分割します。

---

## データベース詳細

### 1. auth 物理データベース（テンプレート提供）

**用途**: 認証・セッション・ユーザー管理

**提供テーブル**:

```sql
-- ユーザー（auth物理データベース内）
CREATE TABLE auth_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- セッション
CREATE TABLE auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  refresh_token_family UUID,
  user_agent TEXT,
  ip_address TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  device_id UUID,
  device_name TEXT,
  last_activity_at TIMESTAMPTZ DEFAULT now(),
  session_type TEXT DEFAULT 'web',
  is_suspicious BOOLEAN DEFAULT false,
  geo_country TEXT,
  geo_city TEXT,
  geo_region TEXT,
  geo_latitude DOUBLE PRECISION,
  geo_longitude DOUBLE PRECISION,
  geo_timezone TEXT,
  risk_score INTEGER DEFAULT 0,
  risk_factors JSONB DEFAULT '{}'
);

-- セッション監査ログ
CREATE TABLE auth_session_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID,
  user_id UUID,
  action TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  device_id UUID,
  device_name TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ユーザーデバイス
CREATE TABLE auth_user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  device_id UUID NOT NULL UNIQUE,
  device_name TEXT NOT NULL,
  device_fingerprint TEXT,
  trusted BOOLEAN DEFAULT false,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trust_score INTEGER DEFAULT 50,
  successful_logins INTEGER DEFAULT 0,
  failed_attempts INTEGER DEFAULT 0,
  risk_events JSONB DEFAULT '[]',
  geo_locations JSONB DEFAULT '[]',
  usual_time_pattern JSONB DEFAULT '{}'
);

-- クリーンアップ統計
CREATE TABLE auth_cleanup_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expired_sessions_deleted INTEGER NOT NULL DEFAULT 0,
  revoked_sessions_deleted INTEGER NOT NULL DEFAULT 0,
  audit_logs_archived INTEGER NOT NULL DEFAULT 0,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 異常ログ
CREATE TABLE auth_anomaly_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  session_id UUID,
  device_id UUID,
  anomaly_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  risk_score INTEGER NOT NULL DEFAULT 0,
  details JSONB NOT NULL,
  ip_address TEXT,
  geo_location JSONB,
  user_agent TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  auto_blocked BOOLEAN DEFAULT false,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_notes TEXT
);

-- リアルタイムアクティビティ
CREATE TABLE auth_realtime_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  session_id UUID,
  device_id UUID,
  activity_type TEXT NOT NULL,
  endpoint TEXT,
  ip_address TEXT,
  geo_location JSONB,
  risk_score INTEGER,
  response_time_ms INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- IPレピュテーション
CREATE TABLE auth_ip_reputation (
  ip_address TEXT PRIMARY KEY,
  risk_level TEXT NOT NULL,
  risk_score INTEGER NOT NULL DEFAULT 0,
  threat_types JSONB DEFAULT '[]',
  country TEXT,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  reports_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**制約**:
- ❌ **変更禁止** - auth物理データベース内のテーブルはテンプレートが管理
- ❌ **削除禁止** - auth物理データベース内のテーブルの削除は禁止
- ✅ **参照OK** - auth_users(id) への FOREIGN KEY は許可（**注**: 他の物理DBから参照する場合はEncoreのクロスサービス参照を使用）

---

### 2. dev_tools 物理データベース（テンプレート提供）

**用途**: 開発者ツール（APIキー管理など）

**提供テーブル**:

```sql
-- 監査ログ（dev_tools物理データベース内）
CREATE TABLE dev_admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID,
  actor_email TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  payload JSONB,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  severity TEXT DEFAULT 'info',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**制約**:
- ❌ **変更禁止** - `dev_tools.*` テーブルはテンプレートが管理

---

### 3. notification 物理データベース（テンプレート提供）

**用途**: 通知システム（SSE、メール、プッシュ通知）

**提供テーブル**:

```sql
-- 通知（notification物理データベース内）
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL DEFAULT 'system',
  source TEXT NOT NULL,
  user_id UUID,
  template_id TEXT,
  subject TEXT,
  message TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'pending',
  channels TEXT[] NOT NULL DEFAULT '{}',
  variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  retry_count INT NOT NULL DEFAULT 0,
  max_retry INT NOT NULL DEFAULT 3,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 通知配信（notification物理データベース内）
CREATE TABLE notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ユーザー通知設定（notification物理データベース内）
CREATE TABLE user_notification_preferences (
  user_id UUID PRIMARY KEY,
  channel_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  priority_threshold TEXT NOT NULL DEFAULT 'normal',
  muted_until TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 管理者通知プロファイル（notification物理データベース内）
CREATE TABLE admin_notification_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_key TEXT NOT NULL UNIQUE,
  description TEXT,
  channel_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  priority_threshold TEXT NOT NULL DEFAULT 'normal',
  escalation_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**制約**:
- ❌ **変更禁止** - notification物理データベース内のテーブルはテンプレートが管理
- ✅ **参照OK** - notification物理データベース内のテーブルへの参照は可能（Encoreクロスサービス参照使用）

---

### 4. app 物理データベース（プロジェクト固有）

**用途**: ビジネスロジック（顧客、注文、商品など）

**推奨構造**:

```sql
-- app物理データベース内のビジネステーブル例

-- ロール（app物理データベース内、public論理スキーマ） ※テンプレート提供
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  level INT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- アプリケーションユーザー（app物理データベース内、public論理スキーマ） ※テンプレート提供
CREATE TABLE app_users (
  id UUID PRIMARY KEY,  -- auth物理DBのauth_usersと同じID
  display_name TEXT,
  avatar_url TEXT,
  role_id UUID REFERENCES roles(id),
  first_name TEXT,
  last_name TEXT,
  first_name_romaji TEXT,
  last_name_romaji TEXT,
  avatar_bucket_key TEXT,
  timezone TEXT DEFAULT 'Asia/Tokyo',
  language TEXT DEFAULT 'ja',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- プロジェクト推奨パターン: crm論理スキーマを作成
-- CREATE SCHEMA IF NOT EXISTS crm;
--
-- CREATE TABLE crm.customers (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   name TEXT NOT NULL,
--   email TEXT NOT NULL UNIQUE,
--   phone TEXT,
--   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--   updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--   created_by UUID,  -- auth物理DBへの参照はEncoreクロスサービス参照で実装
--   updated_by UUID
-- );
```

**原則**:
- ✅ **自由に設計** - app物理データベース内のテーブルはプロジェクト固有
- ✅ **推奨カラム**: id, created_at, updated_at （created_by, updated_byは案件により追加）
- ✅ **クロスDB参照**: auth物理DBのauth_usersへの参照はEncoreのクロスサービス参照機能を使用
- ✅ **論理スキーマ分割**: プロジェクト実装時にcrm, inventoryなどの論理スキーマを作成してテーブルを整理することを推奨

---

## 必須カラム

app物理データベース内のテーブルは、以下の基本カラムを**推奨**します:

```sql
-- 基本例（public論理スキーマ）
CREATE TABLE example (
  -- PRIMARY KEY（UUID）
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ビジネスカラム
  name TEXT NOT NULL,
  description TEXT,

  -- 推奨メタデータカラム
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 監査カラム付き（crm論理スキーマの例）
-- CREATE TABLE crm.customers (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   name TEXT NOT NULL,
--   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--   updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--   created_by UUID NOT NULL REFERENCES auth.auth_users(id),
--   updated_by UUID NOT NULL REFERENCES auth.auth_users(id)
-- );
```

### 自動更新 Trigger

`updated_at` は Trigger で自動更新:

```sql
-- Trigger関数作成（crm論理スキーマの例）
-- CREATE OR REPLACE FUNCTION crm.update_updated_at()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   NEW.updated_at = NOW();
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- Trigger設定
-- CREATE TRIGGER update_customers_updated_at
--   BEFORE UPDATE ON crm.customers
--   FOR EACH ROW
--   EXECUTE FUNCTION crm.update_updated_at();
```

---

## テーブル命名規則

### テーブル名

```sql
-- ✅ 推奨: 複数形
-- app物理データベース内のpublic論理スキーマの場合
CREATE TABLE roles (...);
CREATE TABLE app_users (...);

-- crm論理スキーマを追加する場合の例
-- CREATE TABLE crm.customers (...);
-- CREATE TABLE crm.orders (...);
-- CREATE TABLE crm.products (...);

-- ❌ 非推奨: 単数形
-- CREATE TABLE crm.customer (...);
```

### カラム名

```sql
-- ✅ 推奨: snake_case
created_at TIMESTAMPTZ NOT NULL,
customer_name TEXT NOT NULL,

-- ❌ 非推奨: camelCase
createdAt TIMESTAMPTZ NOT NULL,
customerName TEXT NOT NULL,
```

---

## 制約の設計

### NOT NULL 制約

```sql
-- ビジネス上必須のカラムは NOT NULL
name TEXT NOT NULL,
email TEXT NOT NULL,

-- オプショナルなカラムは NULL 許容
phone TEXT,
address TEXT,
```

### UNIQUE 制約

```sql
-- メールアドレスは一意
email TEXT NOT NULL UNIQUE,

-- 複合UNIQUE制約
CONSTRAINT uq_customer_email UNIQUE (customer_id, email),
```

### FOREIGN KEY 制約

```sql
-- auth物理データベース内のauth_usersへの参照
created_by UUID NOT NULL REFERENCES auth.auth_users(id),

-- 同一物理データベース内の参照（例: crm論理スキーマ）
-- customer_id UUID NOT NULL REFERENCES crm.customers(id),

-- カスケード削除
-- customer_id UUID NOT NULL REFERENCES crm.customers(id) ON DELETE CASCADE,
```

---

## インデックス設計

### 基本インデックス

```sql
-- PRIMARY KEY（自動作成）
-- 明示的に作成不要

-- 現在のapp物理データベース内のpublic論理スキーマの例
CREATE INDEX idx_app_users_email ON app_users(email);
CREATE INDEX idx_app_users_role_id ON app_users(role_id);

-- 将来的なcrm論理スキーマの例
-- -- FOREIGN KEY
-- CREATE INDEX idx_orders_customer_id ON crm.orders(customer_id);
-- CREATE INDEX idx_orders_created_by ON crm.orders(created_by);
--
-- -- 検索対象カラム
-- CREATE INDEX idx_customers_email ON crm.customers(email);
-- CREATE INDEX idx_customers_name ON crm.customers(name);
```

### 複合インデックス

```sql
-- 複数カラムでの検索が多い場合（crm論理スキーマの例）
-- CREATE INDEX idx_orders_customer_status ON crm.orders(customer_id, status);
```

---

## スキーマ権限管理

### Encore.dev での権限設定

Encore.dev は自動的に適切な権限を設定しますが、手動設定する場合:

```sql
-- Encore.devが自動的に適切な権限を設定します
-- 手動設定が必要な場合のみ以下を参考にしてください

-- auth物理データベース（読み取り専用）
-- GRANT USAGE ON SCHEMA auth TO app_user;
-- GRANT SELECT ON ALL TABLES IN SCHEMA auth TO app_user;

-- app物理データベース（全権限）
-- GRANT ALL ON SCHEMA app TO app_user;
-- GRANT ALL ON ALL TABLES IN SCHEMA app TO app_user;
```

---

## スキーマ移行（Migration）

### 新しいテーブル追加

```sql
-- 1_create_customers.up.sql（crm論理スキーマの例）

-- CREATE SCHEMA IF NOT EXISTS crm;

-- CREATE TABLE crm.customers (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   name TEXT NOT NULL,
--   email TEXT NOT NULL UNIQUE,
--   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--   updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--   created_by UUID NOT NULL REFERENCES auth.auth_users(id),
--   updated_by UUID NOT NULL REFERENCES auth.auth_users(id)
-- );

-- CREATE INDEX idx_customers_email ON crm.customers(email);
-- CREATE INDEX idx_customers_created_by ON crm.customers(created_by);

-- -- Trigger設定
-- CREATE TRIGGER update_customers_updated_at
--   BEFORE UPDATE ON crm.customers
--   FOR EACH ROW
--   EXECUTE FUNCTION crm.update_updated_at();
```

```sql
-- 1_create_customers.down.sql（crm論理スキーマの例）

-- DROP TRIGGER IF EXISTS update_customers_updated_at ON crm.customers;
-- DROP INDEX IF EXISTS idx_customers_created_by;
-- DROP INDEX IF EXISTS idx_customers_email;
-- DROP TABLE IF EXISTS crm.customers;
-- DROP SCHEMA IF EXISTS crm CASCADE;
```

---

## Troubleshooting

### 問題1: スキーマが見つからない

**原因**: スキーマが作成されていない

**対処**:
```sql
CREATE SCHEMA IF NOT EXISTS app;
```

---

### 問題2: FOREIGN KEY エラー

**原因**: 参照先のテーブルが存在しない、またはカラム型が一致しない

**確認**:
```sql
-- auth.auth_users(id) の型確認
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'auth' AND table_name = 'auth_users' AND column_name = 'id';

-- 結果: UUID であることを確認
```

---

### 問題3: Trigger が動作しない

**原因**: Trigger関数が定義されていない

**確認**:
```sql
-- Trigger関数の存在確認
SELECT proname FROM pg_proc WHERE proname = 'update_updated_at';
```

---

## Related Patterns

- **migration.md**: Migration作成・実行
- **extensions.md**: PostgreSQL拡張機能
- **search.md**: 検索インデックス設計
