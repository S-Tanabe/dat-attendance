# PostgreSQL 拡張機能パターン

## 必須エクステンション

dashboard-acceleratorテンプレートは、以下の3つのPostgreSQL拡張機能を使用します:

1. **pg_trgm**: 類似検索（Trigram）
2. **fuzzystrmatch**: 編集距離（Levenshtein）
3. **tcn**: 変更通知（Trigger Change Notification）

---

## 1. pg_trgm（類似検索）

### インストール

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### 概要

**pg_trgm**（Trigram）は、文字列の類似度を計算し、あいまい検索を実現する拡張機能です。

**仕組み**:
- 文字列を3文字ずつの組み合わせ（Trigram）に分解
- 2つの文字列の Trigram の一致度で類似度を計算

**例**:
```
"apple" → ["  a", " ap", "app", "ppl", "ple", "le "]
"apply" → ["  a", " ap", "app", "ppl", "ply", "ly "]

similarity("apple", "apply") = 0.5 (50%)
```

---

### 使用例

#### 類似度計算

```sql
-- 類似度を計算
SELECT similarity('apple', 'apply');
-- 結果: 0.5

SELECT similarity('PostgreSQL', 'Postgre');
-- 結果: 0.72727275
```

#### 類似検索

```sql
-- 類似度 > 0.3 のレコードを検索（crm論理スキーマの例）
-- SELECT *
-- FROM crm.customers
-- WHERE name % 'John'; -- % 演算子 = similarity > 0.3

-- 類似度でソート
-- SELECT name, similarity(name, 'John') AS sim
-- FROM crm.customers
-- WHERE name % 'John'
-- ORDER BY sim DESC
-- LIMIT 10;
```

#### 閾値のカスタマイズ

```sql
-- デフォルトの類似度閾値は 0.3
-- カスタマイズする場合:
SET pg_trgm.similarity_threshold = 0.5;

-- これ以降、% 演算子は similarity > 0.5 で判定
```

---

### インデックス作成

```sql
-- GIN インデックス（推奨） - crm論理スキーマの例
-- CREATE INDEX idx_customers_name_trgm ON crm.customers
-- USING GIN (name gin_trgm_ops);

-- GiST インデックス（代替）
-- CREATE INDEX idx_customers_name_trgm ON crm.customers
-- USING GIST (name gist_trgm_ops);
```

**GIN vs GiST**:
- **GIN**: 高速検索、大きなインデックスサイズ
- **GiST**: 低速検索、小さなインデックスサイズ

**推奨**: GIN（検索速度優先）

---

### パフォーマンス最適化

```sql
-- EXPLAIN ANALYZE で確認（crm論理スキーマの例）
-- EXPLAIN ANALYZE
-- SELECT * FROM crm.customers
-- WHERE name % 'John'
-- ORDER BY similarity(name, 'John') DESC
-- LIMIT 10;

-- インデックスが使われていることを確認
-- → Bitmap Index Scan on idx_customers_name_trgm
```

---

## 2. fuzzystrmatch（編集距離）

### インストール

```sql
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
```

### 概要

**fuzzystrmatch** は、文字列間の編集距離（Levenshtein距離）を計算する拡張機能です。

**編集距離**: 文字列Aを文字列Bに変換するために必要な最小編集回数
- 挿入
- 削除
- 置換

**例**:
```
levenshtein('apple', 'apply') = 1 (e → y への置換)
levenshtein('kitten', 'sitting') = 3
```

---

### 使用例

#### 編集距離計算

```sql
-- 編集距離を計算
SELECT levenshtein('apple', 'apply');
-- 結果: 1

SELECT levenshtein('PostgreSQL', 'MySQL');
-- 結果: 9
```

#### 編集距離で検索

```sql
-- 編集距離 <= 2 のレコードを検索（crm論理スキーマの例）
-- SELECT name, levenshtein(name, 'John') AS distance
-- FROM crm.customers
-- WHERE levenshtein(name, 'John') <= 2
-- ORDER BY distance ASC
-- LIMIT 10;
```

---

### Soundex（音声類似度）

```sql
-- Soundex（英語の発音が似ている文字列を検索）
SELECT soundex('Smith');
-- 結果: S530

SELECT soundex('Smyth');
-- 結果: S530

-- 発音が似ている名前を検索（crm論理スキーマの例）
-- SELECT *
-- FROM crm.customers
-- WHERE soundex(name) = soundex('Smith');
```

**注意**: Soundex は英語専用（日本語では使用不可）

---

### Metaphone（音声類似度・改良版）

