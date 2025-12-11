# Playwright E2E Tests

**注意**: このドキュメントは参考例です。テンプレートにはPlaywright E2Eテストは含まれていません。必要に応じて以下のパターンを参考に実装してください。

## 基本テスト

```typescript
import { test, expect } from '@playwright/test';

test.describe('Customer Management', () => {
  test('should create new customer', async ({ page }) => {
    await page.goto('/crm/customer/new');

    await page.fill('input[name="name"]', 'John Doe');
    await page.fill('input[name="email"]', 'john@example.com');
    await page.click('button[type="submit"]');

    await expect(page.locator('.toast')).toContainText('顧客を作成しました');
  });

  test('should display validation errors', async ({ page }) => {
    await page.goto('/crm/customer/new');
    await page.click('button[type="submit"]');

    await expect(page.locator('.error')).toContainText('顧客名は必須です');
  });
});
```

## 認証

```typescript
import { test as base } from '@playwright/test';

const test = base.extend({
  authenticatedPage: async ({ page }, use) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');

    await use(page);
  },
});

test('should access protected page', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/crm/customer/list');
  await expect(authenticatedPage.locator('h1')).toContainText('顧客一覧');
});
```
