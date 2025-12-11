# DB設計ルール

DBはbackendでencore.devを採用しており必ずPostgreSQLを使用する。
さらに、本システムやencore.devで定められたPostgreSQLのエクステンションを積極的に活用する。

ここではテーブル設計に関わる基本的なルールと共に、エクステンションの活用例を示す。

## DB関連必須設定

- 本プロジェクトの業務系データベースは Postgres の `app` に統合します。CRM/Workflow などの論理分離は `schema.table` で行い、`auth`/`dev_tools`/`notification`/`app` 以外の SQLDatabase は新設禁止。

### migrationの最初のファイルに以下のエクステンションを定義する

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
CREATE EXTENSION IF NOT EXISTS tcn;
```

### テーブル設計の基本ルール

- テーブル名は蛇形（snake_case）を使用する。
- テーブル名は複数形を使用する。
- テーブル名は英語を使用する。
- TIMEZONEは日本時間（Asia/Tokyo）を使用する
- 基本的に日本語環境を想定する
- created_atとupdated_atは必ず含める。
- created_byとupdated_byは必ず含める。

## 段階的高度検索導入ガイド：基本設計から高度検索まで

このガイドは、まず基本的なテーブル設計で業務開始し、後から高度検索機能を段階的に追加する実装手順を示します。

***

### フェーズ１：基本テーブル設計と通常開発

#### 1.1 外部マスターテーブル：カテゴリ

```sql
-- カテゴリマスターテーブル
CREATE TABLE IF NOT EXISTS invoice_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- サンプルデータ
INSERT INTO invoice_categories (code, name, description, display_order) VALUES
('PRODUCT', '商品売上', '商品の売上に関する請求', 1),
('SERVICE', 'サービス', 'サービス提供に関する請求', 2),
('CONSULTING', 'コンサルティング', 'コンサルティング業務の請求', 3),
('MAINTENANCE', '保守', 'システム保守・メンテナンス', 4);
```

#### 1.2 メインテーブル：請求書（基本設計）

```sql
-- 請求書ステータス（ENUM型で内部管理）
CREATE TYPE invoice_status AS ENUM (
  'draft',      -- 下書き
  'issued',     -- 発行済み
  'sent',       -- 送付済み
  'paid',       -- 支払済み
  'overdue',    -- 支払期限超過
  'cancelled'   -- キャンセル
);

-- 請求書テーブル（基本設計）
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  invoice_date DATE NOT NULL,
  due_date DATE,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  
  -- 外部テーブル参照
  category_id UUID NOT NULL REFERENCES invoice_categories(id),
  
  -- 内部ステータス（ENUM）
  status invoice_status NOT NULL DEFAULT 'draft',
  
  -- 備考・メモ
  notes TEXT,
  
  -- 共通カラム
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID
);
```

#### 1.3 基本インデックス

```sql
-- 基本的な検索・絞り込み用インデックス
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_category ON invoices(category_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_name);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);

-- 複合インデックス
CREATE INDEX IF NOT EXISTS idx_invoices_status_date ON invoices(status, invoice_date DESC);
```

### 1.4 基本トリガー

```sql
-- 更新日時自動設定
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoices_updated_at ON invoices;
CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

#### 1.5 基本検索クエリ例

```sql
-- ステータス絞り込み
SELECT * FROM invoices WHERE status = 'issued';

-- カテゴリ別検索
SELECT i.*, c.name as category_name
FROM invoices i
JOIN invoice_categories c ON i.category_id = c.id
WHERE c.code = 'PRODUCT';

-- 日付範囲検索
SELECT * FROM invoices 
WHERE invoice_date BETWEEN '2025-01-01' AND '2025-12-31';

-- 顧客名部分一致（基本LIKE検索）
SELECT * FROM invoices 
WHERE customer_name LIKE '%山田%';
```

***

### フェーズ２：高度検索用拡張とカラム追加

#### 2.1 PostgreSQL 拡張の有効化

```sql
-- 高度検索用拡張を有効化
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
```

### 2.2 検索用カラムの追加

```sql
-- 既存テーブルに検索用カラムを追加
ALTER TABLE invoices
  ADD COLUMN search_vector TSVECTOR,
  ADD COLUMN search_text TEXT;
```

#### 2.3 検索クエリ正規化関数

