# Dashboard Accelerator - Design Principles

## 概要

dashboard-accelerator は **AI駆動開発に最適化された設計原則** を採用しています。
このドキュメントでは、テンプレートの設計思想と拡張ルールを説明します。

---

## Core Design Principles

### 1. AI-First Architecture

**定義**: AIアシスタント（Claude Code）が理解しやすいコード構造

**実装例**:

```typescript
// ✅ Good: 明確な型定義とドキュメント
/**
 * ユーザー情報を取得する
 * @param userId - ユーザーID
 * @returns ユーザー情報（roles含む）
 * @throws APIError.notFound - ユーザーが見つからない場合
 */
export const getUser = api(
  { expose: true, auth: true, method: "GET", path: "/users/:userId" },
  async (params: GetUserParams): Promise<GetUserResponse> => {
    const user = await db.queryRow`
      SELECT id, name, email, roles FROM auth.users WHERE id = ${params.userId}
    `;
    if (!user) {
      throw APIError.notFound("user_not_found", "ユーザーが見つかりません");
    }
    return user;
  }
);

// ❌ Bad: 型定義なし、ドキュメントなし
export const getUser = api({}, async (params) => {
  const user = await db.queryRow`SELECT * FROM users WHERE id = ${params.id}`;
  if (!user) throw new Error("not found");
  return user;
});
```

**原則**:
- 全ての関数に JSDoc コメント
- 明確な型定義（interface/type）
- エラーハンドリングを明示

---

### 2. Contract-First Development

**定義**: 仕様定義 → 実装の順序を厳守

**ワークフロー**:

```
1. OpenSpec proposal 作成
   ↓
2. Template Dependencies 宣言
   ↓
3. foundation-* Skills 参照
   ↓
4. 実装パターン取得
   ↓
5. 実装
   ↓
6. OpenSpec archive 記録
```

**OpenSpec proposal例**:

```markdown
# Proposal: Customer Management

## Template Dependencies

- **Auth**: JWT認証を使用（Skill: `foundation-auth`）
- **Components**: Header, Sidebar を再利用（Skill: `foundation-components`）
- **API**: serverClient + 統一エラーハンドリング（Skill: `foundation-api`）
- **DB**: `app.customers` テーブル作成（Skill: `foundation-database`）

## Implementation Tasks

- [ ] Migration作成（`app.customers`）
- [ ] Backend API実装（`services/app/customers.ts`）
- [ ] Frontend画面実装（`routes/(app)/customers/`）
- [ ] Error handling統合
- [ ] Permission check（manager以上）

## Expected Behavior

- 顧客CRUD操作
- 検索機能（pg_trgm活用）
- 権限チェック（manager/admin のみ編集可）
- エラー時トースト表示
```

---

### 3. Reusable Components

**定義**: 複数プロジェクトで再利用可能なコンポーネント設計

**再利用性の判断**:

```
コンポーネント作成
    ↓
汎用性がある？
    ├─ YES → src/lib/components/ に配置
    └─ NO → routes/.../components/ に配置（Colocation）
```

**例**:

```typescript
// ✅ Good: 汎用的なModalコンポーネント
// src/lib/components/ui/Modal.svelte
<script lang="ts">
  interface Props {
    title: string;
    open: boolean;
    onClose: () => void;
    children: Snippet;
  }

  let { title, open, onClose, children }: Props = $props();
</script>

<dialog class="modal" class:modal-open={open}>
  <div class="modal-box">
    <h3>{title}</h3>
    <button class="btn btn-sm btn-circle absolute right-2 top-2" onclick={onClose}>✕</button>
    {@render children()}
  </div>
</dialog>

// ✅ Good: ドメイン固有コンポーネント（Colocation）
// routes/(app)/customers/list/components/CustomerTable.svelte
<script lang="ts">
  interface Props {
    customers: Customer[];
    onEdit: (id: string) => void;
  }

  let { customers, onEdit }: Props = $props();
</script>

<table class="table">
  {#each customers as customer}
    <tr>
      <td>{customer.name}</td>
      <td><button onclick={() => onEdit(customer.id)}>編集</button></td>
    </tr>
  {/each}
</table>
```

---

### 4. Colocation Principle

**定義**: 関連ファイルは近くに配置する

**ルール**:

