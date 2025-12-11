# Header コンポーネントパターン

## 実装パス

`frontend/src/lib/components/Header.svelte`

---

## Overview

グローバルヘッダーコンポーネント。全ての認証済みページで表示されます。

### 提供機能

- ユーザー情報表示
- ユーザーメニュー（プロフィール、設定、ログアウト）
- 通知アイコン（未読件数バッジ）
- レスポンシブ対応（モバイルメニュー）

---

## 基本構造

```svelte
<!-- frontend/src/lib/components/Header.svelte -->
<script lang="ts">
  import type { users } from '$lib/generated/client';

  const props = $props<{ user: users.UserProfile | null, onLogout: () => void }>();

  // 通知件数は実際の実装ではnotificationCenterストアから取得
  // ここでは簡略化のため固定値
  const unreadCount = 0;
</script>

<header class="navbar bg-base-100 shadow-sm">
  <!-- Logo -->
  <div class="flex-1">
    <a href="/" class="btn btn-ghost text-xl">Kanuc Flow</a>
  </div>

  <!-- Actions -->
  <div class="flex-none gap-2">
    <!-- Notifications -->
    <button class="btn btn-ghost btn-circle">
      <div class="indicator">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {#if unreadCount > 0}
          <span class="badge badge-xs badge-primary indicator-item">
            {unreadCount}
          </span>
        {/if}
      </div>
    </button>

    <!-- User Menu -->
    <div class="dropdown dropdown-end">
      <button class="btn btn-ghost btn-circle avatar">
        <div class="w-10 rounded-full">
          <img
            alt="User avatar"
            src={props.user?.avatar_url || '/default-avatar.png'}
          />
        </div>
      </button>

      <ul class="menu menu-sm dropdown-content bg-base-100 rounded-box z-[1] mt-3 w-52 p-2 shadow">
        <li>
          <a href="/user-settings">設定</a>
        </li>
        <li><button onclick={props.onLogout}>ログアウト</button></li>
      </ul>
    </div>
  </div>
</header>
```

---

## レイアウト統合

```svelte
<!-- frontend/src/routes/(app)/+layout.svelte -->
<script lang="ts">
  import Header from '$lib/components/Header.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
</script>

<div class="drawer lg:drawer-open">
  <input id="sidebar-drawer" type="checkbox" class="drawer-toggle" />

  <div class="drawer-content flex flex-col">
    <!-- Header -->
    <Header />

    <!-- Page Content -->
    <main class="flex-1 p-6">
      <slot />
    </main>
  </div>

  <!-- Sidebar -->
  <div class="drawer-side">
    <label for="sidebar-drawer" class="drawer-overlay"></label>
    <Sidebar />
  </div>
</div>
```

---

## ユーザーメニュー詳細

### 1. プロフィールリンク

```svelte
<li>
  <a href="/profile" class="justify-between">
    プロフィール
    {#if $user.profileCompletePercent < 100}
      <span class="badge badge-warning">{$user.profileCompletePercent}%</span>
    {/if}
  </a>
</li>
```

### 2. 設定リンク

```svelte
<li><a href="/settings">設定</a></li>
```

### 3. ログアウトボタン

```svelte
<li>
  <button onclick={handleLogout}>
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
    ログアウト
  </button>
</li>
```

---

## 通知アイコン

### 未読件数バッジ

```svelte
<button class="btn btn-ghost btn-circle" onclick={() => goto('/notifications')}>
  <div class="indicator">
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>

    {#if $user.unreadNotifications > 0}
      <span class="badge badge-xs badge-primary indicator-item">
        {Math.min($user.unreadNotifications, 99)}
      </span>
    {/if}
  </div>
</button>
```

### リアルタイム更新

```typescript
// frontend/src/lib/stores/user.ts

import { writable } from 'svelte/store';

export const user = writable({
  id: '',
  name: '',
  email: '',
  avatarUrl: '',
  unreadNotifications: 0,
  role: 'user',
});

// SSE で通知を受信時に更新
export function incrementUnreadNotifications() {
  user.update((u) => ({
    ...u,
    unreadNotifications: u.unreadNotifications + 1,
  }));
}
```

---

## モバイル対応

### ハンバーガーメニュー

