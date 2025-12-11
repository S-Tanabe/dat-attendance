# エラーコード体系

## Overview

一貫したエラーコード管理のため、数値ベースのエラーコード体系を提供します。

---

## エラーコード定義

```typescript
// backend/shared/errors/error-codes.ts

export enum ErrorCode {
  // Auth (1xxx)
  INVALID_CREDENTIALS = 1001,
  TOKEN_EXPIRED = 1002,
  INSUFFICIENT_PERMISSIONS = 1003,
  SESSION_EXPIRED = 1004,

  // Customer (2xxx)
  CUSTOMER_NOT_FOUND = 2001,
  CUSTOMER_ALREADY_EXISTS = 2002,
  CUSTOMER_HAS_ORDERS = 2003,

  // Order (3xxx)
  ORDER_NOT_FOUND = 3001,
  INSUFFICIENT_STOCK = 3002,
  PAYMENT_FAILED = 3003,

  // Product (4xxx)
  PRODUCT_NOT_FOUND = 4001,
  PRODUCT_OUT_OF_STOCK = 4002,
}
```

---

## 使用例

### Backend

```typescript
import { APIError } from "encore.dev/api";
import { ErrorCode } from "~/shared/errors/error-codes";

throw APIError.notFound('顧客が見つかりません', {
  errorCode: ErrorCode.CUSTOMER_NOT_FOUND,
  customerId: id,
});
```

### Frontend

```typescript
try {
  await client.crm.getCustomer({ id });
} catch (err: any) {
  if (err.details?.errorCode === 2001) { // ErrorCode.CUSTOMER_NOT_FOUND
    // カスタム処理
  }
}
```

---

## エラーコード範囲

| 範囲 | カテゴリ |
|------|---------|
| 1xxx | 認証・セッション |
| 2xxx | 顧客管理 |
| 3xxx | 注文管理 |
| 4xxx | 商品管理 |
| 5xxx | 在庫管理 |
| 9xxx | システムエラー |
