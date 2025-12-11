# Backend開発ルール - dashboard-accelerator

**最終更新**: 2025-11-13

---

## このドキュメントについて

このドキュメントは **Backend開発者向けの開発ルールとワークフロー** をまとめたものです。

### 📖 ドキュメント体系

- **[CLAUDE.md](../CLAUDE.md)**: プロジェクト全体の開発ルール、禁止事項、技術スタック
- **[ACCELERATOR.md](../ACCELERATOR.md)**: テンプレートが提供する機能の説明、アーキテクチャ、設計原則
- **backend/CLAUDE.md（本ドキュメント）**: Backend開発ルール（機能説明は含めない）
- **[frontend/CLAUDE.md](../frontend/CLAUDE.md)**: Frontend開発ルール

### 🎯 本ドキュメントの役割

**Backend固有の開発ルールとワークフローのみを記載します。**

- ✅ Backend技術スタック
- ✅ Backend固有の開発ルール
- ✅ Backend開発ワークフロー
- ✅ Backend関連スキル参照リスト
- ❌ 機能の説明（→ ACCELERATOR.md を参照）
- ❌ プロジェクト全体の禁止事項（→ CLAUDE.md を参照）

---

## 🎯 Backend技術スタック

### コアテクノロジー

| 技術 | バージョン | 用途 |
|------|-----------|------|
| **Encore.dev** | v1.51.4 | TypeScript Backend Framework（マイクロサービス構成） |
| **PostgreSQL** | 14+ | リレーショナルデータベース |
| **Node.js** | LTS | JavaScript実行環境 |
| **TypeScript** | 5.x | 型安全な開発 |
| **Sentry** | v8.55.0 | エラー監視・ログ収集 |

### Encore.dev アーキテクチャ

Encoreは **サービス指向アーキテクチャ** を採用しており、以下の4つの独立したサービスで構成されています：

```
backend/
├── services/
│   ├── auth/              # 認証サービス（auth物理DB）
│   ├── app/               # 業務サービス（app物理DB）
│   ├── notification/      # 通知サービス（notification物理DB）
│   └── dev_tools/         # 開発ツール（dev_tools物理DB）
└── shared/               # 共有モジュール（errors, monitoring）
```

**重要**: Encoreの仕様上、各サービスのデータベースは **物理的に分離** されており、サービス間での直接的なテーブル参照はできません。必ず **APIを通じて連携** してください。

---

## 📐 Backend固有の開発ルール

### データベース運用の原則

#### 1. Encore物理データベース分離

Encore.devは各サービスに **物理的に独立したデータベース** を提供します：

- **auth**: 認証サービス専用（auth_users等）
- **app**: 業務サービス専用（app_users、ビジネスロジック等）
- **notification**: 通知サービス専用
- **dev_tools**: 開発ツール専用

**定義方法:**
```typescript
// backend/services/app/database.ts
import { SQLDatabase } from "encore.dev/storage/sqldb";

export const db = new SQLDatabase("app"); // 物理データベース名を指定
```

**重要な制約:**
- ❌ **`auth` / `app` / `notification` / `dev_tools` 以外の新しいSQLDatabaseを追加してはいけない**
- ❌ **サービス間でのデータベース直接参照は禁止**（必ずAPIを通じて連携）

#### 2. プロジェクト推奨パターン（PostgreSQL論理スキーマ分割）

業務系サービスは全て **`app` 物理データベース** を使用し、**PostgreSQLの論理スキーマ** で機能別に分割することを推奨します。

**マイグレーションでの論理スキーマ作成:**
```sql
-- Migration: backend/services/app/migrations/0001_create_crm_schema.up.sql
CREATE SCHEMA crm;
CREATE TABLE crm.customer (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL
);

-- 別の論理スキーマを作成
CREATE SCHEMA workflow;
CREATE TABLE workflow.instruction_template (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL
);
```

**テーブル参照時の記法:**
```typescript
// schema.table 形式で明示的に指定
const result = await db.query`
  SELECT * FROM crm.customer WHERE id = ${customerId}
