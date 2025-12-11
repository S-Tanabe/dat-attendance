# エラーハンドリングパターン

## 実装パス

`frontend/src/lib/api/client.ts`

---

## withErrorHandling() の仕組み

### アーキテクチャ

```
API Call
  ↓
withErrorHandling() でラップ
  ↓
├─ System Error (500系) → Sentry送信（errorレベル） + グローバルエラーストアにセット
├─ Client Error (400系) → Sentry送信（warningレベル） + グローバルエラーストアにセット
├─ Auth Error (401) → グローバルエラーストアにセット + /login リダイレクト
└─ Success → 正常レスポンス返却
```

---

## 基本的な使い方

### シンプルな例

```typescript
import { withErrorHandling } from '$lib/api/client';
import { browserClient } from '$lib/api/client';

async function saveSettings() {
  const client = browserClient(accessToken);

  await withErrorHandling(
    () => client.app.updateSettings({ ... })
  );

  // 成功時の処理
  console.log('Settings saved!');
}
```

### オプション付き

```typescript
await withErrorHandling(
  () => client.app.getProfile(),
  {
    showGlobalError: true,        // グローバルエラーストアにセット（デフォルト: true）
    redirectOnAuthError: true,    // 認証エラー時に /login へ自動リダイレクト（デフォルト: true）
    autoCloseMs: 5000,            // エラー自動クリア時間（デフォルト: 5000ms）
    reportToSentry: true,         // Sentryへ自動レポート（デフォルト: Sentry有効時true）
    onError: (uiError) => {       // カスタムエラーハンドラ
      console.log('Error:', uiError);
    }
  }
);
```

---

## エラー分類と処理

### 1. システムエラー（500系）

**対象**:
- `500 Internal Server Error`
- `502 Bad Gateway`
- `503 Service Unavailable`
- `504 Gateway Timeout`

**処理フロー**:
```typescript
// 1. APIエラーをUIErrorに変換
const uiError = transformApiError(error);

// 2. Sentry自動送信（errorレベル）
reportError(new Error(uiError.userMessage), {
  level: 'error',
  tags: {
    errorCode: uiError.code,
    statusCode: String(uiError.statusCode),
    errorCategory: 'system',
  },
  extra: {
    details: uiError.details,
    originalError: uiError.originalError,
  },
});

// 3. グローバルエラーストアにセット
setError(uiError, autoCloseMs);

// 4. エラーを再スロー（呼び出し元で処理可能）
throw uiError;
```

---

### 2. クライアントエラー（400系）

**対象**:
- `400 Bad Request`（バリデーションエラー）
- `403 Forbidden`（権限不足）
- `404 Not Found`（リソース未存在）
- `409 Conflict`（競合エラー）

**処理フロー**:
```typescript
// 1. APIエラーをUIErrorに変換
const uiError = transformApiError(error);

// 2. Sentry送信（warningレベル）
// クライアントエラーも監視のため送信
reportError(new Error(uiError.userMessage), {
  level: 'warning',
  tags: {
    errorCode: uiError.code,
    statusCode: String(uiError.statusCode),
    errorCategory: 'client',
  },
});

// 3. グローバルエラーストアにセット
setError(uiError, autoCloseMs);

// 4. エラーを再スロー
throw uiError;
```

---

### 3. 認証エラー（401）

**対象**:
- `401 Unauthorized`（認証失敗、トークン期限切れ）

**処理フロー**:
```typescript
// 1. withAutoRefresh() が先に処理を試行
//    - Refresh Token が有効 → 自動リフレッシュ
//    - Refresh Token が無効 → 401エラーがそのまま返る

// 2. ここまで到達 = リフレッシュ失敗
//    → グローバルエラーストアにセット + /login リダイレクト

// グローバルエラーストアにセット
setError(uiError, autoCloseMs);

// ログインページへリダイレクト（1.5秒遅延）
if (typeof window !== 'undefined') {
  setTimeout(() => {
    void goto('/login');
  }, 1500);
}

// エラーを再スロー
throw uiError;
```

---

## 実装例

### SSR（+page.server.ts）での使用

```typescript
// frontend/src/routes/(app)/customers/+page.server.ts

import { serverClient, withErrorHandling } from '$lib/api/client';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const client = serverClient(event);

  try {
    const customers = await withErrorHandling(
      () => client.app.listCustomers(),
      {
        showGlobalError: false, // SSRではグローバルエラー不要
        reportToSentry: true,
      }
    );

    return { customers };
  } catch (err: any) {
    // SvelteKitのエラーページを表示
    throw error(500, 'データ取得に失敗しました');
  }
};
```

### Browser（+page.svelte）での使用

```svelte
<!-- frontend/src/routes/(app)/customers/[id]/+page.svelte -->
<script lang="ts">
  import { browserClient, withErrorHandling } from '$lib/api/client';
  import { page } from '$app/stores';

  let { data } = $props();
  let customer = $state(data.customer);

  // アクセストークンを取得（実際の実装では適切な方法で取得）
  const accessToken = $derived($page.data.accessToken);

  async function updateCustomer() {
    const client = browserClient(accessToken);

    try {
      await withErrorHandling(
        () => client.app.updateCustomer({
          id: customer.id,
          name: customer.name,
          email: customer.email,
        })
      );

      // 成功時の処理のみ記述
      console.log('Customer updated!');
    } catch (err: any) {
      // withErrorHandling() が既にグローバルエラーストアにセット済み
      // 追加の処理が必要な場合のみここで処理
    }
  }
</script>

<form onsubmit={(e) => { e.preventDefault(); updateCustomer(); }}>
  <input bind:value={customer.name} />
  <input bind:value={customer.email} />
  <button type="submit">更新</button>
</form>
```

