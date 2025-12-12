# Frontend-Admin 開発ルール - dashboard-accelerator

**最終更新**: 2025-12-12

---

## このドキュメントについて

このドキュメントは **管理画面 Frontend 開発者向けの開発ルールとワークフロー** をまとめたものです。

### 📖 ドキュメント体系

- **[CLAUDE.md](../CLAUDE.md)**: プロジェクト全体の開発ルール、禁止事項、技術スタック
- **[ACCELERATOR.md](../ACCELERATOR.md)**: テンプレートが提供する機能の説明、アーキテクチャ、設計原則
- **[backend/CLAUDE.md](../backend/CLAUDE.md)**: Backend開発ルール
- **frontend-admin/CLAUDE.md（本ドキュメント）**: 管理画面Frontend開発ルール
- **[docs/FRONTEND_SEPARATION_PLAN.md](../docs/FRONTEND_SEPARATION_PLAN.md)**: Frontend分離計画

### 🎯 本ドキュメントの役割

**管理画面Frontend固有の開発ルールとワークフローのみを記載します。**

- ✅ Frontend技術スタック
- ✅ Frontend固有の開発ルール
- ✅ Frontend開発ワークフロー
- ❌ 機能の説明（→ ACCELERATOR.md を参照）
- ❌ プロジェクト全体の禁止事項（→ CLAUDE.md を参照）

### 📦 共通パッケージの利用

共通のエラーハンドリング、認証ヘルパー、型定義は `@dat-attendance/shared` パッケージから提供されます：

```typescript
// エラーハンドリング
import { transformApiError, UIError } from '@dat-attendance/shared/errors'

// 認証ヘルパー
import { withAutoRefresh, TokenSet } from '@dat-attendance/shared/auth'

// ストア
import { setError, clearError } from '@dat-attendance/shared/stores'
```

---

## 🎯 Frontend技術スタック

### コアテクノロジー

| 技術 | バージョン | 用途 |
|------|-----------|------|
| **SvelteKit** | v2.47.1 | フルスタックフレームワーク（SSR, Routing, API） |
| **Svelte** | 5.41.0 | リアクティブUIフレームワーク（**Runes** 構文） |
| **DaisyUI** | v5.4.3 | UIコンポーネントライブラリ |
| **Tailwind CSS** | v4.1.14 | ユーティリティファーストCSSフレームワーク |
| **Sentry** | v8.55.0 | エラー監視・ログ収集 |
| **TypeScript** | 5.x | 型安全な開発 |

### ディレクトリ構造

```
frontend-admin/
├── src/
│   ├── lib/                    # ライブラリ（共通機能）
│   │   ├── api/                # API通信（client.ts, generated.ts）
│   │   ├── components/         # 共通UIコンポーネント
│   │   ├── errors/             # エラー型定義・ハンドリング（shared から再エクスポート）
│   │   ├── notifications/      # 通知システムクライアント
│   │   ├── stores/             # Svelte Stores（状態管理）
│   │   └── monitoring/         # Sentry設定
│   ├── routes/                 # ページルート（SvelteKit routing）
│   │   ├── (authenticated)/   # 認証必須ルート
│   │   ├── (public)/          # 公開ルート
│   │   └── +layout.svelte     # ルートレイアウト
│   └── app.html               # HTMLテンプレート
├── static/                    # 静的ファイル
├── tests/                     # テスト（Playwright）
└── package.json              # 依存関係
```

---

## 📐 Frontend固有の開発ルール

### 1. ESLint + svelte-check 設定

#### 役割分担

| ツール | 役割 | 機能 |
|--------|------|------|
| **ESLint** | コードスタイル、構文チェック | **type-aware ルール**（型情報を活用）、auto-fix 対応 |
| **svelte-check** | TypeScript 型チェック | Svelte 固有の検証 |

#### 設定ファイル

- **ESLint Flat Config** (`eslint.config.js`) を使用
- `@antfu/eslint-config` を使用（Prettier 不要）

#### 設定方針

**TypeScript: `recommended-type-checked`（type-aware 有効）**

