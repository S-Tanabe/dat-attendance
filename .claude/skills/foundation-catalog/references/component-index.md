# Template Component Index（コンポーネント一覧表）

dashboard-acceleratorテンプレートが提供する全UIコンポーネントの詳細一覧。

---

## 📱 基本レイアウトコンポーネント

### Header.svelte

**実装パス**: `frontend/src/lib/components/Header.svelte`
**詳細スキル**: foundation-components

**提供機能**:
- ユーザーアイコン表示
- プロフィールドロップダウン
  - プロフィールページへのリンク
  - ログアウトボタン
- 通知バッジ（unreadCount表示）
- 通知ドロップダウン（フィルタ機能付き）

**使用方法**:
```svelte
<Header />
```

**依存**:
- `$lib/notifications/store.ts` (notificationCenter)
- `$lib/api/client.ts` (ログアウト処理)

---

### Sidebar.svelte

**実装パス**: `frontend/src/lib/components/sidebar/components/Sidebar.svelte`
**詳細スキル**: foundation-components

**提供機能**:
- 開閉式サイドバー
- ロール別メニュー表示
- ホバー時の自動展開
- メニュー項目アイコン表示

**使用方法**:
```svelte
<Sidebar />
```

**設定ファイル**: `sidebar/menu-config.ts`

**依存**:
- `sidebar/store.ts` (開閉状態管理)
- `sidebar/components/SidebarItem.svelte`
- `sidebar/components/SidebarToggle.svelte`

---

### SidebarItem.svelte

**実装パス**: `frontend/src/lib/components/sidebar/components/SidebarItem.svelte`
**詳細スキル**: foundation-components

**提供機能**:
- メニューアイテム表示
- アクティブ状態ハイライト
- アイコン + ラベル表示

**Props**:
```typescript
{
  href: string;
  label: string;
  icon?: string;
  activeRoutePattern?: RegExp;
}
```

**使用方法**:
```svelte
<SidebarItem
  href="/customers"
  label="顧客管理"
  icon="👥"
/>
```

---

### SidebarToggle.svelte

**実装パス**: `frontend/src/lib/components/sidebar/components/SidebarToggle.svelte`
**詳細スキル**: foundation-components

**提供機能**:
- サイドバー開閉ボタン
- 開閉アイコンアニメーション

**使用方法**:
```svelte
<SidebarToggle />
```

---

## 🔔 通知・フィードバックコンポーネント

### ToastHost.svelte

**実装パス**: `frontend/src/lib/components/ToastHost.svelte`
**詳細スキル**: foundation-components

**提供機能**:
- 一時通知（Toast）表示ホスト
- 自動消去タイマー
- 複数トースト管理

**使用方法**:
```svelte
<!-- +layout.svelte に配置 -->
<ToastHost />
```

**トリガー**:
```typescript
import { showToast } from '$lib/stores/toast';

showToast({
  message: '保存しました',
  type: 'success',
  duration: 3000
});
```

---

### ErrorToast.svelte

**実装パス**: `frontend/src/lib/components/ErrorToast.svelte`
**詳細スキル**: foundation-components
**関連**: foundation-error-handling

**提供機能**:
- エラー専用トースト表示
- エラーコード表示
- 詳細メッセージ表示

**使用方法**:
```svelte
<!-- +layout.svelte に配置 -->
<ErrorToast />
```

**自動トリガー**:
- API通信エラー時に自動表示（withErrorHandling()）
- グローバルエラー発生時に自動表示

---

### ErrorBoundary.svelte

**実装パス**: `frontend/src/lib/components/ErrorBoundary.svelte`
**詳細スキル**: foundation-components
**関連**: foundation-error-handling

**提供機能**:
- 子コンポーネントのエラーキャッチ
- フォールバックUI表示
- エラー詳細の Sentry 送信

**使用方法**:
```svelte
<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>
```

**Props**:
```typescript
{
  fallback?: Component; // カスタムフォールバックUI
}
```

---

## 🎨 UI要素コンポーネント

### ThemeSelector.svelte

**実装パス**: `frontend/src/lib/components/ThemeSelector.svelte`
**詳細スキル**: foundation-components

**提供機能**:
- DaisyUI テーマ切り替え
- テーマプレビュー
- localStorage への保存

**使用方法**:
```svelte
<ThemeSelector />
```

**対応テーマ**:
- light, dark, cupcake, bumblebee, emerald, corporate, synthwave, retro, cyberpunk, valentine, halloween, garden, forest, aqua, lofi, pastel, fantasy, wireframe, black, luxury, dracula, cmyk, autumn, business, acid, lemonade, night, coffee, winter

---

### RoleSelect.svelte

**実装パス**: `frontend/src/lib/components/RoleSelect.svelte`
**詳細スキル**: foundation-components

**提供機能**:
- ロール選択ドロップダウン
- ロール名の日本語表示

**使用方法**:
```svelte
<RoleSelect
  bind:value={selectedRole}
  roles={['admin', 'user', 'viewer']}
/>
```

**Props**:
```typescript
{
  value: string; // 選択されたロール
  roles: string[]; // 選択可能なロール一覧
  onChange?: (role: string) => void;
}
```

---

## 📂 ディレクトリ構造

```
frontend/src/lib/components/
├── Header.svelte                # ヘッダー
├── ErrorBoundary.svelte         # エラーバウンダリ
├── ErrorToast.svelte            # エラートースト
├── RoleSelect.svelte            # ロール選択
├── ThemeSelector.svelte         # テーマセレクター
├── ToastHost.svelte             # トーストホスト
│
└── sidebar/                     # サイドバー関連
    ├── components/
    │   ├── Sidebar.svelte
    │   ├── SidebarItem.svelte
    │   └── SidebarToggle.svelte
    ├── menu-config.ts           # メニュー設定
    ├── store.ts                 # 開閉状態管理
    ├── types.ts                 # 型定義
    └── index.ts                 # エクスポート
```

---

## 使用方法

### 基本レイアウトの構築

```svelte
<!-- routes/(app)/+layout.svelte -->
<script>
  import Header from '$lib/components/Header.svelte';
  import { Sidebar } from '$lib/components/sidebar';
  import ToastHost from '$lib/components/ToastHost.svelte';
  import ErrorToast from '$lib/components/ErrorToast.svelte';
</script>

<div class="app-container">
  <Header />
  <div class="main-content">
    <Sidebar />
    <main>
      <slot />
    </main>
  </div>
</div>

<ToastHost />
<ErrorToast />
```

---

## 制約

### Colocation原則

- **ページ専用コンポーネント**: ページと同階層の `components/` に配置
- **共通コンポーネント**: 3箇所以上で使う場合のみ `lib/components/` に配置

### 命名規則

- **PascalCase.svelte**: すべてのコンポーネント
- **camelCase.ts**: ユーティリティファイル

### Props型定義

- すべてのProps は TypeScript で型定義
- `$$Props` インターフェースを使用（Svelte 5）

---

## 関連ドキュメント

- **機能一覧**: `feature-index.md`
- **foundation-components SKILL**: 詳細な使用パターン
- **OpenSpec プロジェクトコンテキスト**: `../../../openspec/project.md`
