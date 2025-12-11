# 段階的検索実装パターン

## Overview

dashboard-acceleratorテンプレートは、4段階の検索戦略を提供します:

1. **完全一致**: 最も高速（インデックスを使用）
2. **全文検索**: tsvector + GINインデックス
3. **類似検索**: pg_trgm + GINインデックス
4. **編集距離**: levenshtein（最後の手段）

---

## 段階的検索フロー

```typescript
export async function searchCustomers(query: string): Promise<Customer[]> {
  // Step 1: 完全一致
  let results = await exactMatch(query);
  if (results.length > 0) return results;

  // Step 2: 全文検索
  results = await fullTextSearch(query);
  if (results.length > 0) return results;

  // Step 3: 類似検索
  results = await similaritySearch(query);
  if (results.length > 0) return results;

  // Step 4: 編集距離
  results = await fuzzySearch(query);
  return results;
}
```

---

## Step 1: 完全一致

### 実装

```typescript
async function exactMatch(query: string): Promise<Customer[]> {
  const result = await db.query(`
    SELECT *
    FROM crm.customers
    WHERE name = $1
       OR email = $1
    LIMIT 10
  `, [query]);

  return result.rows;
}
```

### インデックス

```sql
-- B-Tree インデックス（デフォルト）
CREATE INDEX idx_customers_name ON crm.customers(name);
CREATE INDEX idx_customers_email ON crm.customers(email);
```

### パフォーマンス

- **O(log n)** - B-Treeインデックス使用
- **最速** - 10ms未満（100万件のデータ）

---

## Step 2: 全文検索

### 実装

```typescript
async function fullTextSearch(query: string): Promise<Customer[]> {
  const result = await db.query(`
    SELECT *,
      ts_rank(to_tsvector('japanese', name), plainto_tsquery('japanese', $1)) AS rank
    FROM crm.customers
    WHERE to_tsvector('japanese', name) @@ plainto_tsquery('japanese', $1)
    ORDER BY rank DESC
    LIMIT 10
  `, [query]);

  return result.rows;
}
```

### インデックス

```sql
-- GIN インデックス（全文検索用）
CREATE INDEX idx_customers_name_gin ON crm.customers
USING GIN (to_tsvector('japanese', name));
```

### 日本語対応

PostgreSQL の全文検索は日本語に対応していますが、辞書の設定が必要です:

```sql
-- 日本語辞書の確認
SELECT * FROM pg_ts_config WHERE cfgname = 'japanese';

-- 日本語トークナイザーのインストール（必要に応じて）
-- CREATE TEXT SEARCH CONFIGURATION japanese ( COPY = simple );
```

**代替案**: Kuromoji などの外部日本語形態素解析ツールと組み合わせる

---

## Step 3: 類似検索（pg_trgm）

### 実装

```typescript
async function similaritySearch(query: string): Promise<Customer[]> {
  const result = await db.query(`
    SELECT *,
      similarity(name, $1) AS sim
    FROM crm.customers
    WHERE name % $1  -- similarity > 0.3（デフォルト）
    ORDER BY sim DESC
    LIMIT 10
  `, [query]);

  return result.rows;
}
```

### インデックス

```sql
-- GIN インデックス（pg_trgm用）
CREATE INDEX idx_customers_name_trgm ON crm.customers
USING GIN (name gin_trgm_ops);
```

### 閾値調整

```sql
-- デフォルトの類似度閾値は 0.3
-- 厳しくする場合:
SET pg_trgm.similarity_threshold = 0.5;

-- 緩くする場合:
SET pg_trgm.similarity_threshold = 0.2;
```

### パフォーマンス

- **O(n)** - GINインデックス使用
- **中速** - 50ms程度（100万件のデータ）

---

## Step 4: 編集距離（levenshtein）

### 実装

```typescript
async function fuzzySearch(query: string): Promise<Customer[]> {
  const result = await db.query(`
    SELECT *,
      levenshtein(name, $1) AS distance
    FROM crm.customers
    WHERE name % $1  -- pg_trgm でフィルタリング（重要）
      AND levenshtein(name, $1) <= 3
    ORDER BY distance ASC
    LIMIT 10
  `, [query]);

  return result.rows;
}
```

### 重要ポイント

**pg_trgm でフィルタリング後に levenshtein を使用**:

```sql
-- ✅ 正しい（pg_trgm でインデックス使用 → levenshtein で絞り込み）
WHERE name % $1 AND levenshtein(name, $1) <= 3

-- ❌ 間違い（全テーブルスキャン）
WHERE levenshtein(name, $1) <= 3
```

### パフォーマンス

- **O(n)** - pg_trgmでフィルタリング後、levenshteinで絞り込み
- **低速** - 100ms程度（100万件のデータ）

---

## 複合検索（複数カラム）

### 実装

```typescript
async function multiColumnSearch(query: string): Promise<Customer[]> {
  const result = await db.query(`
    SELECT *,
      GREATEST(
        similarity(name, $1),
        similarity(email, $1),
        similarity(phone, $1)
      ) AS sim
    FROM crm.customers
    WHERE name % $1
       OR email % $1
       OR phone % $1
    ORDER BY sim DESC
    LIMIT 10
  `, [query]);

  return result.rows;
}
```

### インデックス

```sql
-- 各カラムにインデックス作成
CREATE INDEX idx_customers_name_trgm ON crm.customers USING GIN (name gin_trgm_ops);
CREATE INDEX idx_customers_email_trgm ON crm.customers USING GIN (email gin_trgm_ops);
CREATE INDEX idx_customers_phone_trgm ON crm.customers USING GIN (phone gin_trgm_ops);
```