```
routes/(app)/customers/
├── list/
│   ├── +page.svelte                # ページ本体
│   ├── +page.server.ts             # サーバーロジック（API呼び出し）
│   └── components/                 # このページ専用コンポーネント
│       ├── CustomerTable.svelte    # 顧客テーブル
│       ├── CustomerFilter.svelte   # フィルター
│       └── CustomerPagination.svelte
│
└── [id]/
    ├── +page.svelte
    ├── +page.server.ts
    └── components/
        ├── CustomerProfile.svelte  # プロフィール表示
        └── CustomerEditModal.svelte
```

**移動タイミング**:

```
1箇所でのみ使用
    ↓
routes/.../components/ に配置
    ↓
2箇所以上で使用開始
    ↓
src/lib/components/ に移動
```

---

### 5. Unified Error Handling

**定義**: Backend + Frontend で一貫したエラー処理

**Backend**:

```typescript
// services/customer/customer.ts
import { APIError } from "encore.dev/api";

export const createCustomer = api(
  { expose: true, auth: true },
  async (params: CreateCustomerParams): Promise<Customer> => {
    // バリデーション
    if (!params.name) {
      throw APIError.invalidArgument(
        "customer_name_required",
        "顧客名は必須です"
      );
    }

    // 重複チェック
    const existing = await db.queryRow`
      SELECT id FROM app.customers WHERE email = ${params.email}
    `;
    if (existing) {
      throw APIError.alreadyExists(
        "customer_email_duplicate",
        "このメールアドレスは既に登録されています"
      );
    }

    // 作成
    const customer = await db.queryRow`
      INSERT INTO app.customers (name, email)
      VALUES (${params.name}, ${params.email})
      RETURNING *
    `;

    return customer;
  }
);
```

**Frontend**:

```typescript
// routes/(app)/customers/new/+page.server.ts
import { serverClient } from "$lib/utils/api/server-client";
import { handleAPIError } from "$lib/utils/api/error-handler";

export const actions = {
  create: async ({ request }) => {
    const data = await request.formData();

    try {
      const customer = await serverClient.customer.create({
        name: data.get("name") as string,
        email: data.get("email") as string,
      });

      return { success: true, customer };
    } catch (error) {
      // 自動エラー処理（トースト表示、Sentry送信）
      return handleAPIError(error);
    }
  },
};
```

**エラーフロー**:

```
Backend APIError
    ↓
serverClient/browserClient
    ↓
handleAPIError
    ├─ 401 → /login リダイレクト
    ├─ 400/404 → トースト表示
    └─ 500 → トースト表示 + Sentry送信
```

---

## Extension Principles

### ✅ Recommended Extensions

#### 1. 新しいドメインサービス追加

```typescript
// services/inventory/inventory.ts (新規作成)
import { api } from "encore.dev/api";

export const getInventory = api(
  { expose: true, auth: true },
  async (params: GetInventoryParams): Promise<InventoryResponse> => {
    // 新しいビジネスロジック実装
  }
);
```

```sql
-- services/app/migrations/X_create_inventory.up.sql
-- 注意: この例は、app物理データベース内でPostgreSQL論理スキーマを使用する
--      プロジェクト推奨パターンです（テンプレート自体には実装されていません）

-- inventoryサブスキーマを作成（app物理データベース内）
CREATE SCHEMA IF NOT EXISTS inventory;

CREATE TABLE inventory.inventory_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL,
  quantity INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 2. カスタムコンポーネント作成

```svelte
<!-- src/lib/components/domain/ProductCard.svelte -->
<script lang="ts">
  import { Card } from "$lib/components/ui"; // テンプレート再利用

  interface Props {
    product: Product;
    onAddToCart: (id: string) => void;
  }

  let { product, onAddToCart }: Props = $props();
</script>

<Card>
  <h3>{product.name}</h3>
  <p>{product.price}</p>
  <button class="btn btn-primary" onclick={() => onAddToCart(product.id)}>
    カートに追加
  </button>
</Card>
```

#### 3. app.* スキーマ拡張

```sql
-- services/app/migrations/10_create_orders.up.sql
CREATE TABLE app.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES app.customers(id),
  total_amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 4. 既存コンポーネントの拡張

