# Vitest Backend Tests

## 基本テスト

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createCustomer, getCustomer } from './customers';

describe('Customer Service', () => {
  beforeEach(async () => {
    // テストDBのセットアップ
    await setupTestDB();
  });

  it('should create customer', async () => {
    const customer = await createCustomer({
      name: 'John Doe',
      email: 'john@example.com',
    });

    expect(customer.id).toBeDefined();
    expect(customer.name).toBe('John Doe');
  });

  it('should throw error for duplicate email', async () => {
    await createCustomer({ name: 'John', email: 'john@example.com' });

    await expect(
      createCustomer({ name: 'Jane', email: 'john@example.com' })
    ).rejects.toThrow('このメールアドレスは既に登録されています');
  });
});
```

## モック

```typescript
import { vi } from 'vitest';

// 関数のモック
const mockSendEmail = vi.fn();

it('should send welcome email', async () => {
  await createCustomer({ name: 'John', email: 'john@example.com' });

  expect(mockSendEmail).toHaveBeenCalledWith({
    to: 'john@example.com',
    subject: 'Welcome',
  });
});
```