---

## 前方一致検索

### LIKE 検索

```sql
-- 前方一致
SELECT * FROM crm.customers
WHERE name LIKE 'John%';

-- 部分一致（遅い）
SELECT * FROM crm.customers
WHERE name LIKE '%John%';
```

### インデックス

```sql
-- 前方一致専用インデックス（B-Tree + text_pattern_ops）
CREATE INDEX idx_customers_name_pattern ON crm.customers(name text_pattern_ops);
```

**注意**: `LIKE '%John%'`（中間一致）はインデックスを使用できません

---

## 重み付け検索

### 実装

```typescript
async function weightedSearch(query: string): Promise<Customer[]> {
  const result = await db.query(`
    SELECT *,
      (similarity(name, $1) * 2.0 +  -- name を重視
       similarity(email, $1) * 1.0 +
       similarity(phone, $1) * 0.5) AS score
    FROM crm.customers
    WHERE name % $1
       OR email % $1
       OR phone % $1
    ORDER BY score DESC
    LIMIT 10
  `, [query]);

  return result.rows;
}
```

---

## カタカナ・ひらがな対応

### 実装（アプリケーション側で変換）

```typescript
function normalizeJapanese(text: string): string {
  // カタカナ → ひらがな
  return text.replace(/[\u30a1-\u30f6]/g, (match) => {
    const chr = match.charCodeAt(0) - 0x60;
    return String.fromCharCode(chr);
  });
}

async function searchWithNormalization(query: string): Promise<Customer[]> {
  const normalized = normalizeJapanese(query);

  const result = await db.query(`
    SELECT * FROM crm.customers
    WHERE name % $1
       OR name % $2
    ORDER BY GREATEST(similarity(name, $1), similarity(name, $2)) DESC
    LIMIT 10
  `, [query, normalized]);

  return result.rows;
}
```

---

## ページネーション

### 実装

```typescript
async function searchWithPagination(
  query: string,
  page: number = 1,
  pageSize: number = 20
): Promise<{ customers: Customer[]; total: number }> {
  // 件数取得
  const countResult = await db.query(`
    SELECT COUNT(*) FROM crm.customers
    WHERE name % $1
  `, [query]);

  const total = parseInt(countResult.rows[0].count);

  // ページネーション
  const offset = (page - 1) * pageSize;
  const result = await db.query(`
    SELECT *, similarity(name, $1) AS sim
    FROM crm.customers
    WHERE name % $1
    ORDER BY sim DESC
    LIMIT $2 OFFSET $3
  `, [query, pageSize, offset]);

  return {
    customers: result.rows,
    total,
  };
}
```

---

## ハイライト表示

### 実装

```typescript
function highlightMatches(text: string, query: string): string {
  const regex = new RegExp(`(${query})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

async function searchWithHighlight(query: string): Promise<Customer[]> {
  const customers = await similaritySearch(query);

  return customers.map((customer) => ({
    ...customer,
    nameHighlighted: highlightMatches(customer.name, query),
  }));
}
```

---

## パフォーマンス最適化

### EXPLAIN ANALYZE

```sql
EXPLAIN ANALYZE
SELECT * FROM crm.customers
WHERE name % 'John'
ORDER BY similarity(name, 'John') DESC
LIMIT 10;
```

**確認ポイント**:
- インデックスが使われているか（`Bitmap Index Scan on idx_customers_name_trgm`）
- コストが妥当か（`cost=... rows=...`）

---

### Materialized View（大量データの場合）

```sql
-- Materialized View作成
CREATE MATERIALIZED VIEW crm.customers_search AS
SELECT
  id,
  name,
  email,
  to_tsvector('japanese', name) AS name_vector
FROM crm.customers;

-- インデックス作成
CREATE INDEX idx_customers_search_vector ON crm.customers_search
USING GIN (name_vector);

-- 検索
SELECT * FROM crm.customers_search
WHERE name_vector @@ plainto_tsquery('japanese', 'query');

-- 定期的に更新
REFRESH MATERIALIZED VIEW CONCURRENTLY crm.customers_search;
```

---

## トラブルシューティング

### 問題1: 検索が遅い

**原因**: インデックスが使われていない

**確認**:
```sql
EXPLAIN ANALYZE SELECT * FROM crm.customers WHERE name % 'John';
```

**対処**:
```sql
-- GIN インデックス作成
CREATE INDEX idx_customers_name_trgm ON crm.customers USING GIN (name gin_trgm_ops);
```

---

### 問題2: 日本語の全文検索が機能しない

**原因**: 日本語辞書が設定されていない

**対処**:
```sql
-- 日本語辞書の確認
SELECT * FROM pg_ts_config WHERE cfgname = 'japanese';

-- または、pg_bigm などの日本語対応エクステンション使用
CREATE EXTENSION pg_bigm;
CREATE INDEX idx_customers_name_bigm ON crm.customers USING GIN (name gin_bigm_ops);
```

---

### 問題3: 類似度が低すぎる

**原因**: 閾値が高すぎる

**対処**:
```sql
-- 閾値を下げる
SET pg_trgm.similarity_threshold = 0.2;
```

---

## Related Patterns

- **extensions.md**: pg_trgm、fuzzystrmatch の詳細
- **schema-design.md**: インデックス設計
- **migration.md**: インデックス追加のMigration