```svelte
<header class="navbar bg-base-100 shadow-sm">
  <!-- Mobile Menu Button (lg未満で表示) -->
  <div class="flex-none lg:hidden">
    <label for="sidebar-drawer" class="btn btn-square btn-ghost">
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </label>
  </div>

  <!-- Logo -->
  <div class="flex-1">
    <a href="/" class="btn btn-ghost text-xl">Kanuc Flow</a>
  </div>

  <!-- ... -->
</header>
```

---

## テーマ切り替え統合

```svelte
<script lang="ts">
  import { theme } from '$lib/stores/theme';

  function toggleTheme() {
    theme.update((t) => (t === 'light' ? 'dark' : 'light'));
  }
</script>

<header class="navbar bg-base-100 shadow-sm">
  <!-- ... -->

  <div class="flex-none gap-2">
    <!-- Theme Toggle -->
    <button class="btn btn-ghost btn-circle" onclick={toggleTheme}>
      {#if $theme === 'light'}
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      {:else}
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      {/if}
    </button>

    <!-- ... -->
  </div>
</header>
```

---

## ユーザー情報表示

**注意**: テンプレートにはRoleBadgeコンポーネントは含まれていません。ロール表示が必要な場合は、DaisyUIのbadgeクラスを使用してください。

```svelte
<script lang="ts">
  import type { users } from '$lib/generated/client';

  const props = $props<{ user: users.UserProfile | null }>();
</script>

<header class="navbar bg-base-100 shadow-sm">
  <!-- ... -->

  <div class="dropdown dropdown-end">
    <button class="btn btn-ghost gap-2">
      <div class="avatar">
        <div class="w-8 rounded-full">
          <img alt="User" src={props.user?.avatar_url || '/default-avatar.png'} />
        </div>
      </div>
      <div class="hidden md:flex flex-col items-start">
        <span class="text-sm font-medium">{props.user?.display_name || ''}</span>
        <!-- ロール表示例（必要に応じて実装） -->
        <!-- <span class="badge badge-sm">Admin</span> -->
      </div>
    </button>

    <!-- Dropdown Menu -->
    <!-- ... -->
  </div>
</header>
```

---

## カスタマイズ

### ロゴのカスタマイズ

```svelte
<!-- SVG Logo -->
<div class="flex-1">
  <a href="/" class="btn btn-ghost text-xl gap-2">
    <svg class="w-8 h-8" viewBox="0 0 24 24">
      <!-- Your Logo SVG -->
    </svg>
    <span class="hidden sm:inline">Kanuc Flow</span>
  </a>
</div>
```

### 検索バーの追加

```svelte
<header class="navbar bg-base-100 shadow-sm">
  <!-- Logo -->
  <div class="flex-1">
    <a href="/" class="btn btn-ghost text-xl">Kanuc Flow</a>
  </div>

  <!-- Search Bar (中央) -->
  <div class="flex-1 max-w-md hidden lg:flex">
    <input
      type="text"
      placeholder="検索..."
      class="input input-bordered w-full"
    />
  </div>

  <!-- Actions -->
  <div class="flex-none gap-2">
    <!-- ... -->
  </div>
</header>
```

---

## Troubleshooting

### 問題1: ドロップダウンが表示されない

**原因**: `z-index` が不足している

**対処**:
```svelte
<ul class="menu dropdown-content z-[1] ...">
  <!-- ... -->
</ul>
```

---

### 問題2: アバター画像が表示されない

**原因**: `avatarUrl` が空文字列

**対処**:
```svelte
<img
  alt="User avatar"
  src={$user.avatarUrl || '/default-avatar.png'}
  onerror="this.src='/default-avatar.png'"
/>
```

---

### 問題3: モバイルでメニューが開かない

**原因**: `drawer-toggle` の `id` と `label` の `for` が一致していない

**確認**:
```svelte
<!-- Drawer Input -->
<input id="sidebar-drawer" type="checkbox" class="drawer-toggle" />

<!-- Menu Button -->
<label for="sidebar-drawer" class="btn ...">
  <!-- ... -->
</label>
```

---

## Related Patterns

- **sidebar-pattern.md**: サイドバーとの連携
- **toast-pattern.md**: ログアウト時のトースト表示
- **foundation-notification**: リアルタイム通知連携
- **foundation-auth**: ログアウト処理
