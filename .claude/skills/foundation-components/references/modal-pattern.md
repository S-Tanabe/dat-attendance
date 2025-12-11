# Modal パターン

## 実装パス

**注意**: このテンプレートにはカスタムModalコンポーネントは含まれていません。DaisyUI 標準の `<dialog>` 要素を使用してください。

---

## Overview

モーダルダイアログの実装パターン。DaisyUI の `<dialog>` 要素（ブラウザネイティブ）を使用します。

### 提供機能

- ブラウザネイティブの `<dialog>` 要素
- DaisyUI スタイル
- アクセシビリティ対応（フォーカストラップ、ESC キーで閉じる）
- `method="dialog"` で自動的に閉じる
- バックドロップクリックで閉じる

---

## 基本実装

### 確認ダイアログ

```svelte
<!-- routes/(app)/customers/list/+page.svelte -->
<script lang="ts">
  import { toast } from '$lib/stores/toast';
  import { browserClient } from '$lib/api/client';

  let deleteModalId = 'delete_modal';
  let targetCustomer: Customer | null = $state(null);

  function openDeleteModal(customer: Customer) {
    targetCustomer = customer;
    const modal = document.getElementById(deleteModalId) as HTMLDialogElement;
    modal?.showModal();
  }

  function closeDeleteModal() {
    const modal = document.getElementById(deleteModalId) as HTMLDialogElement;
    modal?.close();
    targetCustomer = null;
  }

  async function handleDelete() {
    if (!targetCustomer) return;

    const client = browserClient();
    await client.customers.delete({ id: targetCustomer.id });

    closeDeleteModal();
    toast.success('顧客を削除しました');
  }
</script>

<!-- Trigger Button -->
<button class="btn btn-error" onclick={() => openDeleteModal(customer)}>
  削除
</button>

<!-- Modal -->
<dialog id={deleteModalId} class="modal">
  <div class="modal-box">
    <h3 class="text-lg font-bold">顧客を削除</h3>
    <p class="py-4">
      本当に <strong>{targetCustomer?.name}</strong> を削除しますか？
    </p>

    <div class="modal-action">
      <form method="dialog">
        <button class="btn">キャンセル</button>
      </form>
      <button class="btn btn-error" onclick={handleDelete}>削除</button>
    </div>
  </div>

  <!-- Backdrop (クリックで閉じる) -->
  <form method="dialog" class="modal-backdrop">
    <button>close</button>
  </form>
</dialog>
```

---

## フォーム Modal パターン

### 新規作成フォーム

```svelte
<script lang="ts">
  import { toast } from '$lib/stores/toast';
  import { browserClient } from '$lib/api/client';

  let createModalId = 'create_modal';
  let formData = $state({ name: '', email: '', phone: '' });

  function openCreateModal() {
    const modal = document.getElementById(createModalId) as HTMLDialogElement;
    modal?.showModal();
  }

  function closeCreateModal() {
    const modal = document.getElementById(createModalId) as HTMLDialogElement;
    modal?.close();
    formData = { name: '', email: '', phone: '' }; // リセット
  }

  async function handleCreate() {
    const client = browserClient();
    await client.customers.create(formData);

    closeCreateModal();
    toast.success('顧客を作成しました');
  }
</script>

<button class="btn btn-primary" onclick={openCreateModal}>
  新規作成
</button>

<dialog id={createModalId} class="modal">
  <div class="modal-box">
    <h3 class="text-lg font-bold">新規顧客</h3>

    <form onsubmit|preventDefault={handleCreate} class="space-y-4 mt-4">
      <label class="form-control">
        <span class="label-text">顧客名</span>
        <input
          type="text"
          bind:value={formData.name}
          class="input input-bordered"
          required
        />
      </label>

      <label class="form-control">
        <span class="label-text">メールアドレス</span>
        <input
          type="email"
          bind:value={formData.email}
          class="input input-bordered"
          required
        />
      </label>

      <label class="form-control">
        <span class="label-text">電話番号</span>
        <input
          type="tel"
          bind:value={formData.phone}
          class="input input-bordered"
        />
      </label>

      <div class="modal-action">
        <button
          type="button"
          class="btn"
          onclick={closeCreateModal}
        >
          キャンセル
        </button>
        <button type="submit" class="btn btn-primary">作成</button>
      </div>
    </form>
  </div>

  <form method="dialog" class="modal-backdrop">
    <button>close</button>
  </form>
</dialog>
```

---

## モーダルサイズの変更

```svelte
<!-- 小サイズ -->
<div class="modal-box max-w-sm">
  <h3 class="text-lg font-bold">確認</h3>
  <!-- ... -->
</div>

<!-- 中サイズ（デフォルト） -->
<div class="modal-box">
  <h3 class="text-lg font-bold">編集</h3>
  <!-- ... -->
</div>

<!-- 大サイズ -->
<div class="modal-box max-w-5xl">
  <h3 class="text-lg font-bold">詳細設定</h3>
  <!-- ... -->
</div>

<!-- 全幅 -->
<div class="modal-box w-11/12 max-w-5xl">
  <h3 class="text-lg font-bold">データテーブル</h3>
  <!-- ... -->
</div>
```