- **`.ts` ファイル**: 全ての type-aware ルールを適用（warning で開始）
- **`.svelte` ファイル**: 互換性のないルール（unsafe-* 系）のみ無効化、async/await 関連は有効
- **設定ファイル**: 全ての type-aware ルールを無効化

**スタイル:**
- タブインデント
- シングルクォート
- セミコロン不要

**段階的修正:**
- 既存エラーと新規 type-aware ルールは warning から開始

#### 利用可能なコマンド

```bash
pnpm run lint        # ESLint チェック（キャッシュ付き）
pnpm run lint:fix    # 自動修正
pnpm run check       # svelte-check で型チェック
pnpm run validate    # check + lint を実行
pnpm run ci          # validate + build を実行
```

#### Pre-commit hooks

- **husky + lint-staged** により、コミット時に自動で lint 実行
- ステージされたファイルのみチェック（高速化）
- 設定: `.lintstagedrc.json` で `*.{ts,tsx,js,jsx,svelte}` に `eslint --fix` を適用

#### 絶対に守るべきルール

**禁止される行為:**
- ❌ ESLint のルール設定そのものを変更
- ❌ `eslint-disable-next-line` の使用
- ❌ エラーやワーニングを無視する修正

**必須の対応:**
- ✅ 確実に修正を行う
- ✅ 最初にルールを理解して開発する
- ✅ 他の機能がどのように実装されているか参考にし適切に修正
- ✅ 修正は機能を破壊しないように細心の注意を払う
- ✅ 影響が出る可能性がある場合はユーザーに相談

---

### 2. Svelte 5 Runes 使用パターン

**Svelte 5では新しいリアクティビティシステム「Runes」を使用します。**

#### 基本的なRunes

| Rune | 用途 | 例 |
|------|------|-----|
| **$state** | リアクティブな状態管理 | `let count = $state(0);` |
| **$derived** | 派生値（computed） | `let doubled = $derived(count * 2);` |
| **$effect** | 副作用（watch, lifecycle） | `$effect(() => { console.log(count); });` |
| **$props** | コンポーネントプロパティ | `let { title } = $props();` |
| **$bindable** | 双方向バインディング | `let { value = $bindable() } = $props();` |

#### 使用例

```svelte
<script lang="ts">
  // リアクティブな状態
  let count = $state(0);

  // 派生値
  let doubled = $derived(count * 2);

  // 副作用（カウントが変わるたびに実行）
  $effect(() => {
    console.log(`Count is now: ${count}`);
  });

  // プロパティ
  let { title, onSubmit } = $props<{
    title: string;
    onSubmit: () => void;
  }>();
</script>

<button on:click={() => count++}>
  {title}: {count} (doubled: {doubled})
</button>
```

**重要:**
- ❌ 古い構文（`$:` や `export let`）は使用しない
- ✅ Svelte 5 Runes構文を使用する
- ✅ 不明点は **Svelte MCP** で最新仕様を確認

---

### 3. DaisyUI + Tailwind CSS v4 使用ルール

#### DaisyUI コンポーネント

DaisyUI v5.4.3 は Tailwind CSS ベースのコンポーネントライブラリです。

**基本的な使い方:**
```svelte
<!-- ボタン -->
<button class="btn btn-primary">Primary Button</button>

<!-- カード -->
<div class="card bg-base-100 shadow-xl">
  <div class="card-body">
    <h2 class="card-title">Card Title</h2>
    <p>Card content</p>
  </div>
</div>

<!-- モーダル -->
<dialog class="modal">
  <div class="modal-box">
    <h3 class="font-bold text-lg">Modal Title</h3>
    <p>Modal content</p>
  </div>
</dialog>
```

**利用可能なテーマ:**
- light, dark, cupcake, bumblebee, emerald, corporate, synthwave, retro等
- 設定: `tailwind.config.js` の `daisyui.themes`

#### Tailwind CSS v4

**重要な制約:**
- ❌ **Tailwind CSS v4 を v3 に切り替えてはいけない**
- ✅ Tailwind CSS v4 の仕様に従う
- ✅ 不明点は **Context7 MCP** で最新ドキュメントを確認

