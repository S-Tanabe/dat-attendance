# <機能名> strategy/templates/PLAN-FORMAT.md

## 目標

**機能ゴール**: [要求から導出された具体的な目標]

**成果物**:

- 

**成功の定義**:

- [ ] すべての基本機能が動作
- [ ] サイドバーナビゲーションが機能
- [ ] 認証フローが完成
- [ ] レスポンシブデザインが機能
- [ ] DaisyUIテーマが適用

## ユーザーペルソナ

**対象ユーザー**: [管理者、オペレーター、など]

**ユースケース**: [日常的な管理業務のフロー]

**ユーザージャーニー**: [ログインから主要タスク完了まで]

**解消するペインポイント**: [既存システムの課題]

## なぜ

[ビジネス価値と既存システムとの関係]

## 何を作るか

[ユーザー視点での機能と技術要件]

### 成功基準

- [ ] [具体的で測定可能な成果]

## 必要なコンテキスト一式

### コンテキスト完全性チェック

_このコードベースを知らない人でも、この計画書だけで実装できるか？_

## Skills参照計画

### 参照タイミングと目的

**⚠️ 重要**: 以下のSkillsは実装前に必ず参照すること。開発タイプ（Backend/Frontend/Full-stack）に応じて適切なSkillsを選択。

**Phase 1 - 基盤理解（実装開始前・全開発タイプ共通）**:
```yaml
foundation:
  path: .claude/skills/foundation/SKILL.md
  timing: 最初に必ず読む
  why: Critical Rules、命名規則、ファイル配置原則の把握
  required_for: Backend / Frontend / Full-stack
  read_also:
    - references/critical-rules.md
    - references/mcp-tools.md
  critical_points:
    - 既存コードの削除・置換禁止
    - 命名規則（Backend: スネークケース、Frontend: キャメル/パスカルケース）
    - ESLint Flat Config 使用

error-handling-system:
  path: .claude/skills/error-handling-system/SKILL.md
  timing: 実装開始前
  why: エラーコード体系、Backend→Frontend エラーフロー
  required_for: Backend / Frontend / Full-stack
  read_also:
    - references/error-codes.md
    - references/backend-patterns.md（Backend実装時）
    - references/frontend-patterns.md（Frontend実装時）
  critical_points:
    - Encore標準エラーコード（401, 403, 404, 500等）
    - ビジネスエラーコード（ERR_XXX_NNN形式）
    - Frontend での withErrorHandling() 使用
```

**Phase 2 - 実装準備（開発タイプ別）**:
```yaml
# Backend実装の場合
database-design:
  path: .claude/skills/database-design/SKILL.md
  timing: Migration作成前、テーブル設計時
  why: スキーマ分割、Extensions、段階的検索実装
  required_for: Backend（DB変更がある場合）
  read_also:
    - references/migration-patterns.md
    - references/extensions.md
  critical_points:
    - 4桁Migration番号（0001_xxx.up.sql）
    - エクステンション有効化（pg_trgm, fuzzystrmatch, tcn）
    - スキーマ分割（app.table形式）

backend-encore:
  path: .claude/skills/backend-encore/SKILL.md
  timing: API設計・実装前
  why: Encore.dev ルール、auth/expose 設計、サービス間通信
  required_for: Backend / Full-stack
  critical: ⚠️ Encore MCP 必須（利用不可時は開発停止）
  read_also:
    - references/service-patterns.md
    - references/testing.md
    - examples/api-examples.md
  critical_points:
    - 命名規則: 小文字スネークケース
    - 他サービス非改変
    - ~encore/clients 経由のサービス間通信
    - encore call_endpoint でのテスト

# Frontend実装の場合
frontend-sveltekit:
  path: .claude/skills/frontend-sveltekit/SKILL.md
  timing: コンポーネント設計前
  why: Svelte 5 Runes、DaisyUI v5、Colocation原則、状態管理
  required_for: Frontend / Full-stack
  critical: ⚠️ Svelte MCP 必須（Runes構文を必ず確認）
  read_also:
    - references/workflows.md（開発コマンド・チェックリスト）
    - references/state-management.md（状態管理手法選択）
    - references/colocation-rules.md（ファイル配置判断）
    - references/api-communication.md（API呼び出しパターン）
    - examples/implementation-patterns.md（実装パターン集）
  critical_points:
    - Svelte 5 Runes: $state, $derived, $effect
    - Colocation原則: 3+箇所 → lib/、それ以外 → routes/
    - invalidateAll() 禁止 → invalidate('app:...') 使用
    - DaisyUI v5: join + join-item（btn-group禁止）
```