---

## グローバルエラーストア連携

### エラーストアの構造

```typescript
// frontend/src/lib/stores/error.ts

import type { UIError } from '$lib/errors/types';
import { writable } from 'svelte/store';

export const globalError = writable<UIError | null>(null);

export function setError(error: UIError, autoCloseMs: number = 5000) {
  globalError.set(error);

  if (autoCloseMs > 0) {
    setTimeout(() => {
      globalError.set(null);
    }, autoCloseMs);
  }
}

export function clearError() {
  globalError.set(null);
}
```

### UIでエラーを表示

```svelte
<!-- frontend/src/routes/(app)/+layout.svelte -->
<script lang="ts">
  import { globalError, clearError } from '$lib/stores/error';
</script>

{#if $globalError}
  <div class="alert alert-error">
    <span>{$globalError.userMessage}</span>
    <button onclick={clearError}>閉じる</button>
  </div>
{/if}

<slot />
```

---

## カスタムエラーハンドリング

### パターン1: エラーを捕捉して独自処理

```svelte
<script lang="ts">
  import { browserClient, withErrorHandling } from '$lib/api/client';

  async function deleteCustomer(id: string) {
    const client = browserClient(accessToken);

    try {
      await withErrorHandling(
        () => client.app.deleteCustomer({ id })
      );

      // 成功時: リストを再取得
      await loadCustomers();
    } catch (error: any) {
      // withErrorHandling() が既にグローバルエラーストアにセット済み
      // 追加の処理が必要な場合のみここで処理

      if (error.statusCode === 409) {
        // 競合エラーの場合、リストを再取得
        await loadCustomers();
      }
    }
  }
</script>
```

### パターン2: カスタムエラーメッセージ

```svelte
<script lang="ts">
  import { browserClient, withErrorHandling } from '$lib/api/client';
  import { setError } from '$lib/stores/error';

  async function inviteUser(email: string) {
    const client = browserClient(accessToken);

    try {
      await withErrorHandling(
        () => client.app.inviteUser({ email }),
        { showGlobalError: false } // デフォルトメッセージを抑制
      );

      setError({
        userMessage: `${email} に招待メールを送信しました`,
        statusCode: 200,
        code: 'SUCCESS',
      }, 3000);
    } catch (err: any) {
      // カスタムメッセージを表示
      if (err.statusCode === 409) {
        setError({
          userMessage: `${email} は既に登録されています`,
          statusCode: 409,
          code: 'ALREADY_EXISTS',
        }, 5000);
      }
    }
  }
</script>
```

---

## Backend連携

### Encore APIError との統合

Backend（Encore.dev）が返すエラーは自動的にHTTPステータスコードに変換されます:

```typescript
// backend/services/app/customers.ts

import { APIError } from "encore.dev/api";

export const getCustomer = api(
  { auth: true, method: "GET", path: "/customers/:id" },
  async ({ id }: { id: string }): Promise<Customer> => {
    const customer = await db.queryRow`
      SELECT * FROM app_users WHERE id = ${id}
    `;

    if (!customer) {
      // 404エラー → Frontend の withErrorHandling() が処理
      throw APIError.notFound('顧客が見つかりません');
    }

    return customer;
  }
);
```

**APIError マッピング**:
- `APIError.notFound()` → `404 Not Found`
- `APIError.invalidArgument()` → `400 Bad Request`
- `APIError.unauthenticated()` → `401 Unauthorized`
- `APIError.permissionDenied()` → `403 Forbidden`
- `APIError.alreadyExists()` → `409 Conflict`
- `APIError.internal()` → `500 Internal Server Error`

---

## Troubleshooting

### 問題1: エラーが表示されない

**原因**: グローバルエラーストアを表示するUIが実装されていない

**対処**:
```svelte
<!-- routes/(app)/+layout.svelte -->
{#if $globalError}
  <div class="alert alert-error">
    <span>{$globalError.userMessage}</span>
  </div>
{/if}
```

---

### 問題2: Sentry にクライアントエラーが大量送信される

**原因**: クライアントエラー（400系）も Sentry に送信される仕様

**確認**:
```typescript
// frontend/src/lib/api/client.ts

// クライアントエラーは warning レベルで送信
const level = isSystemError(uiError) ? 'error' : 'warning';
```

**対処**: Sentry側でwarningレベルをフィルタリングするか、reportToSentryオプションをfalseに設定

```typescript
await withErrorHandling(
  () => client.app.updateSettings({ ... }),
  { reportToSentry: false }
);
```

---

### 問題3: 401エラーでログインページに飛ばない

**原因**: `redirectOnAuthError` オプションがfalseに設定されている

**確認**:
```typescript
// デフォルトはtrue
await withErrorHandling(
  () => client.app.getProfile(),
  { redirectOnAuthError: true } // これが必須
);
```

---

## Related Patterns

- **client-pattern.md**: serverClient/browserClient の使い分け
- **retry-logic.md**: withAutoRefresh() の実装
- **foundation-error-handling**: Backend エラーコード体系