```sql
CREATE OR REPLACE FUNCTION normalize_invoice_search_query(query_text TEXT)
RETURNS TEXT AS $$
BEGIN
  IF query_text IS NULL THEN
    RETURN '';
  END IF;
  RETURN lower(regexp_replace(translate(query_text, '　　', '  '), '\s+', ' ', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

NFKC による全角半角統一と連続空白除去を先に行い、全文検索と trigram 類似度が同じ前処理を参照できるようにする。

#### 2.4 既存データのバックフィル

```sql
-- 既存データに検索用フィールドを設定
CREATE OR REPLACE FUNCTION backfill_invoice_search_fields()
RETURNS VOID AS $$
DECLARE
  rec RECORD;
  category_name TEXT;
BEGIN
  FOR rec IN SELECT * FROM invoices LOOP
    -- カテゴリ名を取得
    SELECT name INTO category_name 
    FROM invoice_categories 
    WHERE id = rec.category_id;
    
    -- search_vector を設定
    UPDATE invoices
    SET 
      search_vector = 
        setweight(to_tsvector('japanese', coalesce(rec.invoice_number, '')), 'A') ||
        setweight(to_tsvector('japanese', coalesce(rec.customer_name, '')), 'A') ||
        setweight(to_tsvector('japanese', coalesce(category_name, '')), 'B') ||
        setweight(to_tsvector('japanese', coalesce(rec.notes, '')), 'C'),
      
      search_text = normalize_invoice_search_query(
        concat_ws(' ',
          coalesce(rec.invoice_number, ''),
          coalesce(rec.customer_name, ''),
          coalesce(category_name, ''),
          coalesce(rec.notes, '')
        )
      )
    WHERE id = rec.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- バックフィルを実行
SELECT backfill_invoice_search_fields();
```

#### 2.5 検索フィールド自動更新トリガー

```sql
CREATE OR REPLACE FUNCTION update_invoices_search_fields()
RETURNS TRIGGER AS $$
DECLARE
  category_name TEXT := '';
