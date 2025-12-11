# Toast 通知システムパターン

## 実装パス

```
frontend/src/lib/
├── components/
│   └── ToastHost.svelte
└── stores/
    └── toast.ts
```

---

## Overview

トースト通知システム。success、error、info、warning の4種類の通知をサポートします。

### 提供機能

- 4種類の通知タイプ（success、error、info、warning）
- 自動消去（カスタマイズ可能な timeout）
- 手動消去（「閉じる」ボタン）
- スタッキング（複数通知の積み重ね）
- アニメーション（fly-in/fade-out）
- description フィールド（補足説明）

---

## Toast Store 実装

```typescript
// frontend/src/lib/stores/toast.ts

import { writable } from 'svelte/store';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
  description?: string;
  timeout?: number; // ms
}

export const toast = {
  success: (message: string, description?: string) =>
    notify({ type: 'success', message, description }),

  error: (message: string, description?: string) =>
    notify({ type: 'error', message, description, timeout: 6000 }),

  info: (message: string, description?: string) =>
    notify({ type: 'info', message, description }),

  warning: (message: string, description?: string) =>
    notify({ type: 'warning', message, description }),
};
```

---

## ToastHost コンポーネント

```svelte
<!-- frontend/src/lib/components/ToastHost.svelte -->
<script lang='ts'>
  import type { Toast } from '$lib/stores/toast';
  import { close, toasts } from '$lib/stores/toast';
  import { fade, fly } from 'svelte/transition';

  const ALERT_CLASS: Record<Toast['type'], string> = {
    success: 'alert-success',
    error: 'alert-error',
    info: 'alert-info',
    warning: 'alert-warning',
  };

  const TYPE_LABEL: Record<Toast['type'], string> = {
    success: '成功',
    error: 'エラー',
    info: '情報',
    warning: '警告',
  };
</script>

<div class='toast toast-end toast-bottom z-[1000] max-w-sm'>
  {#each $toasts as t (t.id)}
    <article
      class={`alert shadow-lg ${ALERT_CLASS[t.type]}`}
      in:fly={{ x: 24, duration: 150 }}
      out:fade
      role='status'
    >
      <div class='flex flex-1 items-start gap-3'>
        <div class='space-y-1 text-base-content'>
          <header class='text-xs font-semibold uppercase tracking-wide opacity-80'>
            {TYPE_LABEL[t.type]}
          </header>
          <p class='text-sm font-medium leading-snug'>{t.message}</p>
          {#if t.description}
            <p class='text-xs leading-snug opacity-80'>{t.description}</p>
          {/if}
        </div>
        <button
          class='btn btn-ghost btn-xs text-base-content/80'
          type='button'
          onclick={() => close(t.id)}
        >
          閉じる
        </button>
      </div>
    </article>
  {/each}
</div>
```

---

## レイアウト統合

```svelte
<!-- frontend/src/routes/(app)/+layout.svelte -->
<script lang="ts">
  import Header from '$lib/components/Header.svelte';
  import { Sidebar } from '$lib/components/sidebar';
  import ToastHost from '$lib/components/ToastHost.svelte';
</script>

<div class="flex h-screen">
  <Sidebar />
  <main class="flex-1">
    <slot />
  </main>
</div>

<!-- Toast Container (最上位レイヤー) -->
<ToastHost />
```

---

## 使用例

### 1. 成功通知

```svelte
<script lang="ts">
  import { toast } from '$lib/stores/toast';
  import { browserClient } from '$lib/api/client';

  async function saveSettings() {
    const client = browserClient();
    await client.settings.update({ ... });

    toast.success('設定を保存しました');
  }
</script>

<button onclick={saveSettings}>保存</button>
```

---

### 2. エラー通知（description付き）

```svelte
<script lang="ts">
  import { toast } from '$lib/stores/toast';

  async function deleteCustomer(id: string) {
    try {
      await client.customers.delete({ id });
      toast.success('顧客を削除しました');
    } catch (err: any) {
      toast.error(
        '削除に失敗しました',
        err.message || 'サーバーエラーが発生しました'
      );
    }
  }
</script>
```

---

### 3. 情報通知

```svelte
<script lang="ts">
  import { toast } from '$lib/stores/toast';

  function startExport() {
    toast.info(
      'エクスポートを開始しました',
      '完了したらメールで通知します'
    );
    // ... export logic ...
  }
</script>

<button onclick={startExport}>エクスポート</button>
```

---