```svelte
<!-- src/lib/components/layout/Header.svelte -->
<script lang="ts">
  import { authStore } from "$lib/stores/auth.svelte";
  import { notificationStore } from "$lib/stores/notification.svelte";

  // ✅ 新しいメニューアイテム追加
  const menuItems = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Customers", href: "/customers" },
    { label: "Orders", href: "/orders" },        // 追加
    { label: "Inventory", href: "/inventory" },  // 追加
  ];
</script>

<!-- 既存のHeader構造を維持しつつ拡張 -->
```

---

### ❌ Forbidden Changes

#### 1. テンプレート機能の削除

```typescript
// ❌ Bad: 既存の認証機能を削除
// services/auth/auth.ts
// export const login = api(...);  // コメントアウト・削除禁止

// ✅ Good: 既存機能を拡張
export const loginWithOTP = api(
  { expose: true, auth: false },
  async (params: LoginWithOTPParams): Promise<LoginResponse> => {
    // OTP検証
    const isValid = await verifyOTP(params.email, params.otp);
    if (!isValid) {
      throw APIError.invalidArgument("invalid_otp", "OTPが無効です");
    }

    // 既存のlogin処理を再利用
    return internalLogin(params.email);
  }
);
```

#### 2. エラーハンドリングの迂回

```typescript
// ❌ Bad: 統一エラーハンドリングを無視
export const actions = {
  create: async ({ request }) => {
    try {
      const customer = await serverClient.customer.create(data);
      console.log("Success"); // トースト表示しない
    } catch (error) {
      console.error(error); // Sentry送信しない
    }
  },
};

// ✅ Good: 統一エラーハンドリング使用
export const actions = {
  create: async ({ request }) => {
    try {
      const customer = await serverClient.customer.create(data);
      return { success: true };
    } catch (error) {
      return handleAPIError(error); // 自動トースト + Sentry
    }
  },
};
```

#### 3. ESLintルールの無効化

```typescript
// ❌ Bad: ESLintルールを無効化
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data: any = await fetch(...);

// ✅ Good: 適切な型定義
interface FetchResponse {
  id: string;
  name: string;
}
const data: FetchResponse = await fetch(...);
```

#### 4. 技術スタック変更

```bash
# ❌ Bad: PostgreSQLをMySQLに変更
# encore.app
database:
  type: mysql  # 禁止

# ✅ Good: PostgreSQLを維持
database:
  type: postgresql
```

---

### 🟡 Careful Extensions

#### 1. テンプレートコンポーネントの上書き

```svelte
<!-- ⚠️ Careful: Headerコンポーネントを完全に上書き -->
<!-- src/lib/components/layout/Header.svelte -->

<!-- 既存の機能が失われる可能性 -->
<header>
  <h1>My Custom Header</h1>
</header>

<!-- ✅ Better: 既存機能を維持しつつ拡張 -->
<script lang="ts">
  import { authStore } from "$lib/stores/auth.svelte";
  import { notificationStore } from "$lib/stores/notification.svelte";

  // テンプレート提供の authStore, notificationStore を継続使用
</script>

<header>
  <!-- 既存のユーザーメニュー、通知アイコン維持 -->
  <div class="navbar">
    <div class="navbar-start">
      <a href="/dashboard">Logo</a>
      <!-- カスタムメニュー追加 -->
      <nav>...</nav>
    </div>
    <div class="navbar-end">
      <!-- テンプレート提供の通知アイコン -->
      <NotificationIcon count={$notificationStore.unreadCount} />
      <!-- テンプレート提供のユーザーメニュー -->
      <UserMenu user={$authStore.user} />
    </div>
  </div>
</header>
```

#### 2. DBスキーマの大幅変更

```sql
-- ⚠️ Careful: auth.users の大幅変更
ALTER TABLE auth.users DROP COLUMN roles;  -- 既存機能が壊れる

-- ✅ Better: 新しいテーブル作成で拡張
CREATE TABLE app.user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  department VARCHAR(100),
  position VARCHAR(100),
  extended_permissions JSONB
);
```

---

## Code Quality Standards

### TypeScript型定義

```typescript
// ✅ Good: 明確な型定義
interface CreateCustomerParams {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
}

interface CreateCustomerResponse {
  id: string;
  name: string;
  email: string | null;
  createdAt: string;
}

// ❌ Bad: any使用
function createCustomer(params: any): any {
  // ...
}
```

### エラーハンドリング