BEGIN
  -- カテゴリ名を取得
  SELECT name INTO category_name 
  FROM invoice_categories 
  WHERE id = NEW.category_id;
  
  -- search_vector の更新
  NEW.search_vector :=
    setweight(to_tsvector('japanese', coalesce(NEW.invoice_number, '')), 'A') ||
    setweight(to_tsvector('japanese', coalesce(NEW.customer_name, '')), 'A') ||
    setweight(to_tsvector('japanese', coalesce(category_name, '')), 'B') ||
    setweight(to_tsvector('japanese', coalesce(NEW.notes, '')), 'C');
  
  -- search_text の更新
  NEW.search_text := normalize_invoice_search_query(
    concat_ws(' ',
      coalesce(NEW.invoice_number, ''),
      coalesce(NEW.customer_name, ''),
      coalesce(category_name, ''),
      coalesce(NEW.notes, '')
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガーを登録
DROP TRIGGER IF EXISTS trg_invoices_search_fields ON invoices;
CREATE TRIGGER trg_invoices_search_fields
  BEFORE INSERT OR UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_invoices_search_fields();
```

#### 2.6 外部テーブル更新時の同期

```sql
-- カテゴリマスター更新時の同期処理
CREATE OR REPLACE FUNCTION sync_category_to_invoices()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.name != NEW.name THEN
    -- カテゴリ名が変更された場合、関連する請求書の検索フィールドを更新
    UPDATE invoices 
    SET updated_at = updated_at -- 値を変えずにトリガーだけを発火させる
    WHERE category_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_category_to_invoices ON invoice_categories;
CREATE TRIGGER trg_sync_category_to_invoices
  AFTER UPDATE ON invoice_categories
  FOR EACH ROW EXECUTE FUNCTION sync_category_to_invoices();
```

***

### フェーズ３：検索用インデックス作成

#### 3.1 高度検索用インデックスの追加

```sql
-- 全文検索用GINインデックス
CREATE INDEX IF NOT EXISTS idx_invoices_search_vector
  ON invoices USING GIN (search_vector);

-- 部分一致・類似検索用インデックス
CREATE INDEX IF NOT EXISTS idx_invoices_search_text_trgm
  ON invoices USING GIN (search_text gin_trgm_ops);

-- 個別カラムの類似検索用（必要に応じて）
CREATE INDEX IF NOT EXISTS idx_invoices_customer_trgm
  ON invoices USING GIN (customer_name gin_trgm_ops);
```

#### 3.2 インデックス作成状況の確認

```sql
-- インデックス一覧確認
SELECT 
  schemaname, tablename, indexname, indexdef
FROM pg_indexes 
WHERE tablename = 'invoices'
ORDER BY indexname;

-- インデックスサイズ確認
SELECT 
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) as size
FROM pg_indexes 
WHERE tablename = 'invoices';
```

***

### フェーズ４：統合検索関数の実装

#### 4.1 軽量版検索関数

```sql
CREATE OR REPLACE FUNCTION smart_search_invoices_light(
  query_text TEXT DEFAULT '',
  status_filter invoice_status DEFAULT NULL,
  category_code TEXT DEFAULT NULL,
  max_results INT DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  invoice_number TEXT,
  customer_name TEXT,
  total_amount NUMERIC,
  status invoice_status,
  category_name TEXT,
  invoice_date DATE,
  match_type TEXT,
  relevance_score FLOAT
) AS $$
DECLARE
  normalized_query TEXT := normalize_invoice_search_query(query_text);
  category_id_filter UUID;
  exact_count INT;
BEGIN
  -- カテゴリコードからIDを解決
  IF category_code IS NOT NULL THEN
    SELECT c.id INTO category_id_filter 
    FROM invoice_categories c 
    WHERE c.code = category_code AND c.is_active = true;
  END IF;

  -- フィルターのみ（検索文字列なし）
  IF normalized_query = '' THEN
    RETURN QUERY
    SELECT 
      i.id, i.invoice_number, i.customer_name, i.total_amount, 
      i.status, c.name, i.invoice_date,
      'filter_only', 1.0
    FROM invoices i
    JOIN invoice_categories c ON i.category_id = c.id
    WHERE (status_filter IS NULL OR i.status = status_filter)
      AND (category_id_filter IS NULL OR i.category_id = category_id_filter)
    ORDER BY i.invoice_date DESC
    LIMIT max_results;
    RETURN;
  END IF;

  -- 請求書番号完全一致
  SELECT COUNT(*) INTO exact_count
  FROM invoices i
  WHERE normalize_invoice_search_query(i.invoice_number) = normalized_query
    AND (status_filter IS NULL OR i.status = status_filter)
    AND (category_id_filter IS NULL OR i.category_id = category_id_filter);
  
  IF exact_count > 0 THEN
    RETURN QUERY
    SELECT 
      i.id, i.invoice_number, i.customer_name, i.total_amount,
      i.status, c.name, i.invoice_date,
      'exact_number', 1.0
    FROM invoices i
    JOIN invoice_categories c ON i.category_id = c.id
    WHERE normalize_invoice_search_query(i.invoice_number) = normalized_query
      AND (status_filter IS NULL OR i.status = status_filter)
      AND (category_id_filter IS NULL OR i.category_id = category_id_filter)
    LIMIT max_results;
    RETURN;
  END IF;

  -- 顧客名完全一致
  SELECT COUNT(*) INTO exact_count
  FROM invoices i
  WHERE normalize_invoice_search_query(i.customer_name) = normalized_query
    AND (status_filter IS NULL OR i.status = status_filter)
    AND (category_id_filter IS NULL OR i.category_id = category_id_filter);
  
  IF exact_count > 0 THEN
    RETURN QUERY
    SELECT 
      i.id, i.invoice_number, i.customer_name, i.total_amount,
      i.status, c.name, i.invoice_date,
      'exact_customer', 1.0
    FROM invoices i
    JOIN invoice_categories c ON i.category_id = c.id
    WHERE normalize_invoice_search_query(i.customer_name) = normalized_query
      AND (status_filter IS NULL OR i.status = status_filter)
      AND (category_id_filter IS NULL OR i.category_id = category_id_filter)
    LIMIT max_results;
    RETURN;
  END IF;

  -- 全文検索
  RETURN QUERY
  SELECT 
    i.id, i.invoice_number, i.customer_name, i.total_amount,
    i.status, c.name, i.invoice_date,
    'fulltext',
    ts_rank_cd(i.search_vector, websearch_to_tsquery('japanese', normalized_query))
  FROM invoices i
  JOIN invoice_categories c ON i.category_id = c.id
  WHERE i.search_vector @@ websearch_to_tsquery('japanese', normalized_query)
    AND (status_filter IS NULL OR i.status = status_filter)
    AND (category_id_filter IS NULL OR i.category_id = category_id_filter)
  ORDER BY ts_rank_cd(i.search_vector, websearch_to_tsquery('japanese', normalized_query)) DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;
```

#### 4.2 重量版検索関数

```sql
CREATE OR REPLACE FUNCTION smart_search_invoices_heavy(
  query_text TEXT DEFAULT '',
  status_filter invoice_status DEFAULT NULL,
  category_code TEXT DEFAULT NULL,
  max_results INT DEFAULT 50,
  similarity_threshold FLOAT DEFAULT 0.25
)
RETURNS TABLE (
  id UUID,
  invoice_number TEXT,
  customer_name TEXT,
  total_amount NUMERIC,
  status invoice_status,
  category_name TEXT,
  invoice_date DATE,
  match_type TEXT,
  relevance_score FLOAT
) AS $$
DECLARE
  normalized_query TEXT := normalize_invoice_search_query(query_text);
  category_id_filter UUID;
  exact_count INT;
BEGIN
  -- カテゴリ解決
  IF category_code IS NOT NULL THEN
    SELECT c.id INTO category_id_filter 
    FROM invoice_categories c 
    WHERE c.code = category_code AND c.is_active = true;
  END IF;

  -- 軽量版と同じ前処理（省略可能 - 軽量版を先に呼んで結果がない場合のみ重量版を実行）

  -- 多段階検索
  RETURN QUERY
  WITH
    -- 全文検索フェーズ
    fulltext_results AS (
      SELECT 
        i.id, i.invoice_number, i.customer_name, i.total_amount,
        i.status, c.name as category_name, i.invoice_date,
        ts_rank_cd(i.search_vector, websearch_to_tsquery('japanese', normalized_query)) as score
      FROM invoices i
      JOIN invoice_categories c ON i.category_id = c.id
      WHERE i.search_vector @@ websearch_to_tsquery('japanese', normalized_query)
        AND (status_filter IS NULL OR i.status = status_filter)
        AND (category_id_filter IS NULL OR i.category_id = category_id_filter)
    ),
    
    -- 類似検索フェーズ
    fuzzy_results AS (
      SELECT 
        i.id, i.invoice_number, i.customer_name, i.total_amount,
        i.status, c.name as category_name, i.invoice_date,
        GREATEST(
          similarity(normalize_invoice_search_query(i.customer_name), normalized_query),
          similarity(i.search_text, normalized_query)
        ) as score
      FROM invoices i
      JOIN invoice_categories c ON i.category_id = c.id
      WHERE (normalize_invoice_search_query(i.customer_name) % normalized_query OR i.search_text % normalized_query)
        AND similarity(i.search_text, normalized_query) >= similarity_threshold
        AND (status_filter IS NULL OR i.status = status_filter)
        AND (category_id_filter IS NULL OR i.category_id = category_id_filter)
    ),
    
    -- 編集距離フェーズ
    levenshtein_results AS (
      SELECT 
        i.id, i.invoice_number, i.customer_name, i.total_amount,
        i.status, c.name as category_name, i.invoice_date,
        (1.0 - levenshtein(
           normalize_invoice_search_query(i.customer_name),
           normalized_query
         )::float / GREATEST(
           LENGTH(normalize_invoice_search_query(i.customer_name)),
           LENGTH(normalized_query)
         )) as score
      FROM invoices i
      JOIN invoice_categories c ON i.category_id = c.id
      WHERE levenshtein_less_equal(
            normalize_invoice_search_query(i.customer_name),
            normalized_query,
            3
          )
        AND LENGTH(normalized_query) >= 3
        AND (status_filter IS NULL OR i.status = status_filter)
        AND (category_id_filter IS NULL OR i.category_id = category_id_filter)
    )
  
  -- 結果統合
  SELECT 
    COALESCE(ft.id, fg.id, lv.id) as id,
    COALESCE(ft.invoice_number, fg.invoice_number, lv.invoice_number) as invoice_number,
    COALESCE(ft.customer_name, fg.customer_name, lv.customer_name) as customer_name,
    COALESCE(ft.total_amount, fg.total_amount, lv.total_amount) as total_amount,
    COALESCE(ft.status, fg.status, lv.status) as status,
    COALESCE(ft.category_name, fg.category_name, lv.category_name) as category_name,
    COALESCE(ft.invoice_date, fg.invoice_date, lv.invoice_date) as invoice_date,
    CASE 
      WHEN ft.id IS NOT NULL THEN 'fulltext'
      WHEN fg.id IS NOT NULL THEN 'fuzzy'
      ELSE 'levenshtein'
    END as match_type,
    (COALESCE(ft.score,0) * 0.6 +
     COALESCE(fg.score,0) * 0.3 +
     COALESCE(lv.score,0) * 0.1) as relevance_score
  FROM fulltext_results ft
  FULL JOIN fuzzy_results fg ON ft.id = fg.id
  FULL JOIN levenshtein_results lv ON COALESCE(ft.id, fg.id) = lv.id
  WHERE (COALESCE(ft.score,0) * 0.6 +
         COALESCE(fg.score,0) * 0.3 +
         COALESCE(lv.score,0) * 0.1) > 0.05
  ORDER BY relevance_score DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;
```

***

### フェーズ５：パフォーマンス監視と最適化

#### 5.1 検索パフォーマンス測定

```sql
-- 軽量版のパフォーマンス測定
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) 
SELECT * FROM smart_search_invoices_light('山田商事', 'issued');

