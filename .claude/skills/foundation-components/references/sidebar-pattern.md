# Sidebar コンポーネントパターン

## 実装パス

```
frontend/src/lib/components/sidebar/
├── components/
│   ├── Sidebar.svelte
│   ├── SidebarItem.svelte
│   └── SidebarToggle.svelte
├── menu-config.ts
├── store.ts
├── types.ts
└── index.ts
```

---

## Overview

サイドバーナビゲーションコンポーネント。グループ化されたメニュー、ホバー展開、権限制御をサポートします。

### 提供機能

- グループ化されたメニュー構造
- 2つのモード（expanded / hover）
- ホバー時の自動展開
- 階層的メニュー（最大2階層）
- アクティブリンクのハイライト
- 権限による表示制御
- localStorage への状態保存
- バッジ表示

---

## 基本使用方法

### Sidebar コンポーネントの配置

```svelte
<!-- routes/(app)/+layout.svelte -->
<script lang="ts">
  import { Sidebar } from '$lib/components/sidebar';
  import type { LayoutData } from './$types';

  const { data }: { data: LayoutData } = $props();
</script>

<div class="flex h-screen">
  <Sidebar
    isDevelopment={data.isDevelopment}
    userRole={data.user?.role?.name}
  />

  <main class="flex-1 overflow-auto">
    <slot />
  </main>
</div>
```

---

## メニュー設定

### menu-config.ts でメニューを定義

```typescript
// frontend/src/lib/components/sidebar/menu-config.ts

export const menuItems: SidebarItem[] = [
  {
    id: 'dashboard',
    label: 'ダッシュボード',
    icon: 'home',
    href: '/dashboard',
    group: 'main',
    order: 50
  },
  {
    id: 'users_admin',
    label: 'ユーザー管理',
    icon: 'users',
    href: '/users',
    group: 'management',
    order: 400,
    requiredRole: 'admin',
    activeMatch: ['/users']
  }
];

// グループ定義
const baseGroups: SidebarGroup[] = [
  { id: 'main', label: 'メイン', order: 50 },
  { id: 'management', label: '管理', order: 200, requiredRole: 'admin' }
];
```

---

## 2つのモード

### 1. Expanded モード（デフォルト）

- サイドバーが常に展開（幅: 256px / w-64）
- ラベルが常に表示

### 2. Hover モード

- サイドバーが自動的に縮小（幅: 64px / w-16）
- アイコンのみ表示
- ホバー時に展開（幅: 256px / w-64）

### モード切り替え

```typescript
import { sidebarStore } from '$lib/components/sidebar/store';

// モードを切り替え
sidebarStore.toggleMode();

// モードを直接設定
sidebarStore.setMode('hover');
sidebarStore.setMode('expanded');
```

---

## 階層的メニュー

### 子メニューの定義

```typescript
export const menuItems: SidebarItem[] = [
  {
    id: 'dev_tools',
    label: 'セキュリティ',
    icon: 'spy',
    href: '/dev_tools',
    group: 'development',
    requiredRole: 'super_admin',
    children: [
      {
        id: 'dev_tools_sessions',
        label: 'セッション管理',
        icon: 'users',
        href: '/dev_tools/sessions',
        order: 511
      },
      {
        id: 'dev_tools_security_ip_trust',
        label: 'IPアドレス信頼度',
        icon: 'shieldCheck',
        href: '/dev_tools/security/ip-trust',
        order: 513
      }
    ]
  }
];
```

### 動作

- 親アイテムをクリックすると子メニューが展開/折りたたみ
- 子メニューがアクティブな場合、親メニューが自動展開
- 最大2階層まで対応（`depth < 2`）

---

## アクティブリンクのハイライト

### 完全一致

```typescript
{
  id: 'dashboard',
  href: '/dashboard',
  // /dashboard でのみアクティブ
}
```

### 前方一致（activeMatch）

```typescript
{
  id: 'users_admin',
  href: '/users',
  activeMatch: ['/users'],
  // /users, /users/123, /users/new などでアクティブ
}
```

### 複数パターンマッチ

```typescript
{
  id: 'dev_tools',
  href: '/dev_tools',
  activeMatch: ['/dev_tools', '/security'],
  // /dev_tools または /security で始まる場合アクティブ
}
```

---

## 権限による表示制御

### アイテムレベルの権限

```typescript
{
  id: 'users_admin',
  label: 'ユーザー管理',
  requiredRole: 'admin',
  // admin 以上のロールのみ表示
}
```

### グループレベルの権限

```typescript
const devGroup: SidebarGroup = {
  id: 'development',
  label: '開発',
  order: 500,
  requiredRole: 'super_admin'
  // super_admin のみこのグループを表示
};
```

### ロールレベル

