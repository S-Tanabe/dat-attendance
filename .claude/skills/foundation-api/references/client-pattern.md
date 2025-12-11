# APIクライアントパターン

## 実装パス

`frontend/src/lib/api/client.ts`

---

## Client使い分け

### serverClient(event) - SSR用

**重要**: `event` パラメータが必須です。

```typescript
// +page.server.ts
import { serverClient } from '$lib/api/client';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const client = serverClient(event);
  const customers = await client.crm.listCustomers();
  return { customers };
};
```

**内部動作**:
- `event.cookies` から `ACCESS_COOKIE` を自動取得
- `Authorization: Bearer <token>` ヘッダーを自動付与
- トークン更新直後でも即座に反映（常に最新のCookieを参照）

### browserClient(accessToken?) - ブラウザ用

オプションで `accessToken` を渡せます（通常は不要）。

```svelte
<!-- +page.svelte -->
<script lang="ts">
  import { browserClient } from '$lib/api/client';

  async function createCustomer() {
    const client = browserClient(); // accessTokenは省略可（認証不要のAPIの場合）
    await client.crm.createCustomer({ name: '...' });
  }
</script>
```

**内部動作**:
- `accessToken` が渡された場合、`Authorization: Bearer <token>` ヘッダーを自動付与
- 省略時は認証ヘッダーなし

### serverClientWithForwardedHeaders(event) - IP/UA転送用

ログインやリフレッシュなど、クライアントのIP/UAをバックエンドに正確に伝える必要がある場合に使用。

```typescript
// +server.ts (API Route)
import { serverClientWithForwardedHeaders } from '$lib/api/client';
import type { RequestEvent } from '@sveltejs/kit';

export async function POST(event: RequestEvent) {
  const client = serverClientWithForwardedHeaders(event);
  const result = await client.auth.login({ email, password });
  return json(result);
}
```

**転送されるヘッダー**:
- `user-agent`
- `x-forwarded-for`
- `x-real-ip`
- `cf-connecting-ip` (Cloudflare)
- `true-client-ip` (Akamai)
- `forwarded` (RFC 7239)

---

## 自動機能

### 1. 自動リフレッシュ: withAutoRefresh()

401エラー時、自動的にRefresh Tokenで更新して1回だけリトライ。

```typescript
import { withAutoRefresh, setTokensToCookies } from '$lib/api/client';

const result = await withAutoRefresh({
  exec: () => client.crm.getCustomer({ id }),
  refresh: () => client.auth.refresh({ refresh_token: rt }),
  onRefreshed: (tokens) => {
    setTokensToCookies(event.cookies, tokens);
  }
});
```

### 2. エラーハンドリング: withErrorHandling()

APIエラーを統一的に処理します。

```typescript
import { withErrorHandling } from '$lib/api/client';

const result = await withErrorHandling(
  () => client.crm.getCustomer({ id }),
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

**自動機能**:
- システムエラー（500+） → Sentryに `error` レベルで送信
- クライアントエラー（400-499） → Sentryに `warning` レベルで送信
- 認証エラー → `/login` へ自動リダイレクト（1.5秒遅延）
- グローバルエラーストアへ自動セット

### 3. 統合版: withErrorHandlingAndRefresh()

自動リフレッシュとエラーハンドリングを組み合わせた便利関数。

```typescript
import { withErrorHandlingAndRefresh } from '$lib/api/client';

const result = await withErrorHandlingAndRefresh({
  exec: () => client.user.getProfile(),
  refresh: () => client.auth.refresh({ refresh_token: rt }),
  onRefreshed: (tokens) => {
    setTokensToCookies(event.cookies, tokens);
  },
  errorHandling: {
    showGlobalError: true,
    redirectOnAuthError: true,
  }
});
```

---

## HttpOnly Cookie管理

### Cookie設定

```typescript
import { setTokensToCookies } from '$lib/api/client';

// ログイン時
setTokensToCookies(event.cookies, {
  access_token: 'xxx',
  refresh_token: 'yyy',
  expires_in: 900, // 秒（オプション、デフォルト: 15分）
});
```

**自動設定内容**:
- `httpOnly: true` - XSS攻撃対策
- `sameSite: 'lax'` - CSRF攻撃対策
- `secure: true` - 本番環境のみHTTPS必須
- `path: '/'` - 全パスで有効
- Access Token: `maxAge = expires_in` (デフォルト: 15分)
- Refresh Token: `maxAge = 30日` (固定)

### Cookie削除

```typescript
import { clearTokens } from '$lib/api/client';

// ログアウト時
clearTokens(event.cookies);
```

### Cookie取得

```typescript
import { getTokensFromCookies } from '$lib/api/client';

const { access_token, refresh_token } = getTokensFromCookies(event.cookies);
```

### Cookie名

```typescript
export const ACCESS_COOKIE = 'acc_at';
export const REFRESH_COOKIE = 'acc_rt';
```