`;
```

**テンプレートの現状:**
- テンプレート自体には論理スキーマ分割は未実装
- 実案件で必要に応じて論理スキーマを追加する

#### 3. Migration管理ルール

**Migration作成:**
```bash
# backend/ ディレクトリで実行
encore db migrate create <migration_name>

# 例: CRMスキーマ追加
encore db migrate create create_crm_schema
```

**Migration適用:**
```bash
# ローカル環境への適用
encore db migrate

# 環境別適用（開発環境、本番環境等）
encore db migrate --env production
```

**Migration作成時の注意:**
- ✅ 必ず `up.sql` と `down.sql` の両方を作成
- ✅ `down.sql` では `up.sql` で行った変更を完全に戻す
- ✅ マイグレーションは小さく、単一の責任に限定
- ✅ 既存データへの影響を必ず考慮
- ❌ マイグレーション適用後の手動編集は禁止

#### 4. ユーザー管理の構造

**2種類のユーザーテーブル:**

| テーブル | 管理サービス | 物理DB | 用途 |
|---------|------------|--------|------|
| **auth_users** | authサービス | auth | 認証専用（email, password_hash等） |
| **app_users** | appサービス | app | アプリケーション用（profile, settings等） |

**関係性:**
- auth_usersと同じIDでapp_usersが自動作成される
- app_usersは実案件で拡張可能なベーステーブル
- 基本的なプロフィール編集機能を提供

**サービス間連携:**
```typescript
// ❌ 禁止: 直接データベース参照
const user = await db.query`SELECT * FROM auth.auth_users WHERE id = ${userId}`;

// ✅ 正しい: APIを通じて取得
const user = await authService.getUserById({ user_id: userId });
```

---

## 🔄 Backend開発ワークフロー

### API実装後の必須手順

Backend APIを実装した後は、以下の手順を **必ず実行** してください：

```
Step 1: API エンドポイントを実装
   ↓
Step 2: npm run gen:client - TypeScript SDK を生成
   ↓
Step 3: tsc - コンパイルチェック
   ↓
Step 4: Encore MCP で動作確認
```

**詳細:**

#### 1. API エンドポイント実装
```typescript
// backend/services/app/api.ts
import { api } from "encore.dev/api";

export const getUser = api(
  { method: "GET", path: "/users/:id", expose: true },
  async ({ id }: { id: string }) => {
    // 実装
  }
);
```

#### 2. TypeScript SDKの生成
```bash
# プロジェクトルートで実行
npm run gen:client
```

これにより、`frontend/src/lib/api/generated.ts` が自動生成され、Frontendで型安全なAPI呼び出しが可能になります。

#### 3. コンパイルチェック
```bash
# backend/ ディレクトリで実行
tsc
```

型エラーがないことを確認します。

#### 4. Encore MCPで動作確認
```typescript
// Encore MCPを使用してエンドポイントをテスト
// - 認証フローのテスト
// - エンドポイントの統合テスト
// - レスポンスの検証
```

### 日常的な開発フロー

```
1. コード修正
   ↓
2. tsc - 型チェック
   ↓
3. npm run gen:client - クライアント再生成（API変更時のみ）
   ↓
4. Encore MCP で動作確認
   ↓
5. コミット（pre-commit hooks が自動実行）
```

### サーバー起動について

- **Backend (Encore)** と **Frontend (SvelteKit)** は既に **ホットリロードで起動済み**
- 再起動の必要はない
- どうしても再起動が必要な場合はユーザーに依頼

---

## 💡 Backend実装パターン

### API実装の基本パターン

```typescript
// backend/services/app/api.ts
import { api } from "encore.dev/api";
import { getAuthData } from "encore.dev/auth";
import { db } from "./database";

// 認証必須エンドポイント
export const getResource = api(
  { expose: true, auth: true, method: "GET", path: "/resource/:id" },
  async ({ id }: { id: string }) => {
    const auth = getAuthData()!;
    // auth.userID で認証済みユーザーIDを取得

    const resource = await db.queryRow`
      SELECT * FROM app.resources WHERE id = ${id}
    `;

    return resource;
  }
);
```