**基本的な使い方:**
```svelte
<!-- ユーティリティクラス -->
<div class="flex items-center justify-between p-4 bg-base-100">
  <span class="text-lg font-bold">Title</span>
  <button class="btn btn-sm">Action</button>
</div>
```

---

### 4. Colocation原則（コロケーション）

**Colocation原則**: コンポーネントと関連ファイルを同じディレクトリに配置する設計原則。

#### 原則

- ✅ コンポーネントと関連するファイル（型定義、ヘルパー関数、スタイル等）を同じディレクトリに配置
- ✅ 機能ごとにディレクトリを分割
- ✅ 関連性の高いコードを近くに配置

#### 例

```
src/lib/components/user-profile/
├── UserProfile.svelte        # メインコンポーネント
├── UserAvatar.svelte         # 子コンポーネント
├── user-profile.types.ts     # 型定義
├── user-profile.utils.ts     # ヘルパー関数
└── index.ts                  # エクスポート
```

**使用例:**
```typescript
// index.ts
export { default as UserProfile } from './UserProfile.svelte';
export { default as UserAvatar } from './UserAvatar.svelte';
export * from './user-profile.types';
export * from './user-profile.utils';
```

```svelte
<!-- 他のコンポーネントから使用 -->
<script lang="ts">
  import { UserProfile } from '$lib/components/user-profile';
</script>

<UserProfile userId="123" />
```

---

## 🔄 Frontend開発ワークフロー

### 日常的な開発フロー

```
Step 1: コード修正
   ↓
Step 2: pnpm run lint:fix - 自動修正可能な問題を修正
   ↓
Step 3: pnpm run check - 型チェック実行
   ↓
Step 4: pnpm run lint - 最終チェック
   ↓
Step 5: Playwright MCP で動作確認（UI作成時）
   ↓
Step 6: エラーがなければコミット（pre-commit hooks 自動実行）
```

### UI作成時の動作確認（必須）

**Playwright MCP を使用した動作確認:**

UI を作成した際は、必ず **Playwright MCP** でブラウザでの動作確認を行ってください。

```
1. UI コンポーネントを実装
   ↓
2. pnpm run lint:fix で修正
   ↓
3. pnpm run check で型チェック
   ↓
4. Playwright MCP で動作確認
   - ブラウザ自動化
   - UI の表示確認
   - インタラクション確認
   ↓
5. 問題なければコミット
```

### サーバー起動について

- **Frontend (SvelteKit/Vite)** は既に **ホットリロードで起動済み**
- 再起動の必要はない
- どうしても再起動が必要な場合はユーザーに依頼

---

## 💡 Frontend実装パターン

### API呼び出しパターン

**SSRでのAPI呼び出し:**
```typescript
// +page.server.ts
import type { PageServerLoad } from './$types';
import { serverClient } from '$lib/api/client';

export const load = (async ({ cookies }) => {
  const client = serverClient(cookies);
  const users = await client.app.list_users();
  return { users };
}) satisfies PageServerLoad;
```

**ブラウザでのAPI呼び出し (Svelte 5 Runes):**
```svelte
<script lang="ts">
  import { browserClient } from '$lib/api/client';

  let name = $state('');
  let loading = $state(false);

  async function handleSubmit() {
    loading = true;
    const client = browserClient();
    await client.app.create_user({ name, email: `${name}@example.com` });
    name = '';
    loading = false;
  }
</script>
```

**詳細**: [ACCELERATOR.md](../ACCELERATOR.md) の「API通信システム実装ガイド」セクションを参照

### コンポーネント実装パターン

**Svelte 5 Runes基本パターン:**
```svelte
<script lang="ts">
  // リアクティブな状態
  let count = $state(0);

  // 派生値
  let doubled = $derived(count * 2);

  // 副作用
  $effect(() => {
    console.log(`Count: ${count}`);
  });

  // プロパティ
  let { title, onSubmit } = $props<{
    title: string;
    onSubmit: () => void;
  }>();
</script>

<div class="card bg-base-100 shadow-xl">
  <div class="card-body">
    <h2 class="card-title">{title}</h2>
    <p>Count: {count} (doubled: {doubled})</p>
    <button class="btn btn-primary" onclick={() => count++}>
      Increment
    </button>
  </div>
</div>
```

