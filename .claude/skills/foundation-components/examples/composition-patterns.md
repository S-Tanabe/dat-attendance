# コンポーネント組み合わせパターン集

このファイルは、複数のコンポーネントを組み合わせた実装パターンの実例を提供します。

---

## パターン1: 標準的なCRUD画面

### 顧客一覧ページ

```svelte
<!-- frontend/src/routes/(app)/crm/customer/list/+page.svelte -->
<script lang="ts">
  import { browserClient } from '$lib/api/client';
  import { toast } from '$lib/stores/toast';

  let { data } = $props();
  let customers = $state(data.customers);

  // 削除モーダル
  const deleteModalId = 'delete_modal';
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
    await client.crm.deleteCustomer({ id: targetCustomer.id });

    customers = customers.filter((c) => c.id !== targetCustomer.id);
    closeDeleteModal();
    toast.success('顧客を削除しました');
  }
</script>

<!-- ヘッダー -->
<div class="flex items-center justify-between mb-6">
  <h1 class="text-2xl font-bold">顧客一覧</h1>
  <a href="/crm/customer/new" class="btn btn-primary">新規作成</a>
</div>

<!-- テーブル -->
<div class="card bg-base-100 shadow-xl">
  <div class="card-body">
    <table class="table">
      <thead>
        <tr>
          <th>顧客名</th>
          <th>メールアドレス</th>
          <th>登録日</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each customers as customer}
          <tr>
            <td>
              <a href="/crm/customer/{customer.id}" class="link">
                {customer.name}
              </a>
            </td>
            <td>{customer.email}</td>
            <td>{new Date(customer.createdAt).toLocaleDateString()}</td>
            <td>
              <button
                class="btn btn-sm btn-error"
                onclick={() => openDeleteModal(customer)}
              >
                削除
              </button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<!-- 削除確認モーダル -->
<dialog id={deleteModalId} class="modal">
  <div class="modal-box max-w-sm">
    <h3 class="text-lg font-bold">確認</h3>
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

  <form method="dialog" class="modal-backdrop">
    <button>close</button>
  </form>
</dialog>
```

---

## パターン2: 詳細ページ + 編集モーダル

### 顧客詳細ページ

```svelte
<!-- frontend/src/routes/(app)/crm/customer/[id]/+page.svelte -->
<script lang="ts">
  import { browserClient } from '$lib/api/client';
  import { toast } from '$lib/stores/toast';

  let { data } = $props();
  let customer = $state(data.customer);
  let addresses = $state(data.addresses);
  let contacts = $state(data.contacts);

  // 基本情報編集モーダル
  const editModalId = 'edit_modal';
  let editForm = $state({ ...customer });

  function openEditModal() {
    const modal = document.getElementById(editModalId) as HTMLDialogElement;
    modal?.showModal();
  }

  function closeEditModal() {
    const modal = document.getElementById(editModalId) as HTMLDialogElement;
    modal?.close();
  }

  async function handleUpdateCustomer() {
    const client = browserClient();
    await client.crm.updateCustomer({
      id: customer.id,
      name: editForm.name,
      email: editForm.email,
    });

    customer = { ...customer, ...editForm };
    closeEditModal();
    toast.success('顧客情報を更新しました');
  }
</script>

<!-- パンくずリスト -->
<div class="text-sm breadcrumbs mb-4">
  <ul>
    <li><a href="/">ホーム</a></li>
    <li><a href="/crm/customer">顧客一覧</a></li>
    <li>{customer.name}</li>
  </ul>
</div>

<!-- ヘッダー -->
<div class="flex items-center justify-between mb-6">
  <h1 class="text-2xl font-bold">{customer.name}</h1>
  <button class="btn btn-primary" onclick={openEditModal}>
    編集
  </button>
</div>

<!-- 基本情報カード -->
<div class="card bg-base-100 shadow-xl mb-4">
  <div class="card-body">
    <h2 class="card-title">基本情報</h2>
    <div class="grid grid-cols-2 gap-4">
      <div>
        <p class="text-sm text-base-content/70">顧客名</p>
        <p class="font-medium">{customer.name}</p>
      </div>
      <div>
        <p class="text-sm text-base-content/70">メールアドレス</p>
        <p class="font-medium">{customer.email}</p>
      </div>
    </div>
  </div>
</div>

<!-- 住所カード -->
<div class="card bg-base-100 shadow-xl mb-4">
  <div class="card-body">
    <h2 class="card-title">住所</h2>

    {#each addresses as address}
      <div class="border-l-4 border-primary pl-4">
        <p class="font-medium">{address.label}</p>
        <p class="text-sm">{address.fullAddress}</p>
      </div>
    {/each}
  </div>
</div>

<!-- 連絡先カード -->
<div class="card bg-base-100 shadow-xl">
  <div class="card-body">
    <h2 class="card-title">連絡先</h2>

    {#each contacts as contact}
      <div>
        <p class="font-medium">{contact.type}</p>
        <p class="text-sm">{contact.value}</p>
      </div>
    {/each}
  </div>
</div>

<!-- 基本情報編集モーダル -->
<dialog id={editModalId} class="modal">
  <div class="modal-box max-w-lg">
    <h3 class="text-lg font-bold">基本情報を編集</h3>

    <form onsubmit|preventDefault={handleUpdateCustomer} class="mt-4 space-y-4">
      <label class="form-control">
        <span class="label-text">顧客名</span>
        <input
          type="text"
          bind:value={editForm.name}
          class="input input-bordered"
          required
        />
      </label>

      <label class="form-control">
        <span class="label-text">メールアドレス</span>
        <input
          type="email"
          bind:value={editForm.email}
          class="input input-bordered"
          required
        />
      </label>

      <div class="modal-action">
        <button
          type="button"
          class="btn"
          onclick={closeEditModal}
        >
          キャンセル
        </button>
        <button type="submit" class="btn btn-primary">保存</button>
      </div>
    </form>
  </div>

  <form method="dialog" class="modal-backdrop">
    <button>close</button>
  </form>
</dialog>
```