**Phase 3 - 実装中（随時参照）**:
```yaml
実装パターンが必要な時:
  Backend:
    - backend-encore/examples/api-examples.md
    - backend-encore/references/service-patterns.md
  Frontend:
    - frontend-sveltekit/examples/implementation-patterns.md
    - frontend-sveltekit/references/state-management.md

エラーが発生した時:
  - error-handling-system/references/error-codes.md
  - 各Skill の「トラブルシューティング」セクション
  - foundation/references/mcp-tools.md（MCP使用方法）
```

### MCP使用検証

**⚠️ 開発開始前の必須チェック**:

```yaml
Backend開発:
  Encore MCP:
    - [ ] mcp__encore__get_services にアクセス可能
    - [ ] mcp__encore__get_databases にアクセス可能
    - [ ] mcp__encore__call_endpoint にアクセス可能
    - [ ] 利用不可の場合: ユーザーに通知して開発停止
    reason: Encore MCP なしでは Backend 開発不可

Frontend開発:
  Svelte MCP:
    - [ ] mcp__svelte__list-sections にアクセス可能
    - [ ] mcp__svelte__get-documentation にアクセス可能
    - [ ] 利用不可の場合: ユーザーに通知して開発停止
    reason: AI は Svelte 5 Runes を間違える（学習データが v3/v4）

  Playwright MCP:
    - [ ] mcp__playwright__browser_navigate にアクセス可能
    - [ ] mcp__playwright__browser_snapshot にアクセス可能
    - [ ] 利用不可の場合: ユーザーに通知して開発停止
    reason: UI確認が必須（ホットリロード活用）

Full-stack開発:
  - [ ] 上記全てのMCPにアクセス可能
  - [ ] 利用不可の場合: ユーザーに通知して開発停止
```

### Skills活用のベストプラクティス

```yaml
実装前:
  1. 該当するSkillの SKILL.md を全て読む
  2. 「使用タイミング」セクションで実装内容と一致するか確認
  3. references/ と examples/ を確認

実装中:
  1. 迷ったら該当Skillに戻る
  2. 実装パターンは examples/ を参照
  3. エラー時は「トラブルシューティング」セクション確認

検証時:
  1. 各Skillの「ベストプラクティス」セクションを確認
  2. チェックリストに従って検証
  3. MCP を活用してテスト
```

---

### プロジェクトコンテキスト

```yaml
- file: strategy/PROJECT-CONTEXT.md
  why: プロジェクト全体の設定と規約
  critical: frontend_pathとstructure_typeの設定

- file: strategy/ui-context/REGISTRY-SPEC.md
  why: サイドバーレジストリの実装仕様
  critical: レジストリ構造とデータ形式

- file: strategy/ui-context/COMPONENT-PATTERNS.md
  why: UIコンポーネントの共通パターン
  critical: 命名規則とディレクトリ構造
```

### 参考実装

```yaml
- file: strategy/examples/auth/jwt-auth.svelte
  why: JWT認証の実装パターン
  pattern: トークン管理とstore設計
  gotcha: リフレッシュトークンの扱い

- file: strategy/examples/layouts/admin-layout.svelte
  why: 管理画面レイアウトの構造
  pattern: ヘッダー、サイドバー、コンテンツの配置
  gotcha: モバイル時のドロワー制御
```

### ライブラリドキュメント