### 4. 警告通知

```svelte
<script lang="ts">
  import { toast } from '$lib/stores/toast';

  function handleLowStock(product: Product) {
    if (product.stock < 10) {
      toast.warning(
        '在庫が少なくなっています',
        `${product.name}: 残り${product.stock}個`
      );
    }
  }
</script>
```

---

## カスタマイズ

### Timeout のカスタマイズ

```typescript
// デフォルト値（toast.ts 内）
success: 3500ms (3.5秒)
error: 6000ms (6秒)
info: 3500ms
warning: 3500ms
```

### notify() 関数を直接使用

```typescript
import { notify } from '$lib/stores/toast';

// カスタムタイムアウト
notify({
  type: 'success',
  message: '保存しました',
  timeout: 10000 // 10秒間表示
});

// 自動消去しない（手動でのみ閉じる）
notify({
  type: 'error',
  message: '重要なエラーです',
  description: '管理者に連絡してください',
  timeout: 0 // 自動消去なし
});
```

---

### 位置のカスタマイズ

```svelte
<!-- 右下（デフォルト） -->
<div class="toast toast-end toast-bottom">
  <!-- ... -->
</div>

<!-- 左下 -->
<div class="toast toast-start toast-bottom">
  <!-- ... -->
</div>

<!-- 右上 -->
<div class="toast toast-end toast-top">
  <!-- ... -->
</div>

<!-- 中央下 -->
<div class="toast toast-center toast-bottom">
  <!-- ... -->
</div>
```

---

## API統合

### withErrorHandling() との連携

```typescript
// frontend/src/lib/api/client.ts

import { toast } from '$lib/stores/toast';

async function handleAPIError(error: any): Promise<void> {
  const statusCode = error.code || error.status || 500;

  // 400系: ユーザーエラー
  if (statusCode >= 400 && statusCode < 500) {
    const message = error.details?.message || getDefaultErrorMessage(statusCode);
    toast.error(message);
    return;
  }

  // 500系: システムエラー
  if (statusCode >= 500) {
    toast.error(
      'システムエラーが発生しました',
      'しばらく待ってから再度お試しください'
    );
    return;
  }
}
```

---

### Form Actions との連携

```svelte
<!-- frontend/src/routes/(app)/customers/new/+page.svelte -->
<script lang="ts">
  import { enhance } from '$app/forms';
  import { toast } from '$lib/stores/toast';

  let loading = $state(false);
</script>

<form
  method="POST"
  use:enhance={() => {
    loading = true;

    return async ({ result, update }) => {
      loading = false;

      if (result.type === 'success') {
        toast.success('顧客を作成しました');
      } else if (result.type === 'failure') {
        toast.error(result.data.message);
      }

      await update();
    };
  }}
>
  <input name="name" required />
  <button type="submit" disabled={loading}>作成</button>
</form>
```

---

## アクセシビリティ

### ARIA属性

```svelte
<div
  class='toast toast-end toast-bottom'
  aria-live='assertive'
  aria-atomic='true'
>
  {#each $toasts as t (t.id)}
    <article
      class="alert"
      role='status'
      aria-label={`${TYPE_LABEL[t.type]}: ${t.message}`}
    >
      <!-- ... -->
    </article>
  {/each}
</div>
```

---

## Troubleshooting

### 問題1: トーストが表示されない

**原因**: `ToastHost` がレイアウトに配置されていない

**確認**:
```svelte
<!-- routes/(app)/+layout.svelte -->
<ToastHost />
```

---

### 問題2: トーストが自動で消えない

**原因**: `timeout` が 0 または未定義

**確認**:
```typescript
// toast.ts 内のデフォルト値を確認
const toast: Toast = { id, timeout: 3500, ...t };
```

---

### 問題3: トーストが重なって表示される

**原因**: `z-index` が不足している

**対処**:
```svelte
<div class="toast toast-end toast-bottom z-[1000]">
  <!-- z-[1000] を追加 -->
</div>
```

---

### 問題4: メッセージが長すぎて切れる

**原因**: `max-w-sm` の制限

**対処**:
```svelte
<div class="toast toast-end toast-bottom z-[1000] max-w-md">
  <!-- max-w-sm → max-w-md に変更 -->
</div>
```

---

## Related Patterns

- **foundation-api error-handling.md**: API エラー時の自動トースト表示
- **foundation-notification**: リアルタイム通知との統合
- **header-pattern.md**: ログアウト時のトースト表示