```sql
-- Metaphone（Soundex より精度が高い）
SELECT metaphone('Smith', 10);
-- 結果: SM0

SELECT metaphone('Smyth', 10);
-- 結果: SM0

-- 発音が似ている名前を検索（crm論理スキーマの例）
-- SELECT *
-- FROM crm.customers
-- WHERE metaphone(name, 10) = metaphone('Smith', 10);
```

---

### パフォーマンス注意

**問題**: `levenshtein()` はインデックスが使えない

```sql
-- ❌ 遅い（全テーブルスキャン） - crm論理スキーマの例
-- SELECT * FROM crm.customers
-- WHERE levenshtein(name, 'John') <= 2;
```

**対処法**: `pg_trgm` でフィルタリング後、`levenshtein()` で絞り込み

```sql
-- ✅ 速い（pg_trgm でインデックス使用 → levenshtein で絞り込み）
-- SELECT name, levenshtein(name, 'John') AS distance
-- FROM crm.customers
-- WHERE name % 'John' -- pg_trgm でフィルタリング
--   AND levenshtein(name, 'John') <= 2
-- ORDER BY distance ASC
-- LIMIT 10;
```

---

## 3. tcn（変更通知）

### インストール

```sql
CREATE EXTENSION IF NOT EXISTS tcn;
```

### 概要

**tcn**（Trigger Change Notification）は、テーブルの変更（INSERT/UPDATE/DELETE）を LISTEN/NOTIFY で通知する拡張機能です。

---

### 使用例

#### Trigger設定

```sql
-- Trigger作成（crm論理スキーマの例）
-- CREATE TRIGGER customers_tcn_trigger
--   AFTER INSERT OR UPDATE OR DELETE ON crm.customers
--   FOR EACH ROW
--   EXECUTE FUNCTION tcn();
```

#### Backend（Encore.dev）で LISTEN

```typescript
// backend/services/app/realtime.ts

import { SQLDatabase } from "encore.dev/storage/sqldb";

const db = new SQLDatabase("app");

export async function listenForChanges(): Promise<void> {
  await db.exec("LISTEN customers_tcn");

  db.on("notification", (msg) => {
    console.log("Notification:", msg);
    // { channel: 'customers_tcn', payload: '{"op":"INSERT","schema":"app","table":"customers","data":{"id":"..."}}' }

    const notification = JSON.parse(msg.payload);
    if (notification.op === "INSERT") {
      console.log("New customer created:", notification.data.id);
    }
  });
}
```

---

### SSE（Server-Sent Events）連携

**注**: SSE連携の詳細は `foundation-notification` スキルの `references/sse-backend.md` を参照してください。

---

## 複合使用パターン

### 段階的検索（pg_trgm + fuzzystrmatch）

```sql
-- crm論理スキーマの例
-- -- Step 1: 完全一致
-- SELECT * FROM crm.customers WHERE name = 'John Smith';
--
-- -- Step 2: 類似検索（pg_trgm）
-- SELECT * FROM crm.customers WHERE name % 'John Smith'
-- ORDER BY similarity(name, 'John Smith') DESC LIMIT 10;
--
-- -- Step 3: 編集距離（fuzzystrmatch）
-- SELECT * FROM crm.customers
-- WHERE name % 'John Smith'
--   AND levenshtein(name, 'John Smith') <= 3
-- ORDER BY levenshtein(name, 'John Smith') ASC
-- LIMIT 10;
```

---

## トラブルシューティング

### 問題1: エクステンションがインストールされていない

**確認**:
```sql
SELECT * FROM pg_extension WHERE extname IN ('pg_trgm', 'fuzzystrmatch', 'tcn');
```

**対処**:
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
CREATE EXTENSION IF NOT EXISTS tcn;
```

---

### 問題2: pg_trgm インデックスが使われない

**原因**: 類似度閾値が低すぎる

**確認**:
```sql
SHOW pg_trgm.similarity_threshold;
-- デフォルト: 0.3
```

**対処**:
```sql
-- 閾値を上げる
SET pg_trgm.similarity_threshold = 0.5;
```

---

### 問題3: levenshtein() が遅い

**原因**: インデックスが使えない（全テーブルスキャン）

**対処**: pg_trgm でフィルタリング後、levenshtein() で絞り込み

```sql
-- ✅ pg_trgm でインデックス使用 → levenshtein で絞り込み（crm論理スキーマの例）
-- SELECT * FROM crm.customers
-- WHERE name % 'John' -- pg_trgm
--   AND levenshtein(name, 'John') <= 2
-- ORDER BY levenshtein(name, 'John') ASC;
```

---

## Related Patterns

- **schema-design.md**: スキーマ設計
- **search.md**: 段階的検索実装
- **migration.md**: エクステンションのMigration
