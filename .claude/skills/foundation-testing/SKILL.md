---
name: foundation-testing
description: |
  dashboard-acceleratorテンプレートが提供するテストパターン。
  Vitest (Backend), Playwright (E2E) のテスト戦略を提供。

  【WHEN to use】
  - テスト作成時
  - テスト実行時
  - CI/CD設定時

  【TRIGGER keywords】
  テスト、testing、Vitest、Playwright、E2E、ユニットテスト
allowed-tools: Read, Grep
---

# Template Testing: テストパターン

## Overview

**実装パス**:
- Backend Tests: `backend/services/*/*.test.ts`

**注意**: テンプレートには以下のテストファイルのみが含まれています：
- `backend/services/notification/processor.test.ts`
- `backend/services/notification/templates/index.test.ts`
- `backend/hello/hello.test.ts`

E2Eテスト（Playwright）はテンプレートに含まれていません。必要に応じて追加してください。

### Provided Testing Tools

- **Vitest**: Backend ユニットテスト（一部実装済み）
- **Playwright**: E2E テスト（未実装、以下は参考例）
- **Encore Test**: Encore統合テスト

---

## Quick Reference

### Vitest (Backend)

```typescript
// backend/services/crm/customers.test.ts

import { describe, it, expect } from 'vitest';
import { getCustomer } from './customers';

describe('getCustomer', () => {
  it('should return customer by id', async () => {
    const customer = await getCustomer({ id: '123' });
    expect(customer.id).toBe('123');
  });

  it('should throw 404 for non-existent customer', async () => {
    await expect(getCustomer({ id: 'invalid' }))
      .rejects.toThrow('顧客が見つかりません');
  });
});
```

### Playwright (E2E)

**注意**: 以下は参考例です。テンプレートにはE2Eテストは含まれていません。

```typescript
// 参考例: frontend/tests/customer-list.spec.ts（未実装）

import { test, expect } from '@playwright/test';

test('should display customer list', async ({ page }) => {
  await page.goto('/crm/customer/list');

  await expect(page.locator('h1')).toContainText('顧客一覧');
  await expect(page.locator('table tbody tr')).toHaveCount(10);
});
```

### Encore Test

```bash
# Backend テスト実行
cd backend
encore test

# 特定のサービスのみ
encore test ./services/crm
```

---

## Related Skills

- **foundation-api**: テスト実行フロー
- **foundation-accelerator**: プロジェクト全体構造