```yaml
- url: https://kit.svelte.dev/docs/routing#layout
  why: SvelteKitのレイアウトシステム
  critical: +layout.svelteの継承とグループ化

- url: https://daisyui.com/components/drawer/
  why: サイドバー実装のUIパターン
  critical: レスポンシブ対応とアニメーション

- url: https://tailwindcss.com/docs/dark-mode
  why: ダークモード実装
  critical: class vs media戦略の選択
```

### 既知のハマりどころ

```typescript
// SvelteKit特有の注意点
// - +layout.svelte は全子ルートに影響
// - load関数はサーバー/クライアント両方で実行される可能性
// - $app/stores はクライアントのみ
// - グループレイアウト (auth) はディレクトリ名に括弧が必要

// DaisyUI + Tailwind
// - テーマ変数は :root か data-theme で制御
// - コンポーネントクラスの順序が重要（後勝ち）
// - カスタムカラーは tailwind.config.js で定義

// 状態管理
// - Svelte stores は .js/.ts ファイルで定義
// - ページ間での状態共有は Context API か stores
// - SSRでの初期値設定に注意
```

## 実装ブループリント

### データモデルと構造

```typescript
// 認証関連の型定義
interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'manager' | 'user'
  avatar?: string
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
}

// サイドバーレジストリの型
interface MenuItem {
  id: string
  label: string
  route: string
  icon?: string
  badge?: {
    type: 'count' | 'new' | 'warning'
    value: string | number
  }
  children?: Record<string, MenuItem>
  roles?: string[]
}

interface MenuRegistry {
  version: string
  order: string[]
  groups: Record<string, MenuGroup>
}
```

### 実装タスク（依存関係順）

```yaml
Task 1: プロジェクト初期化
  - IMPLEMENT: SvelteKitプロジェクトの作成と設定
  - COMMAND: npx sv create {frontend_path} -- --template=skeleton --types=typescript
  - DEPENDENCIES: Node.js 18+, npm
  - PLACEMENT: PROJECT-CONTEXT.md の frontend_path に配置

Task 2: 依存関係と設定
  - IMPLEMENT: Tailwind CSS、DaisyUI、必要なライブラリのインストール
  - PACKAGES: tailwindcss, daisyui, @tailwindcss/typography, postcss, autoprefixer
  - CONFIG: tailwind.config.js, postcss.config.js, app.css
  - THEME: DaisyUIテーマ設定（ダークモード対応）

Task 3: レジストリシステム
  - IMPLEMENT: REGISTRY-SPEC.md に従ったサイドバーレジストリ
  - CREATE: src/lib/registry/sidebar/_meta.json
  - CREATE: src/lib/registry/sidebar/core.json
  - CREATE: src/lib/stores/sidebar.store.ts
  - PATTERN: 動的インポートとロールベースフィルタリング

Task 4: レイアウト実装
  - CREATE: src/routes/+layout.svelte
  - CREATE: src/lib/components/Header.svelte
  - CREATE: src/lib/components/Sidebar.svelte
  - CREATE: src/lib/components/MobileDrawer.svelte
  - RESPONSIVE: デスクトップは固定サイドバー、モバイルはドロワー

Task 5: 認証システム
  - CREATE: src/lib/stores/auth.store.ts
  - CREATE: src/routes/(auth)/login/+page.svelte
  - CREATE: src/routes/(auth)/logout/+page.server.ts
  - CREATE: src/hooks.server.ts（認証ガード）
  - PATTERN: JWTトークン管理、自動リフレッシュ

Task 6: 基本ページ
  - CREATE: src/routes/(app)/+page.svelte（ダッシュボード）
  - CREATE: src/routes/(app)/profile/+page.svelte
  - CREATE: src/routes/(app)/settings/+page.svelte
  - MOCK: 初期表示用のダミーデータ

Task 7: 共通コンポーネント
  - CREATE: src/lib/components/ui/Button.svelte
  - CREATE: src/lib/components/ui/Card.svelte
  - CREATE: src/lib/components/ui/Alert.svelte
  - CREATE: src/lib/components/ui/Loading.svelte
  - PATTERN: DaisyUIクラスをラップ、props型定義
```

