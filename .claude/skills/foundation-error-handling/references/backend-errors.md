# Backend エラー処理パターン

## Encore.dev APIError

Encore.dev は標準的な APIError クラスを提供しており、HTTPステータスコードに自動変換されます。

---

## APIError一覧

### 1. APIError.notFound()

**HTTP Status**: 404 Not Found

**使用例**:
```typescript
export const getCustomer = api(
  { auth: true, method: "GET", path: "/customers/:id" },
  async ({ id }: { id: string }): Promise<Customer> => {
    const customer = await db.query(`SELECT * FROM crm.customers WHERE id = $1`, [id]);

    if (!customer) {
      throw APIError.notFound('顧客が見つかりません', {
        customerId: id,
      });
    }

    return customer;
  }
);
```

---

### 2. APIError.invalidArgument()

**HTTP Status**: 400 Bad Request

**使用例**:
```typescript
export const createCustomer = api(
  { auth: true, method: "POST", path: "/customers" },
  async ({ name, email }: CreateCustomerRequest): Promise<Customer> => {
    // バリデーション
    if (!name || name.trim().length === 0) {
      throw APIError.invalidArgument('顧客名は必須です', {
        field: 'name',
      });
    }

    if (!email || !email.includes('@')) {
      throw APIError.invalidArgument('有効なメールアドレスを入力してください', {
        field: 'email',
      });
    }

    // ...
  }
);
```

---

### 3. APIError.unauthenticated()

**HTTP Status**: 401 Unauthorized

**使用例**:
```typescript
export const login = api(
  { expose: true, method: "POST", path: "/auth/login" },
  async ({ email, password }: LoginRequest): Promise<LoginResponse> => {
    const user = await getUserByEmail(email);

    if (!user) {
      throw APIError.unauthenticated('メールアドレスまたはパスワードが間違っています');
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);

    if (!isValidPassword) {
      throw APIError.unauthenticated('メールアドレスまたはパスワードが間違っています');
    }

    // ...
  }
);
```

---

### 4. APIError.permissionDenied()

**HTTP Status**: 403 Forbidden

**使用例**:
```typescript
export const deleteCustomer = api(
  { auth: true, method: "DELETE", path: "/customers/:id" },
  async ({ id }: { id: string }): Promise<void> => {
    const userId = authData()?.userID;
    const userRole = authData()?.role;

    // 権限チェック
    if (userRole !== 'admin' && userRole !== 'manager') {
      throw APIError.permissionDenied('削除権限がありません', {
        requiredRole: ['admin', 'manager'],
        userRole,
      });
    }

    await deleteCustomerById(id);
  }
);
```

---

### 5. APIError.alreadyExists()

**HTTP Status**: 409 Conflict

**使用例**:
```typescript
export const createCustomer = api(
  { auth: true, method: "POST", path: "/customers" },
  async ({ name, email }: CreateCustomerRequest): Promise<Customer> => {
    // 既存チェック
    const existing = await db.query(`
      SELECT id FROM crm.customers WHERE email = $1
    `, [email]);

    if (existing) {
      throw APIError.alreadyExists('このメールアドレスは既に登録されています', {
        email,
        existingCustomerId: existing.id,
      });
    }

    // ...
  }
);
```

---

### 6. APIError.internal()

**HTTP Status**: 500 Internal Server Error

**使用例**:
```typescript
export const getCustomerStats = api(
  { auth: true, method: "GET", path: "/customers/:id/stats" },
  async ({ id }: { id: string }): Promise<CustomerStats> => {
    try {
      const stats = await calculateStats(id);
      return stats;
    } catch (err) {
      // システムエラーはSentryに送信
      Sentry.captureException(err, {
        tags: { service: 'crm', operation: 'getCustomerStats' },
        extra: { customerId: id },
      });

      throw APIError.internal('統計情報の取得に失敗しました');
    }
  }
);
```

---

## カスタムエラー詳細

### details オプション

```typescript
throw APIError.notFound('顧客が見つかりません', {
  customerId: id,
  timestamp: new Date().toISOString(),
  additionalInfo: 'deleted or never existed',
});
```

**Frontend で受け取る**:
```typescript
catch (err: any) {
  console.log(err.code); // 404
  console.log(err.message); // '顧客が見つかりません'
  console.log(err.details); // { customerId: '...', timestamp: '...', ... }
}
```

---

## エラーレスポンス形式

### 標準レスポンス

```json
{
  "error": {
    "code": "not_found",
    "message": "顧客が見つかりません",
    "details": {
      "customerId": "12345"
    }
  }
}
```

### HTTPステータスコードマッピング

| APIError | HTTPステータス | code文字列 |
|----------|--------------|-----------|
| `notFound()` | 404 | `"not_found"` |
| `invalidArgument()` | 400 | `"invalid_argument"` |
| `unauthenticated()` | 401 | `"unauthenticated"` |
| `permissionDenied()` | 403 | `"permission_denied"` |
| `alreadyExists()` | 409 | `"already_exists"` |
| `internal()` | 500 | `"internal"` |

---

## バリデーションエラー

### 複数フィールドのバリデーション

