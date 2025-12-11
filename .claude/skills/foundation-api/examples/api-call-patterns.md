# API呼び出しパターン集

このファイルは、実際の実装に基づいた API 呼び出しパターンの実例を提供します。

**重要**: すべての例は `frontend/src/lib/api/client.ts` の実装に基づいています。

---

## SSR: Load関数でのデータ取得

### パターン1: 単一リソース取得

```typescript
// frontend/src/routes/(app)/customers/[id]/+page.server.ts

import { serverClient } from '$lib/api/client';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const client = serverClient(event);

  try {
    const customer = await client.app.getCustomer({ id: event.params.id });
    return { customer };
  } catch (err: any) {
    if (err.status === 404) {
      throw error(404, '顧客が見つかりません');
    }
    throw error(500, 'データ取得に失敗しました');
  }
};
```

---

### パターン2: 複数API並列呼び出し

```typescript
// frontend/src/routes/(app)/customers/[id]/+page.server.ts

import { serverClient } from '$lib/api/client';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const client = serverClient(event);

  // 並列実行
  const [customer, orders, activities] = await Promise.all([
    client.app.getCustomer({ id: event.params.id }),
    client.app.listOrders({ customerId: event.params.id }),
    client.app.listActivities({ customerId: event.params.id }),
  ]);

  return {
    customer,
    orders,
    activities,
  };
};
```

---

### パターン3: withErrorHandlingAndRefresh の使用

```typescript
// frontend/src/routes/(app)/dashboard/+page.server.ts

import {
  serverClient,
  withErrorHandlingAndRefresh,
  setTokensToCookies,
  getTokensFromCookies
} from '$lib/api/client';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const client = serverClient(event);
  const { refresh_token } = getTokensFromCookies(event.cookies);

  if (!refresh_token) {
    throw error(401, '認証が必要です');
  }

  try {
    const stats = await withErrorHandlingAndRefresh({
      exec: () => client.app.getDashboardStats(),
      refresh: () => client.auth.refresh({ refresh_token }),
      onRefreshed: (tokens) => {
        setTokensToCookies(event.cookies, tokens);
      },
      errorHandling: {
        showGlobalError: false, // SSRではグローバルエラー不要
        reportToSentry: true,
      }
    });

    return { stats };
  } catch (err: any) {
    throw error(500, 'データ取得に失敗しました');
  }
};
```

---

### パターン4: エラーハンドリングとフォールバック

```typescript
// frontend/src/routes/(app)/dashboard/+page.server.ts

import { serverClient } from '$lib/api/client';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const client = serverClient(event);

  // メインデータ取得（失敗時はエラー）
  const stats = await client.app.getStats();

  // サブデータ取得（失敗時はフォールバック）
  let recentOrders = [];
  try {
    recentOrders = await client.app.listRecentOrders({ limit: 5 });
  } catch (err) {
    console.error('Failed to load recent orders:', err);
    // フォールバック: 空配列
  }

  return {
    stats,
    recentOrders,
  };
};
```

---

## Browser: イベントハンドラでのAPI呼び出し

