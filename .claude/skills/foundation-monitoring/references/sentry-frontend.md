# Sentry Frontend統合

## 初期化

```typescript
// frontend/src/hooks.client.ts

import * as Sentry from '@sentry/sveltekit';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay(),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```

## 自動エラー送信

```typescript
// frontend/src/lib/api/client.ts

// withErrorHandling() が500系エラーを自動送信
if (statusCode >= 500) {
  Sentry.captureException(error, {
    tags: { error_type: 'api_system_error' },
    extra: { endpoint: error.endpoint },
  });
}
```