**詳細**: [ACCELERATOR.md](../ACCELERATOR.md) の「UIコンポーネント実装ガイド」セクションを参照

### エラー処理パターン

**自動エラー処理（withErrorHandling内蔵）:**
```typescript
// API呼び出しは自動的にエラーハンドリングされる
// - 401エラー → /login リダイレクト
// - 400/404エラー → エラートースト表示
// - 500エラー → エラートースト表示 + Sentry送信
const client = browserClient();
await client.app.create_resource({ name: 'test' });
```

**手動エラー処理:**
```typescript
import { transformAPIError } from '$lib/errors/transformer';
import { setError } from '$lib/stores/error';

try {
  const client = browserClient();
  await client.app.create_resource({ name: 'test' });
} catch (err) {
  const uiError = transformAPIError(err);
  setError(uiError);
  console.error(uiError.message);
}
```

**詳細**: [ACCELERATOR.md](../ACCELERATOR.md) の「エラーハンドリング実装ガイド」セクションを参照

### 通知表示パターン

**リアルタイム通知受信:**
```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { notificationCenter } from '$lib/notifications/store';

  // SSE接続
  onMount(() => {
    notificationCenter.connect();
    return () => notificationCenter.disconnect();
  });

  // リアクティブな未読数
  let unreadCount = $derived(notificationCenter.unreadCount);
</script>

<div class="indicator">
  <span class="indicator-item badge badge-primary">{unreadCount}</span>
  <button class="btn">Notifications</button>
</div>
```

**詳細**: [ACCELERATOR.md](../ACCELERATOR.md) の「通知システム実装ガイド」セクションを参照

---

## 📖 参照ドキュメント

- **[CLAUDE.md](../CLAUDE.md)**: プロジェクト全体の開発ルール、CRITICAL RULES、技術スタック
- **[ACCELERATOR.md](../ACCELERATOR.md)**: テンプレートが提供する全機能の説明（API通信、UIコンポーネント、エラーハンドリング等）、実装パターン

---

## 🎯 Frontend開発チェックリスト

実装開始前に以下を確認してください：

```checklist
□ CLAUDE.md の CRITICAL RULES を確認した
□ ACCELERATOR.md で既存機能を確認した
□ ACCELERATOR.md で実装パターンを確認した
□ 既存の実装パターンを理解した
□ Svelte 5 Runes構文を理解した（$state, $derived, $effect）
□ DaisyUI + Tailwind CSS v4 の使用方法を理解した
□ ESLint + svelte-check の設定を理解した
□ Colocation原則を理解した
□ Frontend開発ワークフロー（lint:fix → check → lint → Playwright確認）を理解した
□ UI作成時はPlaywright MCPで動作確認することを理解した
```

---

## まとめ

**Frontend開発の核心原則:**

1. **Svelte 5 Runes構文を使用**
   - $state, $derived, $effect, $props, $bindable
   - 古い構文（`$:`, `export let`）は使用しない

2. **ESLint + svelte-check 厳守**
   - `eslint-disable` は禁止
   - エラー・ワーニングは必ず修正
   - pre-commit hooks で自動チェック

3. **DaisyUI + Tailwind CSS v4**
   - Tailwind v4 を v3 に切り替えない
   - DaisyUI コンポーネントを活用

4. **Colocation原則の適用**
   - コンポーネントと関連ファイルを同じディレクトリに配置
   - 機能ごとにディレクトリを分割

5. **UI作成時のPlaywright確認必須**
   - ブラウザでの動作確認
   - インタラクション確認

6. **既存機能の最大限活用**
   - ACCELERATOR.md で確認 → 既存実装参照 → 再利用

**疑問や不明点がある場合:**
- [CLAUDE.md](../CLAUDE.md) の CRITICAL RULES を確認
- [ACCELERATOR.md](../ACCELERATOR.md) で機能説明と実装パターンを確認
- **Svelte MCP** で Svelte 5 の最新仕様を確認
- **Context7 MCP** でライブラリのベストプラクティスを調査
- **Serena MCP** でコードベースの既存実装を検索
- **Playwright MCP** でブラウザ動作確認

---

**最終更新**: 2025-11-13