### パターン1: フォーム送信（withErrorHandling使用）

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

      console.log('Customer updated!');
    } catch (err: any) {
      // withErrorHandling() が既にグローバルエラーストアにセット済み
      console.error('Update failed:', err);
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

### パターン2: 削除確認ダイアログ

```svelte
<!-- frontend/src/routes/(app)/customers/list/+page.svelte -->
<script lang="ts">
  import { browserClient, withErrorHandling } from '$lib/api/client';
  import { page } from '$app/stores';

  let { data } = $props();
  let customers = $state(data.customers);

  const accessToken = $derived($page.data.accessToken);

  async function deleteCustomer(id: string) {
    // 確認ダイアログ
    if (!confirm('本当に削除しますか？')) {
      return;
    }

    const client = browserClient(accessToken);

    try {
      await withErrorHandling(
        () => client.app.deleteCustomer({ id })
      );

      // 成功時: リストから削除
      customers = customers.filter((c) => c.id !== id);
    } catch (err: any) {
      // エラー時: withErrorHandling() がグローバルエラーストアにセット
    }
  }
</script>

{#each customers as customer}
  <div>
    <span>{customer.name}</span>
    <button onclick={() => deleteCustomer(customer.id)}>削除</button>
  </div>
{/each}
```

---

### パターン3: 楽観的UI更新

```svelte
<!-- frontend/src/routes/(app)/settings/+page.svelte -->
<script lang="ts">
  import { browserClient, withErrorHandling } from '$lib/api/client';
  import { page } from '$app/stores';

  let { data } = $props();
  let settings = $state(data.settings);

  const accessToken = $derived($page.data.accessToken);

  async function toggleNotifications() {
    const client = browserClient(accessToken);

    // 楽観的UI更新（先にUIを更新）
    const newValue = !settings.emailNotifications;
    settings.emailNotifications = newValue;

    try {
      await withErrorHandling(
        () => client.app.updateSettings({
          emailNotifications: newValue,
        })
      );
    } catch (err: any) {
      // 失敗時: ロールバック
      settings.emailNotifications = !newValue;
    }
  }
</script>

<button onclick={toggleNotifications}>
  {settings.emailNotifications ? '通知ON' : '通知OFF'}
</button>
```

---

### パターン4: ページネーション

```svelte
<!-- frontend/src/routes/(app)/customers/list/+page.svelte -->
<script lang="ts">
  import { browserClient, withErrorHandling } from '$lib/api/client';
  import { page } from '$app/stores';

  let { data } = $props();
  let customers = $state(data.customers);
  let currentPage = $state(1);
  let pageSize = $state(20);
  let totalPages = $state(data.totalPages);

  const accessToken = $derived($page.data.accessToken);

  async function loadPage(newPage: number) {
    const client = browserClient(accessToken);

    try {
      const result = await withErrorHandling(
        () => client.app.listCustomers({
          page: newPage,
          pageSize: pageSize,
        })
      );

      customers = result.customers;
      totalPages = result.totalPages;
      currentPage = newPage;
    } catch (err: any) {
      // エラー処理は withErrorHandling() が実施
    }
  }
</script>

<div class="pagination">
  <button
    onclick={() => loadPage(currentPage - 1)}
    disabled={currentPage === 1}
  >
    前へ
  </button>

  <span>ページ {currentPage} / {totalPages}</span>

  <button
    onclick={() => loadPage(currentPage + 1)}
    disabled={currentPage === totalPages}
  >
    次へ
  </button>
</div>
```

---

### パターン5: リアルタイム検索（デバウンス）

```svelte
<!-- frontend/src/routes/(app)/customers/list/+page.svelte -->
<script lang="ts">
  import { browserClient, withErrorHandling } from '$lib/api/client';
  import { page } from '$app/stores';

  let { data } = $props();
  let customers = $state(data.customers);
  let searchQuery = $state('');
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const accessToken = $derived($page.data.accessToken);

  async function performSearch(query: string) {
    const client = browserClient(accessToken);

    try {
      const result = await withErrorHandling(
        () => client.app.searchCustomers({ query })
      );

      customers = result.customers;
    } catch (err: any) {
      // エラー処理は withErrorHandling() が実施
    }
  }

  function handleSearch(query: string) {
    // デバウンス: 500ms待ってから検索実行
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      performSearch(query);
    }, 500);
  }

  $effect(() => {
    handleSearch(searchQuery);
  });
</script>

<input
  type="text"
  bind:value={searchQuery}
  placeholder="顧客名で検索..."
/>

{#each customers as customer}
  <div>{customer.name}</div>
{/each}
```

---

## Form Actions: Progressive Enhancement

### パターン1: use:enhance によるAjax送信

```svelte
<!-- frontend/src/routes/(app)/customers/new/+page.svelte -->
<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { setError } from '$lib/stores/error';

  let loading = $state(false);
</script>

<form
  method="POST"
  action="?/create"
  use:enhance={() => {
    loading = true;

    return async ({ result, update }) => {
      loading = false;

      if (result.type === 'success') {
        setError({
          userMessage: '顧客を作成しました',
          statusCode: 200,
          code: 'SUCCESS',
        }, 3000);
        goto(`/customers/${result.data.id}`);
      } else if (result.type === 'failure') {
        setError({
          userMessage: result.data.message,
          statusCode: 400,
          code: 'VALIDATION_ERROR',
        }, 5000);
      }

      await update();
    };
  }}
>
  <input name="name" required />
  <input name="email" type="email" required />
  <button type="submit" disabled={loading}>
    {loading ? '作成中...' : '作成'}
  </button>
</form>
```

```typescript
// frontend/src/routes/(app)/customers/new/+page.server.ts

import { serverClient } from '$lib/api/client';
import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
  create: async (event) => {
    const client = serverClient(event);
    const formData = await event.request.formData();

    const name = formData.get('name') as string;
    const email = formData.get('email') as string;

    try {
      const customer = await client.app.createCustomer({ name, email });
      return { success: true, id: customer.id };
    } catch (err: any) {
      return fail(400, { message: err.message || 'エラーが発生しました' });
    }
  },
};
```

---

## Error Handling パターン

### パターン1: エラーを無視（グローバルエラーストア表示のみ）

```svelte
<script lang="ts">
  import { browserClient, withErrorHandling } from '$lib/api/client';
  import { page } from '$app/stores';

  const accessToken = $derived($page.data.accessToken);

  async function saveSettings() {
    const client = browserClient(accessToken);

    // エラー時: withErrorHandling() が自動的にグローバルエラーストアにセット
    await withErrorHandling(
      () => client.app.updateSettings({ ... })
    );

    // 成功時の処理のみ記述
    console.log('Settings saved!');
  }
</script>
```

---

### パターン2: エラーを捕捉して追加処理

```svelte
<script lang="ts">
  import { browserClient, withErrorHandling } from '$lib/api/client';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  const accessToken = $derived($page.data.accessToken);

  async function deleteAccount() {
    const client = browserClient(accessToken);

    try {
      await withErrorHandling(
        () => client.app.deleteAccount()
      );

      // 成功時: ログアウト
      goto('/login');
    } catch (err: any) {
      // エラー時: withErrorHandling() がグローバルエラーストアにセット済み
      // 追加処理: エラーログを送信
      console.error('Account deletion failed:', err);
    }
  }
</script>
```

---

### パターン3: カスタムエラーメッセージ

```svelte
<script lang="ts">
  import { browserClient, withErrorHandling } from '$lib/api/client';
  import { setError } from '$lib/stores/error';
  import { page } from '$app/stores';

  const accessToken = $derived($page.data.accessToken);

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

### パターン4: Sentryレポートを無効化

```svelte
<script lang="ts">
  import { browserClient, withErrorHandling } from '$lib/api/client';
  import { page } from '$app/stores';

  const accessToken = $derived($page.data.accessToken);

  async function checkAvailability(username: string) {
    const client = browserClient(accessToken);

    try {
      const result = await withErrorHandling(
        () => client.app.checkUsernameAvailability({ username }),
        { reportToSentry: false } // 404はSentryに送信しない
      );

      return result.available;
    } catch (err: any) {
      // 404エラーは正常な応答として処理
      if (err.statusCode === 404) {
        return true; // 利用可能
      }
      return false;
    }
  }
</script>
```

---

## Advanced: serverClientWithForwardedHeaders

### IP/UAヘッダー転送が必要な場合

ログインやリフレッシュなど、クライアントのIP/UAをバックエンドに正確に伝える必要がある場合に使用:

```typescript
// frontend/src/routes/api/auth/login/+server.ts

import { serverClientWithForwardedHeaders, setTokensToCookies } from '$lib/api/client';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
  const client = serverClientWithForwardedHeaders(event);
  const { email, password } = await event.request.json();

  try {
    const result = await client.auth.login({ email, password });

    // トークンをCookieに保存
    setTokensToCookies(event.cookies, result);

    return json({ success: true });
  } catch (err: any) {
    return json({ error: err.message }, { status: 401 });
  }
};
```

**転送されるヘッダー**:
- `user-agent`
- `x-forwarded-for`
- `x-real-ip`
- `cf-connecting-ip` (Cloudflare)
- `true-client-ip` (Akamai)
- `forwarded` (RFC 7239)

---

## Related Patterns

- **client-pattern.md**: serverClient/browserClient の使い分け
- **error-handling.md**: withErrorHandling() の実装
- **retry-logic.md**: withAutoRefresh() の実装