```typescript
function getRoleLevel(role: string): number {
  switch (role) {
    case 'super_admin': return 1000;
    case 'admin': return 100;
    case 'user': return 10;
    default: return 0;
  }
}
```

---

## バッジ表示

```typescript
{
  id: 'notifications',
  label: '通知',
  icon: 'bell',
  href: '/notifications',
  badge: '3' // または数値: badge: 3
}
```

---

## アイコン

### 利用可能なアイコン

```typescript
// frontend/src/lib/components/sidebar/types.ts の IconPaths に定義

// 基本アイコン
'home', 'users', 'settings', 'chart', 'document', 'folder'

// UIコントロール
'chevronDown', 'chevronRight', 'bars3', 'xMark', 'plus', 'minus'

// 機能アイコン
'eye', 'eyeSlash', 'spy', 'shieldCheck', 'devicePhoneMobile', 'exclamation'

// 展開/縮小
'arrowsPointingOut', 'arrowsPointingIn'
```

### カスタムアイコンの追加

```typescript
// frontend/src/lib/components/sidebar/types.ts

export const IconPaths: Record<string, string> = {
  // ... 既存のアイコン
  myCustomIcon: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
};
```

---

## 状態管理

### sidebarStore の機能

```typescript
import { sidebarStore, sidebarMode, isExpanded, isHover } from '$lib/components/sidebar/store';

// 初期化（必須：Sidebar.svelte 内で自動実行）
sidebarStore.init();

// モード切り替え
sidebarStore.toggleMode();
sidebarStore.setMode('hover');

// アイテムの展開/折りたたみ
sidebarStore.toggleItem('dev_tools');
sidebarStore.expandItem('dev_tools');
sidebarStore.collapseItem('dev_tools');

// アクティブアイテムの設定
sidebarStore.setActiveItem('dashboard');

// 状態のリセット
sidebarStore.reset();
```

### localStorage への自動保存

- `mode`、`expandedItems`、`activeItemId` が自動的に保存
- ページリロード後も状態を復元
- ストレージキー: `sidebar_state`（デフォルト）

---

## カスタマイズ

### サイドバーの幅を変更

```svelte
<!-- Sidebar.svelte -->
<aside
  class='h-screen sticky top-0 bg-base-100 border-r border-base-300 flex flex-col {effectiveWidth}'
  style='transition: width 150ms ease-in-out;'
>
  <!-- ... -->
</aside>

<script>
  // 幅を変更する場合
  const effectiveWidth = $derived($isHover && !isHovered ? 'w-20' : 'w-80');
</script>
```

### ホバー遅延の調整

```typescript
// frontend/src/lib/components/sidebar/store.ts

const DEFAULT_CONFIG: Required<SidebarConfig> = {
  hoverDelay: 100, // 100ms → 300ms などに変更可能
  // ...
};
```

---

## 開発環境専用メニュー

```typescript
// menu-config.ts

export const devMenuItems: SidebarItem[] = [
  {
    id: 'dev_tools',
    label: 'セキュリティ',
    icon: 'spy',
    href: '/dev_tools',
    group: 'development',
    requiredRole: 'super_admin'
  }
];

export function getAllMenuItems(isDevelopment: boolean = false): SidebarItem[] {
  return isDevelopment ? [...menuItems, ...devMenuItems] : menuItems;
}
```

### 使用方法

```svelte
<Sidebar isDevelopment={true} userRole="super_admin" />
```

---

## Troubleshooting

### 問題1: メニューが表示されない

**原因**: `sidebarStore.init()` が呼ばれていない

**対処**: `Sidebar.svelte` 内の `onMount` で自動実行されるため、通常は不要。手動で呼ぶ場合は一度のみ。

---

### 問題2: 権限で非表示になったメニューがある

**原因**: `requiredRole` による権限制御

**確認**:
```typescript
console.log('User role:', userRole);
console.log('Required role level:', getRoleLevel('admin'));
console.log('User role level:', getRoleLevel(userRole));
```

---

### 問題3: ホバー展開がうまく動作しない

**原因**: `isHover` モードではないか、ホバー遅延が短すぎる

**対処**:
```typescript
// store.ts の hoverDelay を調整
hoverDelay: 300 // 100ms → 300ms
```

---

### 問題4: アクティブリンクがハイライトされない

**原因**: `activeMatch` または `href` が現在のパスと一致していない

**デバッグ**:
```typescript
// SidebarItem.svelte 内で確認
$effect(() => {
  console.log('Current path:', $page.url.pathname);
  console.log('Item href:', item.href);
  console.log('Is active:', isActive);
});
```

---

## Related Patterns

- **header-pattern.md**: ヘッダーとの連携（モバイルメニュー）
- **foundation-auth permission-pattern.md**: 権限による表示制御
- **toast-pattern.md**: ナビゲーション後のフィードバック表示