-- 重量版のパフォーマンス測定
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) 
SELECT * FROM smart_search_invoices_heavy('やまだ商亊', 'issued');

-- インデックス使用状況確認
SELECT 
  schemaname, tablename, indexname, 
  idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE tablename = 'invoices'
ORDER BY idx_scan DESC;
```

#### 5.2 パフォーマンス最適化設定

```sql
-- pg_trgm設定調整
ALTER DATABASE your_database SET pg_trgm.similarity_threshold = 0.4;

-- 統計情報の更新
ANALYZE invoices;

-- 必要に応じてインデックス再構築
REINDEX INDEX idx_invoices_search_vector;
REINDEX INDEX idx_invoices_search_text_trgm;
```

#### 5.3 使用例とテスト

```sql
-- 基本検索テスト
SELECT * FROM smart_search_invoices_light('INV-2025-001');

-- ステータス絞り込み
SELECT * FROM smart_search_invoices_light('', 'issued');

-- カテゴリ絞り込み
SELECT * FROM smart_search_invoices_light('', NULL, 'PRODUCT');

-- 複合検索
SELECT * FROM smart_search_invoices_light('山田', 'paid', 'SERVICE');

-- あいまい検索
SELECT * FROM smart_search_invoices_heavy('やまだ商亊');

-- 複数キーワード検索
SELECT * FROM smart_search_invoices_light('山田 コンサルティング');
```

***

### 運用指針

#### フェーズ移行のタイミング
1. **フェーズ１→２**：基本機能が安定稼働後、検索機能の要望が増えた段階
2. **フェーズ２→３**：バックフィルが完了し、新規データでトリガーが正常動作確認後
3. **フェーズ３→４**：インデックスが作成され、基本的な全文検索が動作確認後
4. **フェーズ４→５**：検索関数が実装され、本格運用開始後

#### 監視ポイント
- バックフィル実行時間とテーブルロック時間
- インデックス作成時のI/O負荷
- 検索関数のレスポンス時間
- インデックスサイズの増加量



## エクステンションの活用 - その他

以下は指示があった場合に活用する。

### tcn — Trigger Change Notification 概要

テーブルのINSERT/UPDATE/DELETEをキャプチャし、NOTIFY/LISTENで変更内容を非同期通知できる。リアルタイム更新反映やキャッシュ同期に有用

#### 1.1 概要
tcn モジュールは、テーブルごとに設定したAFTER ROWトリガーから、変更（INSERT:I、UPDATE:U、DELETE:D）の都度、指定チャネルで NOTIFY イベントを送出する機能を提供します。複数クライアントが LISTEN していればリアルタイムで通知を受信可能です【41】。

#### 1.2 主な特徴

- 非同期通知：テーブル変更を即座にクライアントへ通知。
- ペイロード："テーブル名",操作種別,キー列名と値 のCSV形式（ダブルクオート／シングルクオート付き）。
- チャネル指定可：CREATE TRIGGER ... execute function triggered_change_notification('チャネル名') で任意チャネル。省略時は tcn。
- 権限：trusted 拡張のため、非スーパーでも CREATE 権限があればインストール可能。
- ユースケース：
  - キャッシュ更新トリガー
  - リアルタイム通知ダッシュボード
  - マイクロサービス間のイベント駆動連携

#### 1.3 基本利用例

```sql
CREATE EXTENSION tcn;
CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT);
CREATE TRIGGER user_change
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW
  EXECUTE FUNCTION triggered_change_notification('user_updates');
```

```sql
-- アプリ側
LISTEN user_updates;
-- 通知受信後、payload解析→処理
```
