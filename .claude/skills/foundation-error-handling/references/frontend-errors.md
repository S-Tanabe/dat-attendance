# Frontend エラー処理パターン

## withErrorHandling() 自動処理

Frontend（SvelteKit）では、`withErrorHandling()` が全てのAPIエラーを自動処理します。

---

## 自動処理フロー

```
API Call Error
  ↓
withErrorHandling() Interceptor
  ↓
├─ 401 Unauthorized → clearTokens() + goto('/login')
├─ 400系 (User Error) → toast.error(message)
└─ 500系 (System Error) → Sentry.captureException() + toast.error('システムエラー')
```

---

## 基本使用例

### エラー処理不要（自動）

```svelte
<script lang="ts">
  import { browserClient } from '$lib/api/client';

  async function createCustomer() {
    const client = browserClient();

    // エラー処理は withErrorHandling() が自動実行
    await client.crm.createCustomer({ name: '...' });

    // 成功時の処理のみ記述
    toast.success('顧客を作成しました');
  }
</script>
```

---

## カスタムエラー処理

### パターン1: エラーを捕捉して追加処理

```svelte
<script lang="ts">
  import { browserClient } from '$lib/api/client';

  async function deleteCustomer(id: string) {
    const client = browserClient();

    try {
      await client.crm.deleteCustomer({ id });
      // 成功時
      toast.success('顧客を削除しました');
      await loadCustomers();
    } catch (err: any) {
      // withErrorHandling() が既にトースト表示済み
      // 追加処理が必要な場合のみここで処理

      if (err.code === 409) {
        // 競合エラー → リストを再取得
        await loadCustomers();
      }
    }
  }
</script>
```

---

### パターン2: フィールドエラー表示

```svelte
<script lang="ts">
  import { browserClient } from '$lib/api/client';

  let fieldErrors = $state<Record<string, string>>({});

  async function handleSubmit() {
    const client = browserClient();
    fieldErrors = {}; // リセット

    try {
      await client.crm.createCustomer({ name, email, phone });
      toast.success('顧客を作成しました');
    } catch (err: any) {
      if (err.code === 400 && err.details?.fieldErrors) {
        // フィールドエラー表示
        fieldErrors = err.details.fieldErrors;
      }
    }
  }
</script>

<form onsubmit|preventDefault={handleSubmit}>
  <label>
    <span>顧客名</span>
    <input bind:value={name} />
    {#if fieldErrors.name}
      <span class="error">{fieldErrors.name}</span>
    {/if}
  </label>

  <label>
    <span>メールアドレス</span>
    <input bind:value={email} />
    {#if fieldErrors.email}
      <span class="error">{fieldErrors.email}</span>
    {/if}
  </label>
</form>
```

---

## エラーメッセージカスタマイズ

```typescript
// frontend/src/lib/api/client.ts

function getDefaultErrorMessage(statusCode: number): string {
  const messages: Record<number, string> = {
    400: '入力内容に誤りがあります。',
    401: '認証に失敗しました。再度ログインしてください。',
    403: 'この操作を実行する権限がありません。',
    404: '指定されたリソースが見つかりません。',
    409: 'データが既に更新されています。ページを再読み込みしてください。',
    500: 'システムエラーが発生しました。しばらく待ってから再度お試しください。',
  };

  return messages[statusCode] || '予期しないエラーが発生しました。';
}
```

---

## Related Patterns

- **backend-errors.md**: Backend エラー処理
- **foundation-api error-handling.md**: withErrorHandling() 実装詳細
- **foundation-components toast-pattern.md**: トースト通知
