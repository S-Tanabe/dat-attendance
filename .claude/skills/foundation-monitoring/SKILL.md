---
name: foundation-monitoring
description: |
  dashboard-acceleratorテンプレートが提供する監視・ロギングシステム。
  Sentry統合によるエラー追跡、Encoreログ管理を提供。

  【WHEN to use】
  - エラー追跡設定時
  - ログ管理時
  - Sentry統合時

  【TRIGGER keywords】
  監視、monitoring、Sentry、logging、エラー追跡
allowed-tools: Read, Grep
---

# Template Monitoring: 監視・ロギング

## Overview

**実装パス**:
- Backend: `backend/shared/monitoring/sentry.ts`, `backend/config/sentry.config.ts`
- Frontend: `frontend/src/lib/monitoring/sentry.ts`, `frontend/src/hooks.client.ts`, `frontend/src/hooks.server.ts`

### Provided Features

- **Sentry統合**: Backend + Frontend エラー追跡
- **Encoreログ**: 構造化ログ
- **パフォーマンス監視**: トレーシング

---

## Quick Reference

### Sentry Backend

```typescript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.ENCORE_ENV,
  tracesSampleRate: 1.0,
});

// エラー送信
Sentry.captureException(error, {
  tags: { service: 'crm', operation: 'getCustomer' },
  extra: { customerId: id },
});
```

### Sentry Frontend

```typescript
import * as Sentry from '@sentry/sveltekit';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [new Sentry.BrowserTracing()],
});
```

### Encoreログ

```typescript
import log from "encore.dev/log";

log.info('Customer created', { customerId: customer.id });
log.error('Failed to create customer', { error: err.message });
```

---

## Related Skills

- **foundation-error-handling**: Sentry統合詳細
- **foundation-api**: Encoreログ管理
