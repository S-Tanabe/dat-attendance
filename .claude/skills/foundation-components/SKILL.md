---
name: foundation-components
description: |
  dashboard-acceleratorテンプレートが提供するUIコンポーネント体系。
  Header、Sidebar、Toast、Modal、Error Display などの基本コンポーネントを提供。

  【WHEN to use】
  - UI実装時
  - 既存コンポーネントの使い方を確認する時
  - レイアウト構築時

  【TRIGGER keywords】
  UI、コンポーネント、Header、Sidebar、Toast、Modal、レイアウト、DaisyUI
allowed-tools: Read, Grep
---

# Template Components: UIコンポーネント体系

## Overview

**実装パス**: `frontend/src/lib/components/`

### Provided Components

dashboard-acceleratorテンプレートは、以下のUIコンポーネントを提供しています:

- **Header**: グローバルヘッダー（ユーザーメニュー、通知アイコン）
- **Sidebar**: サイドバーナビゲーション（グループ化、ホバー展開機能）
- **Toast**: トースト通知システム
- **Error Display**: エラー表示コンポーネント（ErrorBoundary, ErrorToast）
- **Theme Switcher**: ダークモード切り替え
- **Role Select**: ロール選択UI

---

## Quick Reference

### 1. Header

**詳細**: `references/header-pattern.md`

```svelte
<!-- routes/(app)/+layout.svelte -->
<script>
  import Header from '$lib/components/Header.svelte';
</script>

<Header />
```

---

### 2. Sidebar

**詳細**: `references/sidebar-pattern.md`

```svelte
<!-- routes/(app)/+layout.svelte -->
<script>
  import { Sidebar } from '$lib/components/sidebar';
</script>

<Sidebar />
```

---

### 3. Toast

**詳細**: `references/toast-pattern.md`

```svelte
<!-- routes/(app)/+layout.svelte -->
<script>
  import ToastHost from '$lib/components/ToastHost.svelte';
</script>

<ToastHost />
```

```typescript
// 使用例
import { toast } from '$lib/stores/toast';

toast.success('保存しました');
toast.error('エラーが発生しました');
toast.info('処理を開始しました');
```

---

### 4. Modal

**詳細**: `references/modal-pattern.md`

**注意**: テンプレートにはカスタムModalコンポーネントは含まれていません。DaisyUI標準の `<dialog>` 要素を使用してください。

```svelte
<!-- DaisyUI標準のモーダル -->
<script lang="ts">
  function openModal() {
    const modal = document.getElementById('my_modal') as HTMLDialogElement;
    modal?.showModal();
  }
</script>

<button onclick={openModal}>開く</button>

<dialog id="my_modal" class="modal">
  <div class="modal-box">
    <h3 class="text-lg font-bold">確認</h3>
    <p>本当に削除しますか？</p>
    <div class="modal-action">
      <form method="dialog">
        <button class="btn">キャンセル</button>
      </form>
      <button class="btn btn-error" onclick={handleDelete}>削除</button>
    </div>
  </div>
</dialog>
```

---

## アーキテクチャ

### コンポーネント階層

```
App Layout (routes/(app)/+layout.svelte)
│
├─ Header (グローバルヘッダー)
│  ├─ ユーザーメニュー
│  └─ 通知アイコン
│
├─ Sidebar (ナビゲーション)
│  ├─ Menu Items
│  ├─ Collapse State
│  └─ Active Link Highlight
│
├─ Main Content Area
│  └─ Page Content (slot)
│
└─ Toast Container (トースト通知)
   └─ Toast Items (動的生成)
```

---

## DaisyUI Integration

全てのコンポーネントは **DaisyUI v5.4.3** をベースに構築されています。

### 主要なDaisyUIコンポーネント使用例

```svelte
<!-- Button -->
<button class="btn btn-primary">保存</button>

<!-- Card -->
<div class="card bg-base-100 shadow-xl">
  <div class="card-body">
    <h2 class="card-title">タイトル</h2>
    <p>コンテンツ</p>
  </div>
</div>

<!-- Modal (DaisyUI標準) -->
<dialog class="modal" id="my_modal">
  <div class="modal-box">
    <h3 class="text-lg font-bold">タイトル</h3>
    <p class="py-4">コンテンツ</p>
    <div class="modal-action">
      <form method="dialog">
        <button class="btn">閉じる</button>
      </form>
    </div>
  </div>
</dialog>
```

---

## Tailwind CSS v4 Integration

Tailwind CSS v4.1.14 を使用しており、カスタムスタイルも可能です。

```svelte
<div class="flex items-center gap-4 p-4 rounded-lg bg-base-200">
  <div class="w-12 h-12 rounded-full bg-primary"></div>
  <div class="flex-1">
    <h3 class="text-lg font-bold">タイトル</h3>
    <p class="text-sm text-base-content/70">説明文</p>
  </div>
</div>
```

---

## OpenSpec Integration

OpenSpecで新規UI実装時、テンプレートコンポーネントの使用を明記してください:

```markdown
## UI Implementation

### Layout
Uses: foundation-components Header + Sidebar
Reference: .claude/skills/foundation-components/

### Notifications
Uses: foundation-components Toast
Pattern: Auto-dismiss on success, manual dismiss on error

### Error Display
Uses: foundation-components ErrorDisplay
Integration: Automatic via error-handling-system
```

---

## Related Skills

- **foundation-api**: API通信後のトースト表示
- **foundation-error-handling**: エラー表示コンポーネントとの統合
- **frontend-sveltekit**: Svelte 5 Runes構文でのコンポーネント作成
- **foundation-notification**: リアルタイム通知との統合

---

## 制約

### ❌ 禁止事項

- DaisyUIクラスを直接上書きしない（カスタマイズはTailwindで）
- グローバルCSSで`!important`を使わない
- `<style>`タグでコンポーネント外のスタイルを変更しない

### ✅ 推奨事項

- DaisyUIの標準コンポーネントを優先使用
- カスタムコンポーネントはDaisyUIクラスをベースに拡張
- レスポンシブ対応は `sm:`, `md:`, `lg:` プレフィックスを使用
- ダークモード対応は自動（DaisyUIテーマ切り替え）

---

## Next Steps

各コンポーネントの詳細な実装パターンは、references/ 内のファイルを参照してください:

- `references/header-pattern.md` - Header コンポーネント詳細
- `references/sidebar-pattern.md` - Sidebar コンポーネント詳細
- `references/toast-pattern.md` - Toast システム詳細
- `references/modal-pattern.md` - Modal パターン詳細
- `examples/composition-patterns.md` - コンポーネント組み合わせ例