---

## Loading State パターン

```svelte
<script lang="ts">
  import { toast } from '$lib/stores/toast';

  let isLoading = $state(false);

  async function handleSubmit() {
    isLoading = true;

    try {
      const client = browserClient();
      await client.customers.create({ ... });

      closeModal();
      toast.success('作成しました');
    } catch (err) {
      toast.error('エラーが発生しました');
    } finally {
      isLoading = false;
    }
  }
</script>

<dialog id="my_modal" class="modal">
  <div class="modal-box">
    <h3 class="text-lg font-bold">新規顧客</h3>

    <form onsubmit|preventDefault={handleSubmit}>
      <!-- Form Fields -->

      <div class="modal-action">
        <button
          type="button"
          class="btn"
          onclick={closeModal}
          disabled={isLoading}
        >
          キャンセル
        </button>
        <button
          type="submit"
          class="btn btn-primary"
          disabled={isLoading}
        >
          {isLoading ? '作成中...' : '作成'}
          {#if isLoading}
            <span class="loading loading-spinner loading-sm"></span>
          {/if}
        </button>
      </div>
    </form>
  </div>

  <form method="dialog" class="modal-backdrop">
    <button disabled={isLoading}>close</button>
  </form>
</dialog>
```

---

## モーダルを開く/閉じるヘルパー

### 再利用可能なヘルパー関数

```typescript
// lib/utils/modal.ts

export function openModal(modalId: string) {
  const modal = document.getElementById(modalId) as HTMLDialogElement;
  modal?.showModal();
}

export function closeModal(modalId: string) {
  const modal = document.getElementById(modalId) as HTMLDialogElement;
  modal?.close();
}
```

### 使用例

```svelte
<script lang="ts">
  import { openModal, closeModal } from '$lib/utils/modal';

  const MODAL_ID = 'my_modal';

  function handleOpen() {
    openModal(MODAL_ID);
  }

  function handleClose() {
    closeModal(MODAL_ID);
  }
</script>

<button onclick={handleOpen}>開く</button>

<dialog id={MODAL_ID} class="modal">
  <!-- ... -->
</dialog>
```

---

## アクセシビリティ

### 自動的に提供される機能

- **フォーカストラップ**: モーダル内でのみタブ移動
- **ESC キーで閉じる**: ブラウザネイティブ機能
- **role="dialog"**: 自動的に設定される
- **aria-modal="true"**: 自動的に設定される

### 追加の ARIA 属性

```svelte
<dialog id="my_modal" class="modal" aria-labelledby="modal-title">
  <div class="modal-box">
    <h3 id="modal-title" class="text-lg font-bold">タイトル</h3>
    <p id="modal-description">説明文</p>
    <!-- ... -->
  </div>
</dialog>
```

---

## Troubleshooting

### 問題1: モーダルが背面コンテンツをスクロールさせてしまう

**原因**: `<dialog>` 要素は自動的に背面をロックしますが、DaisyUI の実装によっては問題が起こる場合があります。

**対処**: CSS でオーバーフローを制御
```css
dialog::backdrop {
  background-color: rgba(0, 0, 0, 0.5);
}

dialog[open] {
  overflow-y: auto;
}
```

---

### 問題2: ESC キーで閉じた後、状態がリセットされない

**原因**: `close` イベントをリッスンしていない

**対処**:
```svelte
<script lang="ts">
  import { onMount } from 'svelte';

  onMount(() => {
    const modal = document.getElementById('my_modal') as HTMLDialogElement;

    modal?.addEventListener('close', () => {
      // リセット処理
      formData = { name: '', email: '' };
    });
  });
</script>
```

---

### 問題3: バックドロップクリックでフォーム内容が消える

**原因**: `method="dialog"` によるフォームのリセット

**対処**: バックドロップクリックを無効化するか、確認ダイアログを表示
```svelte
<script lang="ts">
  function handleBackdropClick(event: MouseEvent) {
    event.preventDefault();

    if (confirm('入力内容が失われますがよろしいですか？')) {
      closeModal();
    }
  }
</script>

<form method="dialog" class="modal-backdrop" onclick={handleBackdropClick}>
  <button>close</button>
</form>
```

---

### 問題4: モーダルが開かない

**原因**: `showModal()` ではなく `show()` を使用している可能性

**確認**:
```typescript
// 正しい
modal.showModal(); // モーダル表示（バックドロップあり）

// 間違い
modal.show(); // ダイアログ表示（バックドロップなし）
```

---

## Related Patterns

- **toast-pattern.md**: モーダル操作後のトースト表示
- **foundation-api error-handling.md**: フォーム送信時のエラー処理