### 実装パターン

```svelte
<!-- レイアウトパターン (src/routes/+layout.svelte) -->
<script lang="ts">
  import { page } from '$app/stores'
  import { sidebarItems } from '$lib/stores/sidebar.store'
  import Header from '$lib/components/Header.svelte'
  import Sidebar from '$lib/components/Sidebar.svelte'
  
  // PATTERN: レスポンシブ制御
  let drawerOpen = false
</script>

<div class="drawer lg:drawer-open">
  <input id="drawer-toggle" type="checkbox" class="drawer-toggle" bind:checked={drawerOpen} />
  
  <div class="drawer-content flex flex-col">
    <Header on:menu-click={() => drawerOpen = !drawerOpen} />
    <main class="flex-1 p-4">
      <slot />
    </main>
  </div>
  
  <div class="drawer-side">
    <label for="drawer-toggle" class="drawer-overlay"></label>
    <Sidebar items={$sidebarItems} />
  </div>
</div>
```

```typescript
// ストアパターン (src/lib/stores/auth.store.ts)
import { writable, derived } from 'svelte/store'
import type { User, AuthState } from '$lib/types'

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true
  })

  return {
    subscribe,
    login: async (credentials: LoginCredentials) => {
      // PATTERN: API呼び出しとトークン保存
    },
    logout: () => {
      // PATTERN: クリーンアップとリダイレクト
    },
    refresh: async () => {
      // PATTERN: トークンリフレッシュ
    }
  }
}

export const auth = createAuthStore()
export const currentUser = derived(auth, $auth => $auth.user)
```

## 検証ループ

### レベル1: 構文とスタイル

```bash
# TypeScriptとSvelteの検証
pnpm run check

# Prettierフォーマット
pnpm run format

# ESLint
pnpm run lint

# 期待値: エラー0件
```

### レベル2: ビルド検証

```bash
# 開発ビルド
pnpm run dev
# http://localhost:5173 でアクセス可能

# 本番ビルド
pnpm run build
pnpm run preview

# 期待値: ビルド成功、警告なし
```

### レベル3: 機能検証

```bash
# 基本的な動作確認
- ログインページが表示される
- ログイン後ダッシュボードへリダイレクト
- サイドバーメニューが表示される
- メニュークリックでページ遷移
- レスポンシブ（モバイル/デスクトップ）
- ダークモード切り替え（実装した場合）
```

### レベル4: 統合検証

```bash
# レジストリの動作確認
- 新規メニュー項目の追加
- ロールベースの表示制御
- バッジの動的更新

# 認証フローの確認
- トークンの有効期限
- リフレッシュ動作
- ログアウト処理
```

## 最終検証チェックリスト

### 技術検証

- [ ] TypeScriptエラーなし
- [ ] ビルド成功
- [ ] すべてのページが表示可能
- [ ] レスポンシブデザイン確認

### 機能検証

- [ ] 認証フロー完成
- [ ] サイドバーナビゲーション動作
- [ ] 基本ページすべて実装
- [ ] エラーハンドリング実装

### コード品質

- [ ] PROJECT-CONTEXT.md の規約に準拠
- [ ] REGISTRY-SPEC.md の仕様に準拠
- [ ] コンポーネントパターンに準拠
- [ ] 適切な型定義

## アンチパターン

- ❌ +layout.svelte を過度にネストしない
- ❌ クライアント専用コードをサーバーで実行しない
- ❌ レジストリを直接編集せず、API経由で更新
- ❌ グローバルスタイルの乱用を避ける
- ❌ 認証状態をローカルストレージのみに依存しない


## Q&A リスト

実装時に発見した不明点や仮決定して実装したが確認が必要な項目など、本実装の修正・追加を行う前に確定する必要がある項目を質問リストとして記載。

```yaml
TITLE 1: 質問概要
  Question: 質問内容
  Answer: 解答例または現在選択した手法
```