```typescript
// ✅ Good: 具体的なエラー
if (!params.name) {
  throw APIError.invalidArgument(
    "customer_name_required",
    "顧客名は必須です"
  );
}

// ❌ Bad: 汎用的なエラー
if (!params.name) {
  throw new Error("Invalid input");
}
```

### コメント・ドキュメント

```typescript
// ✅ Good: JSDocコメント
/**
 * 顧客を検索する（段階的検索: 完全一致 → 全文検索 → 類似検索）
 * @param query - 検索クエリ
 * @param limit - 取得件数（デフォルト: 20）
 * @returns 検索結果の顧客リスト
 */
export const searchCustomers = api(...);

// ❌ Bad: コメントなし
export const searchCustomers = api(...);
```

---

## Testing Standards

### Backend (Vitest)

```typescript
// ✅ Good: 明確なテストケース
describe("Customer Service", () => {
  beforeEach(async () => {
    await setupTestDB();
  });

  it("should create customer with valid data", async () => {
    const customer = await createCustomer({
      name: "John Doe",
      email: "john@example.com",
    });

    expect(customer.id).toBeDefined();
    expect(customer.name).toBe("John Doe");
  });

  it("should throw error for duplicate email", async () => {
    await createCustomer({ name: "John", email: "john@example.com" });

    await expect(
      createCustomer({ name: "Jane", email: "john@example.com" })
    ).rejects.toThrow("このメールアドレスは既に登録されています");
  });
});
```

### Frontend (Playwright)

```typescript
// ✅ Good: E2Eテスト
test("should create new customer", async ({ page }) => {
  await page.goto("/customers/new");

  await page.fill("input[name=name]", "John Doe");
  await page.fill("input[name=email]", "john@example.com");
  await page.click("button[type=submit]");

  await expect(page.locator(".toast")).toContainText("顧客を作成しました");
  await expect(page).toHaveURL(/\/customers\/\w+/);
});
```

---

## Performance Standards

### Database Queries

```typescript
// ✅ Good: インデックス活用
const customers = await db.query`
  SELECT * FROM app.customers
  WHERE name % ${query}  -- pg_trgm インデックス使用
  ORDER BY similarity(name, ${query}) DESC
  LIMIT 20
`;

// ❌ Bad: フルスキャン
const customers = await db.query`
  SELECT * FROM app.customers
  WHERE LOWER(name) LIKE ${'%' + query.toLowerCase() + '%'}
`;
```

### N+1 Problem回避

```typescript
// ✅ Good: JOIN使用
const orders = await db.query`
  SELECT
    o.*,
    c.name as customer_name,
    c.email as customer_email
  FROM app.orders o
  LEFT JOIN app.customers c ON o.customer_id = c.id
  WHERE o.created_at > NOW() - INTERVAL '30 days'
`;

// ❌ Bad: N+1クエリ
const orders = await db.query`SELECT * FROM app.orders`;
for (const order of orders) {
  const customer = await db.queryRow`
    SELECT * FROM app.customers WHERE id = ${order.customer_id}
  `;
}
```

---

## Security Standards

### SQL Injection防止

```typescript
// ✅ Good: パラメータバインディング
const user = await db.queryRow`
  SELECT * FROM auth.users WHERE email = ${email}
`;

// ❌ Bad: 文字列連結
const user = await db.queryRow(
  `SELECT * FROM auth.users WHERE email = '${email}'`
);
```

### XSS防止

```svelte
<!-- ✅ Good: 自動エスケープ -->
<p>{user.name}</p>

<!-- ❌ Bad: HTMLインジェクション -->
<p>{@html user.name}</p>
```

---

## まとめ

dashboard-accelerator の設計原則:

1. **AI-First**: AIが理解しやすいコード
2. **Contract-First**: 仕様 → 実装の順序
3. **Reusable**: 再利用可能なコンポーネント
4. **Colocation**: 関連ファイルは近くに
5. **Unified Error Handling**: 一貫したエラー処理

**拡張ルール**:
- ✅ 新規ドメインサービス、カスタムコンポーネント、app.* スキーマ
- ❌ テンプレート機能削除、エラー処理迂回、ESLint無効化、技術スタック変更
- 🟡 テンプレートコンポーネント上書き、DBスキーマ大幅変更は慎重に

これらの原則に従うことで、**保守性・拡張性・品質** を維持したプロジェクト開発が可能になります。