```typescript
export const createCustomer = api(
  { auth: true, method: "POST", path: "/customers" },
  async (req: CreateCustomerRequest): Promise<Customer> => {
    const errors: Record<string, string> = {};

    // バリデーション
    if (!req.name || req.name.trim().length === 0) {
      errors.name = '顧客名は必須です';
    }

    if (!req.email || !req.email.includes('@')) {
      errors.email = '有効なメールアドレスを入力してください';
    }

    if (!req.phone || req.phone.length < 10) {
      errors.phone = '電話番号は10桁以上で入力してください';
    }

    // エラーがある場合
    if (Object.keys(errors).length > 0) {
      throw APIError.invalidArgument('入力内容に誤りがあります', {
        fieldErrors: errors,
      });
    }

    // ...
  }
);
```

**Frontend での処理**:
```typescript
try {
  await client.crm.createCustomer({ name, email, phone });
} catch (err: any) {
  if (err.code === 400 && err.details?.fieldErrors) {
    // フィールドごとにエラー表示
    Object.entries(err.details.fieldErrors).forEach(([field, message]) => {
      showFieldError(field, message);
    });
  }
}
```

---

## データベースエラー処理

### UNIQUE制約違反

```typescript
export const createCustomer = api(
  { auth: true, method: "POST", path: "/customers" },
  async ({ name, email }: CreateCustomerRequest): Promise<Customer> => {
    try {
      const customer = await db.query(`
        INSERT INTO crm.customers (name, email, created_by, updated_by)
        VALUES ($1, $2, $3, $3)
        RETURNING *
      `, [name, email, userId]);

      return customer;
    } catch (err: any) {
      // UNIQUE制約違反
      if (err.code === '23505') { // PostgreSQL error code
        throw APIError.alreadyExists('このメールアドレスは既に登録されています', {
          email,
        });
      }

      // その他のDBエラー
      Sentry.captureException(err);
      throw APIError.internal('顧客の作成に失敗しました');
    }
  }
);
```

---

### FOREIGN KEY制約違反

```typescript
export const createOrder = api(
  { auth: true, method: "POST", path: "/orders" },
  async ({ customerId, items }: CreateOrderRequest): Promise<Order> => {
    try {
      const order = await db.query(`
        INSERT INTO app.orders (customer_id, total, created_by, updated_by)
        VALUES ($1, $2, $3, $3)
        RETURNING *
      `, [customerId, total, userId]);

      return order;
    } catch (err: any) {
      // FOREIGN KEY制約違反
      if (err.code === '23503') { // PostgreSQL error code
        throw APIError.notFound('指定された顧客が見つかりません', {
          customerId,
        });
      }

      Sentry.captureException(err);
      throw APIError.internal('注文の作成に失敗しました');
    }
  }
);
```

---

## ビジネスロジックエラー

### 在庫不足エラー

```typescript
export const createOrder = api(
  { auth: true, method: "POST", path: "/orders" },
  async ({ items }: CreateOrderRequest): Promise<Order> => {
    // 在庫チェック
    for (const item of items) {
      const product = await getProduct(item.productId);

      if (product.stock < item.quantity) {
        throw APIError.invalidArgument('在庫が不足しています', {
          productId: item.productId,
          requested: item.quantity,
          available: product.stock,
        });
      }
    }

    // 注文作成
    // ...
  }
);
```

---

## エラーロギング

### Sentryへの送信

```typescript
import * as Sentry from '@sentry/node';

export const processPayment = api(
  { auth: true, method: "POST", path: "/payments" },
  async (req: PaymentRequest): Promise<PaymentResponse> => {
    try {
      const result = await paymentGateway.charge(req);
      return result;
    } catch (err) {
      // システムエラーはSentryに送信
      Sentry.captureException(err, {
        tags: {
          service: 'payment',
          operation: 'charge',
        },
        extra: {
          paymentMethod: req.paymentMethod,
          amount: req.amount,
        },
      });

      throw APIError.internal('決済処理に失敗しました');
    }
  }
);
```

---

### Encoreログ

```typescript
import { log } from "encore.dev";

export const getCustomer = api(
  { auth: true, method: "GET", path: "/customers/:id" },
  async ({ id }: { id: string }): Promise<Customer> => {
    log.info('Fetching customer', { customerId: id });

    const customer = await db.query(`SELECT * FROM crm.customers WHERE id = $1`, [id]);

    if (!customer) {
      log.warn('Customer not found', { customerId: id });
      throw APIError.notFound('顧客が見つかりません', { customerId: id });
    }

    return customer;
  }
);
```

---

## Troubleshooting

### 問題1: エラーが500になる

**原因**: `APIError` を使わず生の `Error` を throw している

**確認**:
```typescript
// ❌ 悪い例
throw new Error('Customer not found'); // 500エラーになる

// ✅ 良い例
throw APIError.notFound('顧客が見つかりません');
```

---

### 問題2: エラーdetailsがFrontendで受け取れない

**原因**: details をJSON serializable な形式にしていない

**確認**:
```typescript
// ❌ 悪い例（Date オブジェクトはシリアライズできない）
throw APIError.notFound('...', { timestamp: new Date() });

// ✅ 良い例
throw APIError.notFound('...', { timestamp: new Date().toISOString() });
```

---

## Related Patterns

- **frontend-errors.md**: Frontend エラー処理
- **error-codes.md**: エラーコード体系
- **sentry.md**: Sentry統合