**詳細**: [ACCELERATOR.md](../ACCELERATOR.md) の「認証・認可システム」セクションを参照

### データベース操作パターン

```typescript
// Migration: backend/services/app/migrations/XXXX_create_table.up.sql
CREATE TABLE app.my_table (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    -- 検索用カラム（推奨）
    search_vector tsvector,
    search_text TEXT,
    -- 監査カラム（必須）
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

-- 検索用インデックス
CREATE INDEX idx_my_table_search_vector ON app.my_table USING GIN(search_vector);
CREATE INDEX idx_my_table_search_text ON app.my_table USING GIST(search_text gist_trgm_ops);
```

**詳細**: [ACCELERATOR.md](../ACCELERATOR.md) の「データベース設計」セクションを参照

### エラー処理パターン

```typescript
import { createNotFoundError, createValidationError } from "~/shared/errors/helpers";

// バリデーションエラー
if (!params.name || params.name.length < 3) {
  throw createValidationError(
    "invalid_name",
    "名前は3文字以上である必要があります",
    { field: "name" }
  );
}

// NotFoundエラー
if (!resource) {
  throw createNotFoundError("resource_not_found", "リソースが見つかりません");
}
```

**詳細**: [ACCELERATOR.md](../ACCELERATOR.md) の「エラーハンドリング」セクションを参照

### 通知生成パターン

```typescript
import { notification } from "~encore/clients";

// 他のサービスを呼び出して通知生成
await notification.createNotification({
  userId: auth.userID,
  type: "resource_created",
  title: "リソースを作成しました",
  message: `リソース名: ${resource.name}`,
  data: { resourceId: resource.id }
});
```

**詳細**: [ACCELERATOR.md](../ACCELERATOR.md) の「通知システム」セクションを参照

---

## 📖 参照ドキュメント

- **[CLAUDE.md](../CLAUDE.md)**: プロジェクト全体の開発ルール、CRITICAL RULES、技術スタック
- **[ACCELERATOR.md](../ACCELERATOR.md)**: テンプレートが提供する全機能の説明（認証、通知、エラーハンドリング等）、実装パターン

---

## 🎯 Backend開発チェックリスト

実装開始前に以下を確認してください：

```checklist
□ CLAUDE.md の CRITICAL RULES を確認した
□ ACCELERATOR.md で既存機能を確認した
□ ACCELERATOR.md で実装パターンを確認した
□ 既存の実装パターンを理解した
□ データベース運用原則を理解した（物理DB分離、論理スキーマ分割）
□ API実装後のワークフロー（gen:client → tsc → MCP確認）を理解した
□ Encore.dev のサービス間連携ルール（API経由）を理解した
```

---

## まとめ

**Backend開発の核心原則:**

1. **物理DBは分離、論理スキーマで分割**
   - auth / app / notification / dev_tools の4つの物理DB
   - 業務系は app 物理DB内で論理スキーマ分割推奨

2. **サービス間連携は必ずAPI経由**
   - 直接データベース参照は禁止

3. **API実装後のワークフロー厳守**
   - 実装 → gen:client → tsc → Encore MCP確認

4. **既存機能の最大限活用**
   - ACCELERATOR.md で確認 → 既存実装参照 → 再利用

5. **Migration管理の徹底**
   - up.sql と down.sql の両方作成
   - 小さく単一責任のマイグレーション

**疑問や不明点がある場合:**
- [CLAUDE.md](../CLAUDE.md) の CRITICAL RULES を確認
- [ACCELERATOR.md](../ACCELERATOR.md) で機能説明と実装パターンを確認
- Context7 MCP でライブラリのベストプラクティスを調査
- Serena MCP でコードベースの既存実装を検索
- Encore MCP でエンドポイントの動作確認

---

**最終更新**: 2025-11-13