---

## パターン3: ダッシュボード（統計カード + チャート）

```svelte
<!-- frontend/src/routes/(app)/dashboard/+page.svelte -->
<script lang="ts">
  let { data } = $props();
  let stats = $state(data.stats);
</script>

<h1 class="text-2xl font-bold mb-6">ダッシュボード</h1>

<!-- 統計カード -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
  <!-- 総顧客数 -->
  <div class="card bg-base-100 shadow-xl">
    <div class="card-body">
      <h2 class="card-title text-sm text-base-content/70">総顧客数</h2>
      <p class="text-3xl font-bold">{stats.totalCustomers.toLocaleString()}</p>
      <div class="badge badge-success">+12% 前月比</div>
    </div>
  </div>

  <!-- 今月の売上 -->
  <div class="card bg-base-100 shadow-xl">
    <div class="card-body">
      <h2 class="card-title text-sm text-base-content/70">今月の売上</h2>
      <p class="text-3xl font-bold">¥{stats.monthlySales.toLocaleString()}</p>
      <div class="badge badge-success">+8% 前月比</div>
    </div>
  </div>

  <!-- 注文件数 -->
  <div class="card bg-base-100 shadow-xl">
    <div class="card-body">
      <h2 class="card-title text-sm text-base-content/70">注文件数</h2>
      <p class="text-3xl font-bold">{stats.totalOrders.toLocaleString()}</p>
      <div class="badge badge-error">-3% 前月比</div>
    </div>
  </div>

  <!-- 平均注文額 -->
  <div class="card bg-base-100 shadow-xl">
    <div class="card-body">
      <h2 class="card-title text-sm text-base-content/70">平均注文額</h2>
      <p class="text-3xl font-bold">¥{stats.avgOrderValue.toLocaleString()}</p>
      <div class="badge badge-success">+5% 前月比</div>
    </div>
  </div>
</div>

<!-- チャート -->
<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
  <div class="card bg-base-100 shadow-xl">
    <div class="card-body">
      <h2 class="card-title">月次売上推移</h2>
      <!-- Chart.js or recharts -->
    </div>
  </div>

  <div class="card bg-base-100 shadow-xl">
    <div class="card-body">
      <h2 class="card-title">顧客セグメント</h2>
      <!-- Pie chart -->
    </div>
  </div>
</div>
```

---

## パターン4: フィルター付き一覧

```svelte
<!-- frontend/src/routes/(app)/crm/customer/list/+page.svelte -->
<script lang="ts">
  import { browserClient } from '$lib/api/client';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';

  let { data } = $props();
  let customers = $state(data.customers);

  // フィルター状態
  let filters = $state({
    search: $page.url.searchParams.get('search') || '',
    segment: $page.url.searchParams.get('segment') || '',
    tag: $page.url.searchParams.get('tag') || '',
  });

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  async function applyFilters() {
    // URL更新
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.segment) params.set('segment', filters.segment);
    if (filters.tag) params.set('tag', filters.tag);

    goto(`?${params.toString()}`, { keepFocus: true });

    // API呼び出し
    const client = browserClient();
    const result = await client.crm.listCustomers(filters);
    customers = result.customers;
  }

  function handleSearchChange() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => applyFilters(), 500);
  }

  $effect(() => {
    handleSearchChange();
  });
</script>

<!-- フィルターカード -->
<div class="card bg-base-100 shadow-xl mb-4">
  <div class="card-body">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <!-- 検索 -->
      <label class="form-control">
        <span class="label-text">検索</span>
        <input
          type="text"
          bind:value={filters.search}
          placeholder="顧客名、メールアドレス..."
          class="input input-bordered"
        />
      </label>

      <!-- セグメント -->
      <label class="form-control">
        <span class="label-text">セグメント</span>
        <select bind:value={filters.segment} class="select select-bordered">
          <option value="">すべて</option>
          <option value="vip">VIP</option>
          <option value="regular">通常</option>
          <option value="new">新規</option>
        </select>
      </label>

      <!-- タグ -->
      <label class="form-control">
        <span class="label-text">タグ</span>
        <select bind:value={filters.tag} class="select select-bordered">
          <option value="">すべて</option>
          <option value="active">アクティブ</option>
          <option value="inactive">非アクティブ</option>
        </select>
      </label>
    </div>
  </div>
</div>

<!-- 顧客一覧テーブル -->
<div class="card bg-base-100 shadow-xl">
  <div class="card-body">
    <table class="table">
      <!-- ... -->
    </table>
  </div>
</div>
```

