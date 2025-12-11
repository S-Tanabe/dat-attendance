# Sentry Backend統合

## 初期化

実際のSentry設定は `backend/config/sentry.config.ts` で行われています。

```typescript
// backend/config/sentry.config.ts

import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.ENCORE_ENV || 'development',
  tracesSampleRate: 1.0,
  beforeSend(event) {
    // ユーザーエラー（400系）は送信しない
    if (event.tags?.error_type === 'user_error') {
      return null;
    }
    return event;
  },
});
```

## エラー送信

```typescript
try {
  await processOrder(order);
} catch (err) {
  Sentry.captureException(err, {
    tags: {
      service: 'order',
      operation: 'process',
    },
    extra: {
      orderId: order.id,
      customerId: order.customerId,
    },
  });

  throw APIError.internal('注文処理に失敗しました');
}
```
