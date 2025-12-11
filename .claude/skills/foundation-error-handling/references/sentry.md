# Sentry統合パターン

## Overview

Sentry を使用してシステムエラーを自動レポートします。

---

## Backend統合

**注意**: 実際のSentry設定は `backend/config/sentry.config.ts` で行われています。詳細は `foundation-monitoring` スキルを参照してください。

```typescript
// 使用例: エラーキャプチャ

import * as Sentry from "@sentry/node";

export const processOrder = api(
  { auth: true, method: "POST", path: "/orders" },
  async (req: OrderRequest): Promise<Order> => {
    try {
      return await createOrder(req);
    } catch (err) {
      // Sentryに送信
      Sentry.captureException(err, {
        tags: { service: 'order', operation: 'create' },
        extra: { customerId: req.customerId },
      });

      throw APIError.internal('注文の作成に失敗しました');
    }
  }
);
```

---

## Frontend統合

```typescript
// frontend/src/lib/api/client.ts

import * as Sentry from '@sentry/sveltekit';

// withErrorHandling() が500系エラーを自動送信
async function handleAPIError(error: any): Promise<void> {
  if (error.code >= 500) {
    Sentry.captureException(error, {
      tags: { error_type: 'api_system_error' },
      extra: { endpoint: error.endpoint },
    });
  }
}
```

---

## 環境変数

```bash
# .env
SENTRY_DSN=https://xxx@sentry.io/yyy
SENTRY_AUTH_TOKEN=xxx
```