---

## パターン5: タブ切り替え

```svelte
<!-- frontend/src/routes/(app)/crm/customer/[id]/+page.svelte -->
<script lang="ts">
  let activeTab = $state<'info' | 'orders' | 'notes'>('info');

  let { data } = $props();
  let customer = $state(data.customer);
  let orders = $state(data.orders);
  let notes = $state(data.notes);
</script>

<!-- タブメニュー -->
<div class="tabs tabs-boxed mb-4">
  <button
    class="tab"
    class:tab-active={activeTab === 'info'}
    onclick={() => (activeTab = 'info')}
  >
    基本情報
  </button>
  <button
    class="tab"
    class:tab-active={activeTab === 'orders'}
    onclick={() => (activeTab = 'orders')}
  >
    注文履歴
  </button>
  <button
    class="tab"
    class:tab-active={activeTab === 'notes'}
    onclick={() => (activeTab = 'notes')}
  >
    メモ
  </button>
</div>

<!-- タブコンテンツ -->
<div class="card bg-base-100 shadow-xl">
  <div class="card-body">
    {#if activeTab === 'info'}
      <!-- 基本情報 -->
      <h2 class="card-title">基本情報</h2>
      <p>顧客名: {customer.name}</p>
      <p>メール: {customer.email}</p>
    {:else if activeTab === 'orders'}
      <!-- 注文履歴 -->
      <h2 class="card-title">注文履歴</h2>
      <table class="table">
        <thead>
          <tr>
            <th>注文日</th>
            <th>金額</th>
            <th>ステータス</th>
          </tr>
        </thead>
        <tbody>
          {#each orders as order}
            <tr>
              <td>{new Date(order.createdAt).toLocaleDateString()}</td>
              <td>¥{order.total.toLocaleString()}</td>
              <td>
                <span class="badge badge-success">{order.status}</span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else if activeTab === 'notes'}
      <!-- メモ -->
      <h2 class="card-title">メモ</h2>
      {#each notes as note}
        <div class="border-l-4 border-primary pl-4 mb-2">
          <p class="text-sm text-base-content/70">
            {new Date(note.createdAt).toLocaleString()}
          </p>
          <p>{note.content}</p>
        </div>
      {/each}
    {/if}
  </div>
</div>
```

---

## パターン6: ドラッグ&ドロップ（Kanban Board）

```svelte
<!-- frontend/src/routes/(app)/kanban/+page.svelte -->
<script lang="ts">
  import { dndzone } from 'svelte-dnd-action';

  let columns = $state([
    { id: 'todo', title: 'To Do', items: [...] },
    { id: 'in-progress', title: 'In Progress', items: [...] },
    { id: 'done', title: 'Done', items: [...] },
  ]);

  function handleDrop(columnId: string, event: any) {
    const column = columns.find((c) => c.id === columnId);
    if (column) {
      column.items = event.detail.items;
    }
  }
</script>

<div class="grid grid-cols-3 gap-4">
  {#each columns as column}
    <div class="card bg-base-100 shadow-xl">
      <div class="card-body">
        <h2 class="card-title">{column.title}</h2>

        <div
          use:dndzone={{ items: column.items }}
          on:consider={(e) => handleDrop(column.id, e)}
          on:finalize={(e) => handleDrop(column.id, e)}
        >
          {#each column.items as item (item.id)}
            <div class="card bg-base-200 mb-2">
              <div class="card-body p-4">
                <p class="font-medium">{item.title}</p>
                <p class="text-sm text-base-content/70">{item.description}</p>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/each}
</div>
```

---

## Related Patterns

- **header-pattern.md**: ヘッダーコンポーネント
- **sidebar-pattern.md**: サイドバーコンポーネント
- **toast-pattern.md**: トースト通知
- **modal-pattern.md**: モーダルダイアログ
- **foundation-api**: API呼び出しパターン
