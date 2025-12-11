---
name: foundation-error-handling
description: |
  dashboard-acceleratorテンプレートが提供する統一エラーハンドリングシステム。
  Backend (Encore.dev) と Frontend (SvelteKit) を統合したエラー処理を提供。

  【WHEN to use】
  - エラー処理実装時
  - エラーコード追加時
  - エラーフロー調査時
  - Sentry統合時

  【TRIGGER keywords】
  エラー、エラーハンドリング、APIError、try-catch、Sentry、トースト、エラーコード
allowed-tools: Read, Grep
---

# Template Error Handling: 統一エラーハンドリング

## Overview

**実装パス**:
- Backend: `backend/shared/errors/`
- Frontend: `frontend/src/lib/api/client.ts`, `frontend/src/lib/stores/toast.ts`, `frontend/src/lib/errors/`

### Provided Features

dashboard-acceleratorテンプレートは、以下のエラーハンドリング機能を提供しています:

- **Backend**: Encore APIError 体系（標準HTTPステータス + ビジネスエラー）
- **Frontend**: 自動エラーハンドリング（トースト表示、認証リダイレクト）
- **Sentry統合**: システムエラーの自動レポート
- **エラーコード体系**: 一貫したエラーコード管理
- **Error Boundaries**: グローバルエラーキャッチ

---

## Quick Reference

### 1. Backend エラー処理

**詳細**: `references/backend-errors.md`

```typescript
// backend/services/crm/customers.ts

import { APIError } from "encore.dev/api";

export const getCustomer = api(
  { auth: true, method: "GET", path: "/customers/:id" },
  async ({ id }: { id: string }): Promise<Customer> => {
    const customer = await db.query(`SELECT * FROM crm.customers WHERE id = $1`, [id]);

    if (!customer) {
      // 404 Not Found
      throw APIError.notFound('顧客が見つかりません', {
        customerId: id,
      });
    }

    return customer;
  }
);
```

**Encore APIError 一覧**:
- `APIError.notFound()` → 404
- `APIError.invalidArgument()` → 400
- `APIError.unauthenticated()` → 401
- `APIError.permissionDenied()` → 403
- `APIError.alreadyExists()` → 409
- `APIError.internal()` → 500

---

### 2. Frontend エラー処理

**詳細**: `references/frontend-errors.md`

```typescript
// frontend/src/lib/api/client.ts

// withErrorHandling() が自動的に処理:
// - 400系 → トースト表示
// - 401 → /login リダイレクト
// - 500系 → Sentry送信 + トースト表示

const client = browserClient(); // 自動でエラーハンドリング適用済み

// エラーは自動処理されるため、try-catchは省略可能
await client.crm.createCustomer({ name: '...' });
```

---

### 3. エラーコード体系

**詳細**: `references/error-codes.md`

```typescript
// エラーコード定義（文字列ベース）
export enum AuthErrorCode {
  INVALID_TOKEN = "ERR_AUTH_001",
  TOKEN_EXPIRED = "ERR_AUTH_002",
  INVALID_CREDENTIALS = "ERR_AUTH_005",
}

export enum UserErrorCode {
  EMAIL_ALREADY_EXISTS = "ERR_USER_001",
  USER_NOT_FOUND = "ERR_USER_005",
}

export enum NotificationErrorCode {
  DELIVERY_FAILED = "ERR_NOTIFICATION_001",
  TEMPLATE_NOT_FOUND = "ERR_NOTIFICATION_003",
}

// 使用例
throw APIError.notFound('ユーザーが見つかりません', {
  errorCode: UserErrorCode.USER_NOT_FOUND,
  userId: id,
});
```

---

### 4. Sentry統合

**詳細**: `references/sentry.md`

```typescript
// Backend
import * as Sentry from '@sentry/node';

Sentry.captureException(error, {
  tags: { service: 'crm', operation: 'getCustomer' },
  extra: { customerId: id },
});

// Frontend
import * as Sentry from '@sentry/sveltekit';

// withErrorHandling() が500系エラーを自動送信
```

---

## エラーフロー

### Backend → Frontend

```
Backend API Error
  ↓
APIError.notFound('message', { details })
  ↓
HTTP 404 + JSON { error: { code: 404, message: '...', details: {...} } }
  ↓
Frontend withErrorHandling()
  ↓
├─ 400系 → toast.error(message)
├─ 401 → goto('/login')
└─ 500系 → Sentry.captureException() + toast.error('システムエラー')
```

---

## エラーハンドリング原則

### Backend（Encore.dev）

```typescript
// ✅ 推奨: APIError を使用
throw APIError.notFound('顧客が見つかりません');

// ❌ 非推奨: 生の Error を throw
throw new Error('Customer not found'); // 500エラーになる
```

---

### Frontend（SvelteKit）

```typescript
// ✅ 推奨: withErrorHandling() に任せる
await client.crm.createCustomer({ name: '...' });

// ✅ 推奨: 追加処理が必要な場合のみ try-catch
try {
  await client.crm.deleteCustomer({ id });
} catch (err: any) {
  if (err.code === 409) {
    // 競合エラーの場合、リストを再取得
    await loadCustomers();
  }
}
```

---

## OpenSpec Integration

OpenSpecでエラー処理を定義する際、テンプレートのエラーハンドリングシステムを明記してください:

```markdown
## Error Handling

### Backend Errors

Uses: foundation-error-handling backend errors
Reference: .claude/skills/foundation-error-handling/references/backend-errors.md

Error Responses:
- 404: Customer not found (ErrorCode.CUSTOMER_NOT_FOUND)
- 409: Customer already exists (ErrorCode.CUSTOMER_ALREADY_EXISTS)
- 500: Internal server error (auto-reported to Sentry)

### Frontend Handling

Uses: foundation-error-handling frontend errors
Auto-toast display: Yes
Auto-Sentry report: Yes (500 errors only)
Custom handling: Refresh customer list on 409 error
```

---

## Related Skills

- **foundation-api error-handling.md**: withErrorHandling() 実装
- **foundation-api retry-logic.md**: 401エラー時の自動リトライ
- **foundation-components toast-pattern.md**: トースト通知
- **foundation-monitoring sentry.md**: Sentry統合詳細

---

## 制約

### ❌ 禁止事項

- Backend で生の `Error` を throw しない（必ず `APIError` を使用）
- Frontend で全てのエラーを try-catch しない（`withErrorHandling()` に任せる）
- エラーメッセージにスタックトレースを含めない（Sentryに送信）
- ユーザーエラー（400系）を Sentry に送信しない

### ✅ 推奨事項

- Backend は `APIError` を使用（`notFound`, `invalidArgument`, etc.）
- Frontend は `withErrorHandling()` に任せる（自動トースト表示）
- システムエラー（500系）のみ Sentry に送信
- エラーコードを定義して一貫性を保つ
- エラーメッセージはユーザーフレンドリーに

---

## Next Steps

各エラー処理パターンの詳細な実装ガイドは、references/ 内のファイルを参照してください:

- `references/backend-errors.md` - Backend エラー処理詳細
- `references/frontend-errors.md` - Frontend エラー処理詳細
- `references/error-codes.md` - エラーコード体系
- `references/sentry.md` - Sentry統合
- `examples/error-patterns.md` - エラー処理実例
