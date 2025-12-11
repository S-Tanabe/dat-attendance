# エラー処理パターン実例集

## パターン1: CRUD操作のエラー処理

### Create

```typescript
// Backend
export const createCustomer = api(
  { auth: true, method: "POST", path: "/customers" },
  async (req: CreateCustomerRequest): Promise<Customer> => {
    // バリデーション
    if (!req.name) throw APIError.invalidArgument('顧客名は必須です');

    // 重複チェック
    const exists = await findByEmail(req.email);
    if (exists) throw APIError.alreadyExists('このメールアドレスは既に登録されています');

    return await insertCustomer(req);
  }
);

// Frontend
async function createCustomer() {
  try {
    await client.crm.createCustomer({ name, email });
    toast.success('顧客を作成しました');
    goto('/crm/customer/list');
  } catch (err: any) {
    // withErrorHandling() が自動でトースト表示
    // 追加処理不要
  }
}
```

---

### Read

```typescript
// Backend
export const getCustomer = api(
  { auth: true, method: "GET", path: "/customers/:id" },
  async ({ id }: { id: string }): Promise<Customer> => {
    const customer = await findById(id);

    if (!customer) {
      throw APIError.notFound('顧客が見つかりません', {
        errorCode: ErrorCode.CUSTOMER_NOT_FOUND,
        customerId: id,
      });
    }

    return customer;
  }
);

// Frontend
let customer = $state<Customer | null>(null);

async function loadCustomer(id: string) {
  try {
    customer = await client.crm.getCustomer({ id });
  } catch (err: any) {
    if (err.code === 404) {
      goto('/crm/customer/list');
    }
  }
}
```

---

### Update

```typescript
// Backend
export const updateCustomer = api(
  { auth: true, method: "PUT", path: "/customers/:id" },
  async ({ id, ...updates }: UpdateCustomerRequest): Promise<Customer> => {
    const customer = await findById(id);
    if (!customer) throw APIError.notFound('顧客が見つかりません');

    return await update(id, updates);
  }
);

// Frontend
async function updateCustomer() {
  await client.crm.updateCustomer({ id, name, email });
  toast.success('顧客情報を更新しました');
}
```

---

### Delete

```typescript
// Backend
export const deleteCustomer = api(
  { auth: true, method: "DELETE", path: "/customers/:id" },
  async ({ id }: { id: string }): Promise<void> => {
    // 削除可能かチェック
    const hasOrders = await customerHasOrders(id);
    if (hasOrders) {
      throw APIError.invalidArgument('この顧客には注文が紐付いているため削除できません', {
        errorCode: ErrorCode.CUSTOMER_HAS_ORDERS,
      });
    }

    await deleteById(id);
  }
);

// Frontend
async function deleteCustomer(id: string) {
  if (!confirm('本当に削除しますか？')) return;

  try {
    await client.crm.deleteCustomer({ id });
    customers = customers.filter(c => c.id !== id);
    toast.success('顧客を削除しました');
  } catch (err: any) {
    if (err.details?.errorCode === 2003) { // CUSTOMER_HAS_ORDERS
      toast.error('この顧客には注文が紐付いているため削除できません');
    }
  }
}
```

---

## パターン2: トランザクションエラー

```typescript
export const createOrder = api(
  { auth: true, method: "POST", path: "/orders" },
  async (req: CreateOrderRequest): Promise<Order> => {
    const db = await getDB();

    try {
      await db.query('BEGIN');

      // 在庫チェック
      const product = await getProduct(req.productId);
      if (product.stock < req.quantity) {
        throw APIError.invalidArgument('在庫が不足しています', {
          errorCode: ErrorCode.INSUFFICIENT_STOCK,
          available: product.stock,
        });
      }

      // 注文作成
      const order = await insertOrder(req);

      // 在庫減算
      await decrementStock(req.productId, req.quantity);

      await db.query('COMMIT');
      return order;
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    }
  }
);
```

---

## Related Patterns

- **backend-errors.md**: Backend エラー処理
- **frontend-errors.md**: Frontend エラー処理
- **error-codes.md**: エラーコード体系
