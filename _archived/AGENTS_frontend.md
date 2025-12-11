# AI作業プロンプト: SvelteKit + DaisyUI フロントエンド / 実装・テスト・デバッグ

このプロンプトは **AI** が `SvelteKit v2.x + Svelte 5 + DaisyUI v5` で構築されたフロントエンドの **実装・テスト・デバッグ** を安全かつ効率的に行うための、**厳格な実行規約・手順書** です。
**制限や指示を緩めたり曖昧化することは一切認めません。** 必ず本ドキュメントのルールを優先してください。

---

## 1. プロジェクト基本方針（必読）

- 本プロジェクトは **Encore.dev TypeScript** バックエンドと **SvelteKit** フロントエンドで構成されています。
- **API通信は必ずgenerated/client経由**。直接fetchは厳禁。中間APIエンドポイントの作成も禁止。
- **既存のUIや機能を勝手に削除しない**。エラーを理由に機能削除は絶対禁止。
- **DaisyUI v5 + Tailwind v4** の正しい設定（CSS-first）を厳守。
- **美しいUI/UXを追求**。作成前に十分に設計を検討すること。

---

## 2. 実装プロセス（必須手順）

### 実装前の必須プロセス

1. **共通コンポーネント調査**
   ```bash
   ls src/lib/components/
   rg "export" src/lib/components/
   ```

2. **既存画面の作りや構成理解**
   ```bash
   ls -la src/routes/
   rg "<script" src/routes/ --type svelte
   ```

3. **ドキュメント理解**
   - 本ドキュメント
   - SKILL-SVELTEKIT-DAISY.md
   - backend/AGENTS.md（API仕様）
   - docs/ai_docs/*.md

4. **実装**
   - 共通パターンの踏襲
   - DaisyUIコンポーネントの活用
   - Svelte 5 Runesの使用

5. **ブラウザによる確認（MCP Playwright使用）**
   - ログインアカウントは `ai@fox-hound.jp / A_word_is_enough_to_the_wise` でsuper_admin権限が作成されている。ログインできない場合は相談する。
   - 画面表示の確認
   - インタラクションのテスト
   - レスポンシブ確認

6. **完全なエラーの抽出と内容の再調査**
   ```bash
   pnpm run check
   pnpm run lint
   ```

7. **エラー修正**
   - エラーが3回以上同じものが出たら状況報告を行って一旦作業を停止

---

## 3. 技術スタック詳細

### SvelteKit v2.x + Svelte 5

#### Runes（必須使用）
```svelte
<script lang='ts'>
	const count = $state(0) // 反応状態
	const doubled = $derived(count * 2) // 派生（アロー関数不要）
	const props = $props<{ title: string }>() // プロパティ

	$effect(() => {
		console.log('count changed:', count) // 副作用
	})
</script>
```

**重要**: `$derived`は直接式を受け取る（アロー関数を渡さない）
```typescript
// ❌ 誤り
const total = $derived(() => items.reduce((sum, item) => sum + item.value, 0))

// ✅ 正しい
const total = $derived(items.reduce((sum, item) => sum + item.value, 0))
```

#### イベントハンドラ記法（重要・本プロジェクトの規約）

本プロジェクトは vite-plugin-svelte の設定により、イベントは **DOM属性記法** に統一します。すなわち、`on:click` ではなく **`onclick`**（`ondrop`/`oninput` 等も同様）を使用してください。

理由:
- 本リポジトリのコンパイラ設定は「新しいイベント記法（DOM属性）」を採用しています。`on:click` と混在させるとコンパイルエラー（mixed_event_handler_syntaxes）が発生します。

例:
```svelte
<!-- ❌ NG: on:click と onclick を混在 -->
<button on:click={doIt}>Run</button>

<!-- ✅ OK: DOM属性記法に統一 -->
<button onclick={doIt}>Run</button>
```

既存コードを編集する際は、`on:click` を見つけたら必ず `onclick` に置換してください（`ondrop`/`ondragover`/`ondragleave` 等も同様）。

### DaisyUI v5 + Tailwind v4（最重要）

#### CSS-first設定（必須）
```css
/* src/app.css */
@import "tailwindcss";
@plugin "daisyui" {
  themes: light --default, dark --prefersdark;
}
```

#### Vite設定
```typescript
import { sveltekit } from '@sveltejs/kit/vite'
// vite.config.ts
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()]
})
```

#### v5クラス変更（注意）
- `btn-group` → `join + join-item`
- `input-bordered` → デフォルトで枠あり
- `footer` → 縦がデフォルト（横は`md:footer-horizontal`）
- `avatar`のクラス → `avatar-online`等に変更

#### アバター表示の正しい実装
```svelte
<!-- アバタープレースホルダーの正しい実装 -->
<div class='avatar avatar-placeholder'>
	<div class='bg-neutral text-neutral-content rounded-full w-10 flex items-center justify-center'>
		<span class='leading-none'>{initials}</span>
	</div>
</div>
```

---

## 4. ファイル配置ルール（Colocation原則）【最重要】

本プロジェクトは **Colocation（コロケーション）原則** を採用しています。機能に関連するファイルは近くに配置し、AIが論理的に配置を判断できる明確な基準を設けます。

### 4.1 基本原則

1. **機能に関連するファイルは近くに配置する**（High Cohesion）
2. **複数の機能から使われるものだけ lib/ に配置する**
3. **1ファイルのみのディレクトリは作らない**（拡張予定がない限り）
4. **曖昧な名前のディレクトリは作らない**（`ui/`, `helpers/`, `state/` など）

### 4.2 配置判断フローチャート

```
新しいファイルを配置する時:
  │
  ├─ 3箇所以上の異なる機能から使う？
  │   ├─ Yes → lib/ へ配置
  │   └─ No  → routes/(app)/[機能名]/ へ配置
  │
  └─ 「異なる機能」の定義:
      - routes/(app)/ 直下の異なるディレクトリ（dashboard, users, user-settings 等）
      - lib/components/ の共通コンポーネントから
      - 複数の +layout.svelte や +page.svelte から
```

**判断基準の具体例**:
- **1箇所のみ** → 機能内に配置
- **2箇所** → 機能内に配置（将来3箇所目が出たら lib/ へ移動）
- **3箇所以上** → lib/ へ配置

### 4.3 lib/ 配下のディレクトリ構造（厳格）

```
lib/
├── api/              # APIクライアント（全機能共通）
│   └── client.ts     # Encore SDK ラッパー、認証、トークン管理、統一エラーハンドリング
│
├── stores/           # 全体で共有される Svelte store
│   ├── theme.ts      # テーマ管理
│   ├── toast.ts      # トースト通知
│   ├── cache.ts      # クエリキャッシュ（旧 state/query.ts）
│   └── error.ts      # グローバルエラー状態管理
│
├── components/       # 3箇所以上で使われる汎用コンポーネント
│   ├── Header.svelte
│   ├── ThemeSelector.svelte
│   ├── RoleSelect.svelte
│   ├── ToastHost.svelte
│   ├── ErrorBoundary.svelte  # エラー境界コンポーネント
│   ├── ErrorToast.svelte     # エラートースト表示
│   └── sidebar/      # サイドバー関連（複数ファイルのまとまり）
│       ├── components/
│       ├── index.ts
│       ├── store.ts
│       ├── types.ts
│       └── menu-config.ts
│
├── notifications/    # 通知システム（複数箇所から使用）
│   ├── client.ts     # SSE 接続管理
│   ├── store.ts      # 通知センター状態管理
│   ├── types.ts      # 型定義
│   └── proxy.ts      # プロキシロジック
│
├── errors/           # 統一エラーハンドリングシステム
│   ├── index.ts      # エクスポート
│   ├── types.ts      # UIError型定義
│   ├── error-codes.ts       # エラーコード定数（認証、権限、システムエラー等）
│   ├── error-messages.ts    # エラーコード別の日本語メッセージ
│   └── transformer.ts       # APIError → UIError変換、エラー判定関数
│
├── monitoring/       # 監視・エラーレポート
│   └── sentry.ts     # Sentry統合（初期化、エラーレポート）
│
├── utils/            # 純粋関数の汎用ユーティリティ
│   ├── forms.ts      # フォーム強化（旧 forms/enhance.ts）
│   ├── avatar.ts     # アバター関連
│   └── data-fetching.ts  # データフェッチング抽象化
│
├── domain/           # ドメイン固有のビジネスロジック
│   └── romaji.ts     # 日本語→ローマ字変換
│
├── generated/        # Encore 自動生成（編集禁止）
│   └── client.ts     # Encore SDK、APIError、ErrCode
│
├── assets/
│   └── favicon.svg
│
├── config.ts         # 設定
└── index.ts          # エクスポート
```

**禁止されるディレクトリ名**:
- ❌ `lib/ui/` （`lib/components/` または `lib/stores/` を使う）
- ❌ `lib/state/` （`lib/stores/` を使う）
- ❌ `lib/forms/` （`lib/utils/` に統合）
- ❌ `lib/helpers/` （`lib/utils/` を使う）
- ❌ `lib/common/` （具体的な名前を使う）

### 4.4 routes/(app)/ 配下の構造（機能ごと）

```
routes/(app)/
└── [機能名]/           # 例: dashboard, user-settings, users, notifications
    ├── components/     # この機能専用のコンポーネント
    │   ├── KPICard.svelte
    │   ├── ActivityTimeline.svelte
    │   └── ...
    ├── utils/          # この機能専用のユーティリティ（必要な場合のみ）
    ├── types.ts        # この機能専用の型定義（必要な場合のみ）
    ├── +page.svelte
    ├── +page.server.ts
    ├── +layout.svelte  # この機能専用レイアウト（必要な場合のみ）
    ├── +layout.server.ts
    └── [エンドポイント]/
        └── +server.ts  # API エンドポイント（必要な場合のみ）
```

**重要な注意点**:
- `routes/(app)/api/` という中間ディレクトリは**作らない**
  - ❌ `routes/(app)/api/notifications/stream/+server.ts`
  - ✅ `routes/(app)/notifications/stream/+server.ts`
- エンドポイントは機能名で直接配置する

### 4.5 配置の具体例

| ファイル | 使用箇所数 | 使用箇所の例 | 配置 | 理由 |
|---------|-----------|------------|------|-----|
| `KPICard.svelte` | 1箇所 | dashboard のみ | `routes/(app)/dashboard/components/` | dashboard 専用 |
| `DashboardHeader.svelte` | 1箇所 | dashboard のみ | `routes/(app)/dashboard/components/` | dashboard 専用 |
| `Header.svelte` | 全ページ | (app)/+layout.svelte | `lib/components/` | 全機能共通 |
| `toast.ts` | 5箇所 | Header, forms, 各種画面 | `lib/stores/` | 複数機能から使用 |
| `forms.ts` | 6箇所 | users, devices, notifications 等 | `lib/utils/` | 複数機能から使用 |
| `romaji.ts` | 1箇所 | users の作成画面のみ | `lib/domain/` | ドメインロジック（将来他でも使う可能性） |
| `avatar.ts` | 3箇所 | user-settings, users, Header | `lib/utils/` | 3箇所以上で使用 |
| `proxy.ts` | 1箇所 | notifications/stream のみ | `lib/notifications/` | 通知機能の一部として集約 |

### 4.6 移動の判断基準

**機能内 → lib/ への移動**:
- 機能内に配置したコンポーネントを **3箇所目で使いたくなった**
  → その時点で `lib/components/` へ移動
  → import を一括置換

**lib/ → 機能内への移動**:
- lib/ に配置したが **実際は1箇所でしか使っていない** ことが判明
  → 機能内へ移動を検討（ただし強制ではない）

### 4.7 命名規則

**機能内コンポーネント**（機能を含む具体的な名前）:
- 例: `DashboardKPICard.svelte`, `UserSettingsGeneralTab.svelte`, `NotificationBell.svelte`

**lib/ 共通コンポーネント**（汎用的な名前）:
- 例: `Button.svelte`, `Modal.svelte`, `Header.svelte`, `Card.svelte`

**ファイル名の一貫性**:
- Svelte コンポーネント: PascalCase (例: `Header.svelte`)
- TypeScript ファイル: kebab-case または camelCase (例: `client.ts`, `data-fetching.ts`)
- +で始まる SvelteKit 特殊ファイル: 小文字 (例: `+page.svelte`, `+server.ts`)

### 4.8 禁止事項（ファイル配置）

- ❌ **1ファイルのみのディレクトリを作成しない**（拡張予定がない限り）
  - 悪い例: `lib/forms/enhance.ts` （1ファイルのみ）
  - 良い例: `lib/utils/forms.ts` （utils 配下に統合）

- ❌ **lib/ 配下に曖昧な名前のディレクトリを作らない**
  - 禁止: `lib/ui/`, `lib/state/`, `lib/helpers/`, `lib/common/`
  - 使用: `lib/components/`, `lib/stores/`, `lib/utils/`

- ❌ **routes/ 配下に `api/` という中間ディレクトリを作らない**
  - 悪い例: `routes/(app)/api/notifications/stream/+server.ts`
  - 良い例: `routes/(app)/notifications/stream/+server.ts`

- ❌ **機能を跨いだ `shared/` や `common/` ディレクトリを作らない**
  - 共通化が必要なら lib/ へ配置し、具体的な名前を付ける

### 4.9 AI のための判断ガイド

#### Q: 新しいコンポーネントを作る時、どこに置く？
**A**: まず「この機能専用か？」を問う
- **この機能専用** → `routes/(app)/[機能名]/components/`
- **複数機能で使う** → `lib/components/`

例:
- `DashboardKPICard.svelte` → dashboard 専用 → `routes/(app)/dashboard/components/`
- `Header.svelte` → 全ページで使う → `lib/components/`

#### Q: ユーティリティ関数を作る時、どこに置く？
**A**: 「どこから呼ばれるか？」を問う
- **1箇所のみ** → `routes/(app)/[機能名]/utils/` または同じディレクトリ内
- **複数箇所** → `lib/utils/`

例:
- `formatDashboardDate()` → dashboard のみ → `routes/(app)/dashboard/utils.ts`
- `formatCurrency()` → 複数画面で使う → `lib/utils/currency.ts`

#### Q: Svelte store を作る時、どこに置く？
**A**: 基本的に `lib/stores/`（全体で共有される前提）
- ただし機能内でのみ使う状態管理なら `routes/(app)/[機能名]/store.ts`

例:
- `theme.ts`, `toast.ts`, `cache.ts` → 全体共有 → `lib/stores/`
- `dashboardFilters.ts` → dashboard 専用 → `routes/(app)/dashboard/store.ts`

#### Q: 型定義を作る時、どこに置く？
**A**: 使用範囲による
- **機能専用** → `routes/(app)/[機能名]/types.ts`
- **複数機能で共有** → `lib/types/` または関連するディレクトリ内

例:
- `DashboardMetrics` → dashboard 専用 → `routes/(app)/dashboard/types.ts`
- `NotificationPayload` → 通知システム全体 → `lib/notifications/types.ts`

#### Q: プロキシエンドポイント（+server.ts）を作る時、どこに置く？
**A**: `routes/(app)/[機能名]/` 配下に直接配置
- **重要**: `api/` という中間ディレクトリは作らない

例:
- 通知ストリーム → `routes/(app)/notifications/stream/+server.ts`
- ユーザープロフィール更新 → `routes/(app)/user-settings/profile/+server.ts`

#### Q: 既存のファイルが適切な場所にない場合は？
**A**: このルールに従って移動を検討
1. 使用箇所を確認（ripgrep で検索）
2. 3箇所以上なら lib/ へ、そうでなければ機能内へ
3. import を一括置換（sed または手動）

---

## 5. API通信ルール（最重要）

## FRONTEND_DATA_LAYER_SPEC

目的: Encore 生成SDKを経由した通信の共通化、ルート保護、簡易キャッシュ、即時反映の手引き。

### 構成概要
- `src/lib/generated/client.ts`: Encore 生成クライアント（既存）。
- `src/lib/api/client.ts`: 認証トークン(Cookie)取り扱い、`withAutoRefresh` 再試行、`serverClient` を提供（SSR限定）。
  - `serverClient` は `options.auth` に関数を渡し、毎回Cookieから最新のアクセストークンを読み直します（トークン更新直後の同リクエスト内でも即時反映）。
- `src/lib/stores/cache.ts`: シンプルなクエリキャッシュ（TTL・重複取得防止・手動更新）。
- ルート保護: `routes/(app)/+layout.server.ts` で `auth.me` → `users.get_profile` を取得し、未ログイン時 `/login` へ。
- ログイン: `routes/login/+page.server.ts` で `auth.login` 実行→HttpOnly Cookie保存→`/dashboard` へ。
- ログアウト: `routes/logout/+page.server.ts` で Cookie削除→`/login` へ。

### 送信系の共通化（SvelteKit専用）
- `src/lib/utils/forms.ts`: SvelteKit `enhance` の共通ハンドラ。失敗→トースト表示、成功→任意の依存を `invalidate()` し、成功トーストを表示。
- `src/lib/stores/toast.ts` + `src/lib/components/ToastHost.svelte`: 右下の通知UI（success/error/info/warn）。`(app)/+layout.svelte` に `ToastHost` を設置済み。

#### 使い方
```svelte
<script lang='ts'>
	import { useEnhance } from '$lib/utils/forms'

	const enhance = useEnhance({ successMessage: '保存しました', invalidateDeps: ['app:users'] })
</script>

<form method='POST' action='?/update' use:enhance={enhance}>...</form>
```

ガイドライン:
- 送信は Action（`?/action_name`）を基本とし、結果は `useEnhance` のトーストと `invalidate` で反映。
- redirect を返す Action は `useEnhance` が `update()` を呼ぶことで遷移に委譲。
- 個別フォーム内のバリデーションは HTML 属性（`required`/`pattern`/`minlength` 等）か、Action 側の zod で実施。

#### トースト仕様（デフォルト）
- success: 約3.5秒、error: 約6秒表示（`src/lib/stores/toast.ts`）。必要に応じて `toast.success|error()` を直接呼び出し可。

### UI/フォームのルール（抜粋）
- 役割選択: ネイティブ`select`は開く方向を制御できないため、DaisyUIの`dropdown`（`dropdown-bottom`）で擬似セレクトを実装（`src/lib/components/RoleSelect.svelte`）。［根拠: DaisyUI dropdown placementクラスで下方向を指定可能。]
- Romanji入力: "Last Name (ローマ字) / First Name (ローマ字)" は半角英字のみ（`pattern="^[A-Za-z]+$"`、`inputmode="latin"`）。
- super_admin: UI ではロール選択・一覧ともに非表示。作成/昇格はAction側で403により拒否（テンプレの運用方針）。

#### ルート遷移とデフォルトパス
- ルート(`/`)アクセス時は `routes/+page.server.ts` が `DEFAULT_APP_PATH` へ 302 リダイレクト。
- `DEFAULT_APP_PATH` は `frontend/.env` の `PUBLIC_DEFAULT_APP_PATH` で設定可能（未設定は `/dashboard`）。
- ログイン成功時の遷移先もこの値を使用します。

### BFFエンドポイント（ユーザー設定の例）
HttpOnly Cookie 運用のため、ブラウザからの認証付きAPIは SvelteKit エンドポイント経由に統一。

- `routes/(app)/user-settings/+page.server.ts`: `users.get_profile` を取得し `data.profile` で提供。
- `routes/(app)/user-settings/profile/+server.ts` (PUT): `users.update_profile` を委譲。
- `routes/(app)/user-settings/password/+server.ts` (POST): `users.change_password` を委譲。
- `routes/(app)/user-settings/avatar/+server.ts` (POST/DELETE): `users.upload_avatar` / `users.delete_avatar` を委譲。
- `routes/(app)/user-settings/components/GeneralTab.svelte`: 上記BFFに対して `fetch` 実行。

### 認証トークン運用
- Cookie名: `acc_at`(アクセストークン), `acc_rt`(リフレッシュ) — HttpOnly/Lax/Path=/, `secure` は本番時に有効。
- 有効期限: `expires_in` に基づき `acc_at` を設定。`acc_rt` は30日(デフォルト)。
- フロントはSSR限定で SDK に Authorization を付与。

#### サーバーでの利用
```ts
// routes/(app)/+layout.server.ts
const client = serverClient(event) // CookieからBearerを自動付与
const me = await client.auth.me()
```

<!-- 本プロジェクトはCSR対象外のため、クライアント側SDKの直接利用は行いません。 -->

### 自動リフレッシュと再試行
`withAutoRefresh` を用いて 401 を1回だけ自己回復:
```ts
const data = await withAutoRefresh({
	exec: () => client.users.get_profile(),
	refresh: () => client.auth.refresh({ refresh_token }),
	onRefreshed: (t) => setTokensToCookies(cookies, t),
})
```

### エラー取り扱い方針

#### 統一エラーハンドリングシステム

本プロジェクトは **統一エラーハンドリングシステム** を採用しています。すべてのAPIエラーは一貫した方法で処理されます。

**構成**:
- `lib/errors/transformer.ts`: `APIError` → `UIError` 変換
- `lib/errors/error-codes.ts`: エラーコード定数（認証、権限、システムエラー等）
- `lib/errors/error-messages.ts`: エラーコード別の日本語メッセージ
- `lib/stores/error.ts`: グローバルエラー状態管理
- `lib/monitoring/sentry.ts`: システムエラーの自動Sentryレポート
- `lib/api/client.ts`: `withErrorHandling()` 統合ラッパー

**基本的な使用方法**:
```typescript
import { withErrorHandling } from '$lib/api/client'

// 自動エラーハンドリング（推奨）
const profile = await withErrorHandling(
  () => client.users.get_profile(),
  {
    showGlobalError: true,      // グローバルエラートースト表示（デフォルト: true）
    redirectOnAuthError: true,  // 認証エラー時に /login へ自動リダイレクト（デフォルト: true）
    reportToSentry: true,       // システムエラー（5xx）をSentryに自動レポート（デフォルト: true）
    autoCloseMs: 5000,          // エラートースト自動クリア時間（デフォルト: 5000ms）
  }
)
```

**カスタムエラーハンドリング**:
```typescript
import { transformApiError } from '$lib/errors'

try {
  await client.users.create({ ... })
} catch (error) {
  const uiError = transformApiError(error)
  // uiError.code: エラーコード（'unauthenticated', 'ERR_USER_001' 等）
  // uiError.userMessage: ユーザー向けメッセージ（日本語）
  // uiError.statusCode: HTTPステータスコード
  // uiError.details: { retryable, suggestedAction, reason, metadata }

  // カスタム処理
  if (uiError.code === 'ERR_USER_001') {
    // メールアドレスが既に登録済み
  }
}
```

**エラー判定ヘルパー**:
```typescript
import { isAuthenticationError, isPermissionError, isSystemError } from '$lib/errors'

if (isAuthenticationError(uiError)) {
  // 認証エラー（401, ERR_AUTH_001-004）
}
if (isPermissionError(uiError)) {
  // 権限エラー（403, ERR_USER_007, ERR_DEVTOOLS_001）
}
if (isSystemError(uiError)) {
  // システムエラー（5xx）→ 自動的にSentryへレポート
}
```

**エラー分類**:
- **認証エラー**: `unauthenticated`, `ERR_AUTH_001`-`004` → 自動リダイレクト `/login`
- **権限エラー**: `permission_denied`, `ERR_USER_007`, `ERR_DEVTOOLS_001`
- **バリデーションエラー**: `invalid_argument`, `ERR_USER_001`-`004`
- **システムエラー**: 500-504 → 自動Sentryレポート

**重要な注意点**:
- `lib/errors.ts` の `toMessage()`, `mapStatusToTitle()` は削除済み。使用しないこと。
- すべてのエラー処理は `transformApiError()` または `withErrorHandling()` を使用。
- Encoreクライアントは `response.ok` でない場合 `APIError(status, body)` を投げます。
- 共通方針: API呼び出しは `withErrorHandling()` または `withAutoRefresh()` 経由。

### キャッシュ/状態管理
`createQuery(key, fetcher, { ttl })` により重複取得と取り過ぎを抑制。

```ts
// 例: プロファイル情報
const profileQuery = createQuery('users/profile', () => client.users.get_profile(), { ttl: 30_000 })
$: $profileQuery // { data, loading, error }

// 即時反映(楽観更新)
profileQuery.setData((old) => ({ ...old!, display_name: newName }))

// 強制再取得
await profileQuery.refetch(true)
```

### ルートガード
- `(app)` グループ配下は `+layout.server.ts` が `auth.me`/`users.get_profile` を実行。
- 失敗時は `/login` へ 302。
- `Header.svelte` は `users.UserProfile` を受け取り、ユーザー操作(設定/ログアウト)を提供。

### 実装ファイル一覧
- `src/lib/api/client.ts`: トークン入出力/再試行ロジック
- `src/lib/stores/cache.ts`: 簡易Queryキャッシュ
- `routes/(app)/+layout.server.ts`: 認証チェック・ユーザー取得
- `routes/login/+page.server.ts`: ログイン処理
- `routes/logout/+page.server.ts`: ログアウト処理
 - `routes/+page.server.ts`: ルートアクセスの既定パスへの転送
 - `src/lib/config.ts`: `DEFAULT_APP_PATH`（`PUBLIC_DEFAULT_APP_PATH`のラッパー）

### 管理者向け ユーザー管理（概要）
- 一覧/作成/編集/ロール変更/有効⇄無効/パスワードリセット/強制ログアウト/削除・復活。
- Action 一覧（`routes/(app)/users/+page.server.ts`）
  - `create`, `update`, `change_status`, `reset_password`, `force_logout`, `delete`, `restore`
  - すべて Encore SDK を使用し、401 は `withAutoRefresh` で自己回復。
- `depends('app:users')` を使用し、`useEnhance({ invalidateDeps: ['app:users'] })` で再描画。
- ポリシー:
  - `super_admin` は UI のロール候補から除外・一覧にも非表示。
  - 作成/昇格をサーバ側で明示的に禁止（403）。
- 入力支援:
  - 氏名→ローマ字を `toRomaji` で自動生成（Last/First）。
  - ローマ字欄は半角英字のみ（`pattern="^[A-Za-z]+$"`）。

### 役割選択 UI（下方向に開く）
- コンポーネント: `src/lib/components/RoleSelect.svelte`
  - DaisyUI の `dropdown dropdown-bottom` + `menu` を用い、常に下方向に展開。
  - フォーム送信のため、選択値は隠し `input[type=hidden] name=roleName` に同期。
  - 開く方向/位置は `dropdown-*` クラスで調整可能。

### 今後の拡張ガイド
- トークンの暗号化Cookie化/有効期限短縮/スライディングセッション等の強化
- `handleFetch` でのクロスカット(監査ヘッダー付与等)
- `createMutation` ユーティリティ（POST/PUT/DELETEの共通エラーハンドリング）
- websocket/SSEの再接続・購読管理（SDKのStream型にフック）

### 注意
- 既存機能を削除・置換しない（AGENTS.md遵守）。
- 既存の `generated/client.ts` を直接変更しない（再生成に耐える）。
- 迷ったら相談し、代替案はメリデメ明示の上で提案。

### 既知のUIパターン（ログイン）
- Action実装の注意:
  - `throw redirect(...)` は try/catch の外で行う（広い catch が redirect を誤って握り潰さないように）。
  - `use:enhance` のコールバックで `result.type === 'redirect'` の場合は必ず `update()` を呼ぶ（SvelteKit に遷移を委譲）。
  - 稀なブラウザ差異に備え `result.type === 'success'` 時は `goto(DEFAULT_APP_PATH)` をフォールバック実行可能。

### .env 設定例（frontend/.env）
```
# ログイン成功時やトップアクセス時の遷移先
PUBLIC_DEFAULT_APP_PATH=/dashboard
```

---

## 6. サイドバーメニュー追加

新機能を追加した際は `lib/components/sidebar/menu-config.ts` を編集してサイドバーにメニューを追加すること。詳細は `docs/SIDEBAR_SPEC.md` を参照。

---

## 7. 状態管理パターン

### 優先順位
1. **ローカル状態**: Runes（`$state`/`$derived`）
2. **URL状態**: `page.url.searchParams`
3. **サーバー状態**: load関数 + depends/invalidate
4. **共有状態**: Context API
5. **グローバル状態**: stores（最小限）

### load関数とinvalidate
```typescript
// +page.server.ts
export async function load({ depends }) {
	depends('app:user-profile') // 依存関係を宣言
	const profile = await fetchProfile()
	return { profile }
}

// コンポーネント
await invalidate('app:user-profile') // 特定データのみ再取得
// invalidateAll()は使わない！
```

---

## 7.1 フォーム送信（SvelteKit enhance）【必読】

> ここを外すと「押しても何も起きない」になります（API未送信）。

概要
- `enhance` は SvelteKit のフォーム用アクション（`$app/forms`）。
- JS有効時は fetch で非遷移送信し、`result.type`（success/failure/redirect）に応じてUI更新する。

最低限（デフォルト動作）
```svelte
<script lang='ts'>
	import { enhance } from '$app/forms'
</script>

<!-- actions.update を呼ぶ。引数なしの use:enhance でデフォルト更新が効く -->
<form method='POST' action='?/update' use:enhance>
	<button type='submit' class='btn btn-primary'>送信</button>
</form>
```

カスタム処理（トースト・invalidate・バリデーション）
```svelte
<script lang='ts'>
	import { enhance } from '$app/forms'

	const onSubmit = () => async ({ result, update }) => {
		if (result.type === 'failure') {
			await update() // フォームエラーを再描画
			return
		}
		if (result.type === 'success') {
			// ここで toast 表示や invalidate を行う
			await update() // ページのload/dataを再評価
			return
		}
		if (result.type === 'redirect') {
			await update() // リダイレクト反映
		}
	}
</script>

<form method='POST' action='?/update' use:enhance={onSubmit}>
	<button type='submit' class='btn btn-primary'>送信</button>
</form>
```

サーバ側（典型）
```ts
// +page.server.ts
export async function load(event) {
	event.depends('app:feature') // invalidate のキー
	return { /* data */ }
}

export const actions = {
	update: async (event) => {
		const fd = await event.request.formData()
		// 検証とAPI呼び出し
		return { success: true }
	}
}
```

モーダル/ダイアログでの注意
- ボタンは必ず `type="submit"`。
- 送信直前に要素をDOMから消さない（モーダルを閉じるのは送信"後"、`result.type==='success'` で行う）。
- `disabled` や `pointer-events: none` が付いていないか確認。

動かないときの診断チェックリスト
- [ ] `import { enhance } from '$app/forms'` を入れたか。
- [ ] `<form use:enhance>`（または `use:enhance={...}`）が付いているか。
- [ ] `action="?/xxx"` の `xxx` が `+page.server.ts` の `actions.xxx` と一致しているか。
- [ ] `invalidate('app:...')` と `event.depends('app:...')` のキーが一致しているか。
- [ ] ボタンは `type="submit"` か（`on:click` でDOMを消していないか）。
- [ ] devtools の Network に POST が出ているか（出ない=DOM/アクション側、出る=サーバ側）。

---

## 8. super_admin専用機能

### 特別ルール
- super_admin専用メニューは一般ユーザーに見えない
- 封建的な扱いを許可（通常禁止されているfetchの直接使用も可）
- デバッグツールやシステム管理機能の実装

### 実装例
```svelte
{#if user?.role?.name === 'super_admin'}
	<!-- super_admin専用UI -->
	<DevTools />
{/if}
```

---

## 9. UI/UX設計原則

### 必須要件
- **極限まで美しいUI/UXを考えてから作成する**
- **4状態の考慮**: loading / error / empty / success
- **レスポンシブデザイン**: モバイル・タブレット・デスクトップ
- **アクセシビリティ**: ARIA属性、キーボード操作
- **フィードバック**: ユーザーアクションに対する即座の反応

### UIコンポーネント例
```svelte
<script lang='ts'>
	const loading = $state(false)
	const error = $state<string | null>(null)
	const data = $state<Data | null>(null)
</script>

{#if loading}
	<div class='loading loading-spinner'></div>
{:else if error}
	<div class='alert alert-error'>{error}</div>
{:else if !data}
	<div class='text-center'>データがありません</div>
{:else}
	<!-- 成功時のUI -->
{/if}
```

---

## 10. エラー処理とデバッグ

### エラー処理ルール
- **同じエラーが3回以上発生したら作業を停止し状況報告**
- エラーを理由に機能を削除しない
- 根本原因を特定してから修正
- **統一エラーハンドリングシステムを使用する**

### 統一エラーハンドリングシステムの使用

本プロジェクトでは、すべてのAPIエラーを一貫した方法で処理します。

#### 推奨パターン: withErrorHandling() の使用

```typescript
import { withErrorHandling } from '$lib/api/client'

// サーバーサイド（+page.server.ts, +server.ts）
export async function load(event) {
  const client = serverClient(event)

  const profile = await withErrorHandling(
    () => client.users.get_profile(),
    {
      showGlobalError: true,      // エラートースト表示
      redirectOnAuthError: true,  // 認証エラー時に自動リダイレクト
      reportToSentry: true,       // システムエラーをSentryへ自動レポート
    }
  )

  return { profile }
}
```

#### カスタムエラーハンドリングパターン

特定のエラーに対して個別の処理が必要な場合：

```typescript
import { transformApiError, isAuthenticationError } from '$lib/errors'

try {
  await client.users.create(newUser)
} catch (error) {
  const uiError = transformApiError(error)

  // 特定のエラーコードで条件分岐
  if (uiError.code === 'ERR_USER_001') {
    // メールアドレスが既に登録済み
    emailInput.setCustomValidity('このメールアドレスは既に使用されています')
    return
  }

  // 認証エラーの判定
  if (isAuthenticationError(uiError)) {
    goto('/login')
    return
  }

  // その他のエラー
  toast.error(uiError.userMessage)
}
```

#### エラーコードの確認方法

プロジェクトで使用可能なエラーコードは以下で確認できます：

- `lib/errors/error-codes.ts` - エラーコード定数の定義
- `lib/errors/error-messages.ts` - エラーメッセージのマッピング

**エラーコード分類**:
- `AUTH_ERROR_CODES` - 認証エラー
- `PERMISSION_ERROR_CODES` - 権限エラー
- `VALIDATION_ERROR_CODES` - バリデーションエラー
- `SYSTEM_ERROR_STATUS_CODES` - システムエラー
- `RETRYABLE_ERROR_CODES` - 再試行可能なエラー

#### グローバルエラー表示

`withErrorHandling()` で `showGlobalError: true` にすると、エラーが自動的にトースト表示されます。

手動でグローバルエラーを設定する場合：

```typescript
import { setError, clearError } from '$lib/errors'

const uiError = transformApiError(error)
setError(uiError, 5000) // 5秒後に自動クリア

// 手動クリア
clearError()
```

#### Sentryエラーレポート

システムエラー（5xx）は自動的にSentryへレポートされます。

手動でエラーをレポートする場合：

```typescript
import { reportError } from '$lib/monitoring/sentry'

reportError(new Error('カスタムエラー'), {
  level: 'error',
  tags: { feature: 'user-management' },
  extra: { userId: user.id }
})
```

### デバッグコマンド
```bash
# 型チェック
pnpm run check

# リント（キャッシュあり、開発時）
pnpm run lint

# リント（キャッシュなし、commit前・CI用）
pnpm run lint:ci

# テスト
pnpm run test

# ビルド確認
pnpm run build
```

### エラーテスト

開発環境では `/dev_tools/error-testing` ページで各種エラーの動作を確認できます。

- 認証エラー（401）
- 権限エラー（403）
- バリデーションエラー（400）
- システムエラー（500）
- ネットワークエラー
- タイムアウト
- カスタムエラー

**重要**: `toMessage()`, `mapStatusToTitle()` は削除済み。使用しないこと。

---

## 10.1 エラーコード一覧

このプロジェクトで使用可能なエラーコードの完全なリストです。バックエンドとフロントエンドで一致しています。

### Encore標準エラーコード

| コード | HTTPステータス | 説明 | メッセージ |
|--------|---------------|------|-----------|
| `invalid_argument` | 400 | 入力値が不正 | 入力内容に誤りがあります。ご確認ください。 |
| `not_found` | 404 | リソース不在 | 指定されたリソースが見つかりません。 |
| `already_exists` | 409 | 既に存在 | 既に登録されています。 |
| `permission_denied` | 403 | 権限不足 | この操作を実行する権限がありません。 |
| `unauthenticated` | 401 | 未認証 | ログインが必要です。再度ログインしてください。 |
| `failed_precondition` | 400 | 前提条件未充足 | 現在この操作は実行できません。 |
| `internal` | 500 | 内部エラー | サーバーエラーが発生しました。しばらく待ってから再度お試しください。 |
| `unavailable` | 503 | サービス利用不可 | サービスが一時的に利用できません。しばらく待ってからお試しください。 |
| `deadline_exceeded` | 504 | タイムアウト | 処理がタイムアウトしました。再度お試しください。 |
| `unknown` | 500 | 不明なエラー | 予期しないエラーが発生しました。 |

### ビジネス固有エラーコード

#### 認証系（ERR_AUTH_xxx）

| コード | 説明 | メッセージ | 再試行 |
|--------|------|-----------|--------|
| `ERR_AUTH_001` | 無効なトークン | 無効なトークンです。再度ログインしてください。 | 不可 |
| `ERR_AUTH_002` | トークン期限切れ | トークンの有効期限が切れています。再度ログインしてください。 | 可 |
| `ERR_AUTH_003` | リフレッシュトークン無効 | リフレッシュトークンが無効です。再度ログインしてください。 | 不可 |
| `ERR_AUTH_004` | セッション期限切れ | セッションが期限切れです。再度ログインしてください。 | 可 |
| `ERR_AUTH_005` | 認証情報不正 | メールアドレスまたはパスワードが正しくありません。 | 可 |
| `ERR_AUTH_006` | アカウントロック | アカウントがロックされています。しばらく待ってから再度お試しください。 | 可 |
| `ERR_AUTH_007` | IPブロック | このIPアドレスからのアクセスがブロックされています。 | 不可 |
| `ERR_AUTH_008` | 不審なアクティビティ | 不審なアクティビティが検出されました。セキュリティ確認が必要です。 | 不可 |

#### ユーザー系（ERR_USER_xxx）

| コード | 説明 | メッセージ | 再試行 |
|--------|------|-----------|--------|
| `ERR_USER_001` | メールアドレス重複 | このメールアドレスは既に登録されています。 | 不可 |
| `ERR_USER_002` | メールアドレス形式エラー | メールアドレスの形式が正しくありません。 | 可 |
| `ERR_USER_003` | 脆弱なパスワード | パスワードが脆弱です。より強力なパスワードを設定してください。 | 可 |
| `ERR_USER_004` | アカウント停止 | アカウントが停止されています。サポートに連絡してください。 | 不可 |
| `ERR_USER_005` | ユーザー不在 | ユーザーが見つかりません。 | 不可 |
| `ERR_USER_006` | ユーザーデータ無効 | ユーザーデータが無効です。 | 不可 |
| `ERR_USER_007` | 権限不足 | この操作を実行する権限が不足しています。 | 不可 |

#### 通知系（ERR_NOTIFICATION_xxx）

| コード | 説明 | メッセージ | 再試行 |
|--------|------|-----------|--------|
| `ERR_NOTIFICATION_001` | 送信失敗 | 通知の送信に失敗しました。 | 可 |
| `ERR_NOTIFICATION_002` | 無効な宛先 | 無効な宛先が指定されています。 | 不可 |
| `ERR_NOTIFICATION_003` | テンプレート不在 | 通知テンプレートが見つかりません。 | 不可 |
| `ERR_NOTIFICATION_004` | レート制限超過 | 通知の送信回数が制限を超えています。しばらく待ってから再度お試しください。 | 可 |
| `ERR_NOTIFICATION_005` | チャネル利用不可 | 通知チャネルが利用できません。 | 可 |

#### 開発ツール系（ERR_DEVTOOLS_xxx）

| コード | 説明 | メッセージ | 再試行 |
|--------|------|-----------|--------|
| `ERR_DEVTOOLS_001` | アクセス拒否 | この機能へのアクセスは許可されていません。 | 不可 |
| `ERR_DEVTOOLS_002` | 無効な操作 | 無効な操作です。 | 不可 |
| `ERR_DEVTOOLS_003` | リソースロック | リソースがロックされています。 | 可 |
| `ERR_DEVTOOLS_004` | 監査ログ失敗 | 監査ログの記録に失敗しました。 | 可 |
| `ERR_DEVTOOLS_005` | ストレージ操作失敗 | ストレージ操作に失敗しました。 | 可 |

#### バリデーション系（ERR_VALIDATION_xxx）

| コード | 説明 | メッセージ | 再試行 |
|--------|------|-----------|--------|
| `ERR_VALIDATION_001` | 入力値無効 | 入力値が無効です。 | 可 |
| `ERR_VALIDATION_002` | 必須フィールド未入力 | 必須フィールドが入力されていません。 | 可 |
| `ERR_VALIDATION_003` | フォーマットエラー | フォーマットエラーです。 | 可 |
| `ERR_VALIDATION_004` | 範囲外 | 値が範囲外です。 | 可 |

### エラーコードの使用方法

```typescript
import { transformApiError } from '$lib/errors'

try {
  await client.users.create(newUser)
} catch (error) {
  const uiError = transformApiError(error)

  // 特定のエラーコードで条件分岐
  switch (uiError.code) {
    case 'ERR_USER_001':
      // メールアドレス重複
      fieldError = 'このメールアドレスは既に使用されています'
      break
    case 'ERR_USER_002':
      // メールアドレス形式エラー
      fieldError = 'メールアドレスの形式が正しくありません'
      break
    default:
      // その他のエラー
      toast.error(uiError.userMessage)
  }
}
```

---

## 10.2 実装パターン

エラーハンドリングの実装パターンを紹介します。

### パターン1: グローバルエラー表示（基本）

最もシンプルな方法。エラーを自動的にトースト表示します。

```typescript
import { withErrorHandling, browserClient } from '$lib/api/client'

const client = browserClient()

async function loadData() {
  const data = await withErrorHandling(
    () => client.app.getData(),
    { showGlobalError: true }  // デフォルトで true
  )
  return data
}
```

**適用場所**:
- ほとんどのAPI呼び出し
- 削除・更新などの操作
- データ読み込み

---

### パターン2: フィールドエラー表示

フォーム入力など、特定のフィールドにエラーを表示します。

```svelte
<script lang="ts">
  import { withErrorHandling, browserClient } from '$lib/api/client'
  import type { UIError } from '$lib/errors/types'

  const client = browserClient()

  let email = $state('')
  let fieldError = $state<string | null>(null)

  async function updateEmail() {
    fieldError = null

    try {
      await withErrorHandling(
        () => client.app.updateUserEmail({ email }),
        {
          showGlobalError: false,  // グローバル表示は使わない
          onError: (uiError: UIError) => {
            // 特定のエラーコードでフィールドエラーを設定
            if (uiError.code === 'ERR_USER_001') {
              fieldError = 'このメールアドレスは既に使用されています。'
            } else if (uiError.code === 'ERR_USER_002') {
              fieldError = 'メールアドレスの形式が正しくありません。'
            } else {
              fieldError = uiError.userMessage
            }
          }
        }
      )

      // 成功時の処理
      alert('メールアドレスが更新されました')
    } catch (error) {
      // エラーはonErrorで処理済み
    }
  }
</script>

<div class="form-field">
  <label for="email">メールアドレス</label>
  <input
    id="email"
    type="email"
    bind:value={email}
    class:error={fieldError}
  />
  {#if fieldError}
    <p class="error-message">{fieldError}</p>
  {/if}
  <button onclick={updateEmail}>更新</button>
</div>
```

**適用場所**:
- フォーム送信
- バリデーションエラーの表示
- リアルタイムバリデーション

---

### パターン3: ローディング状態の管理

データ読み込み時のローディング・エラー・成功状態を管理します。

```svelte
<script lang="ts">
  import { withErrorHandling, browserClient } from '$lib/api/client'
  import type { UIError } from '$lib/errors/types'

  const client = browserClient()

  let data = $state(null)
  let isLoading = $state(false)
  let error = $state<UIError | null>(null)

  async function loadData() {
    isLoading = true
    error = null

    try {
      data = await withErrorHandling(
        () => client.app.getData(),
        {
          showGlobalError: false,  // カスタムエラー表示を使用
          onError: (uiError) => {
            error = uiError
          }
        }
      )
    } catch (e) {
      // エラーはonErrorで処理済み
    } finally {
      isLoading = false
    }
  }

  // コンポーネントマウント時にデータ読み込み
  $effect(() => {
    loadData()
  })
</script>

{#if isLoading}
  <div class="loading">読み込み中...</div>
{:else if error}
  <div class="error-box">
    <h3>エラーが発生しました</h3>
    <p>{error.userMessage}</p>
    {#if error.details?.retryable}
      <button onclick={loadData}>再試行</button>
    {/if}
  </div>
{:else if data}
  <div class="data-display">
    <!-- データ表示 -->
  </div>
{/if}
```

**適用場所**:
- データ一覧表示
- プロフィール表示
- ダッシュボード

---

### パターン4: 楽観的UI更新

UI を先に更新し、エラー時にロールバックします。

```typescript
let items = $state([...existingItems])

async function deleteItem(itemId: string) {
  // 楽観的更新
  const originalItems = [...items]
  items = items.filter(item => item.id !== itemId)

  try {
    await withErrorHandling(
      () => client.app.deleteItem({ itemId }),
      { showGlobalError: true }
    )
  } catch (error) {
    // エラー時はロールバック
    items = originalItems
  }
}
```

**適用場所**:
- 削除操作
- いいね・フォローなどの高速フィードバックが必要な操作
- リアルタイム性が重要な機能

---

### パターン5: 推奨アクションの実装

エラー時の推奨アクションを自動実行します。

```typescript
async function loadProfile() {
  try {
    const profile = await withErrorHandling(
      () => client.app.getProfile(),
      {
        showGlobalError: true,
        onError: async (uiError: UIError) => {
          // 推奨アクションの実行
          const action = uiError.details?.suggestedAction

          if (action === 'relogin') {
            // 1.5秒待ってログインページへ
            await new Promise(resolve => setTimeout(resolve, 1500))
            goto('/login')
          } else if (action === 'contact_support') {
            // サポートページへ
            await new Promise(resolve => setTimeout(resolve, 1500))
            goto('/support')
          } else if (action === 'retry_later') {
            // 3秒後に自動リトライ
            setTimeout(() => loadProfile(), 3000)
          }
        }
      }
    )

    return profile
  } catch (error) {
    // エラーは既に処理済み
  }
}
```

**適用場所**:
- 認証が必要なページ
- エラー復旧が可能な操作
- ユーザーガイダンスが必要な場面

---

## 11. セキュリティ要件

### 必須対策
- **XSS対策**: `{@html}` は必ずサニタイズ済みデータのみ
- **CSRF対策**: SvelteKitの組み込み保護を活用
- **入力検証**: Zodによる100%検証
- **機密情報**: クライアントに露出させない

### Zod検証例
```typescript
import { z } from 'zod'

const UserSchema = z.object({
	email: z.string().email(),
	username: z.string().min(3).max(20),
	age: z.number().min(0).max(120)
})

// フォーム送信時
const validated = UserSchema.parse(formData)
```

---

## 12. パフォーマンス最適化

### 必須対策
- **並列フェッチング**: Promise.allの活用
- **デバウンス**: 検索入力等で必須
- **画像最適化**: 適切なフォーマットとサイズ
- **コード分割**: 動的インポート

### デバウンス実装例
```typescript
import { createDebouncedUpdate } from '$lib/utils/data-fetching'

const search = createDebouncedUpdate(
	async (query) => await searchAPI(query),
	300 // 300ms待機
)
```

---

## 13. 作業フロー（AIの実行手順）

1. **調査フェーズ**
   - 共通コンポーネント確認
   - 既存実装パターン調査
   - ドキュメント確認

2. **設計フェーズ**
   - UI/UXの設計
   - コンポーネント構成決定（Section 4 のルールに従う）
   - API通信パターン選択

3. **実装フェーズ**
   - TypeScript型定義
   - コンポーネント作成
   - スタイリング（DaisyUI）

4. **検証フェーズ**
   - ブラウザ確認（MCP Playwright）
   - 型チェック（pnpm run check）
   - リント（pnpm run lint）

5. **修正フェーズ**
   - エラー修正
   - パフォーマンス改善
   - アクセシビリティ向上

6. **完了確認**
   - 4状態すべての動作確認
   - サイドバーメニュー追加
   - ドキュメント更新

---

## 14. クイックコマンド集

```bash
# 開発サーバー起動
pnpm run dev

# 型チェック
pnpm run check

# リント
pnpm run lint

# テスト
pnpm run test

# ビルド
pnpm run build

# SDK生成（backendディレクトリで実行）
cd ../backend && npm run gen:client

# フォーマット
pnpm run format
```

---

## 15. チェックリスト

新しい画面やコンポーネントを作成する際の必須確認項目：

- [ ] **ファイル配置ルール（Section 4）に従っている**
- [ ] generated/clientを使用してAPI通信
- [ ] 直接fetchを使用していない
- [ ] **統一エラーハンドリングシステムを使用（withErrorHandling() または transformApiError()）**
- [ ] **toMessage(), mapStatusToTitle() を使用していない（削除済み）**
- [ ] DaisyUI v5のクラスを正しく使用
- [ ] Svelte 5 Runesを使用
- [ ] TypeScript型定義完備
- [ ] 4状態（loading/error/empty/success）対応
- [ ] サイドバーメニューに追加
- [ ] エラーハンドリング実装
- [ ] invalidateAll()ではなくinvalidate()使用
- [ ] デバウンス処理（検索等）
- [ ] アクセシビリティ対応
- [ ] レスポンシブデザイン
- [ ] セキュリティ（XSS/CSRF）対策
- [ ] パフォーマンス最適化
- [ ] pnpm run lint:ci および pnpm run check が0エラー

### Sentryエラー監視のチェックリスト

Sentryの設定や動作を確認する際の必須項目：

#### 環境設定
- [ ] `.env` に `VITE_SENTRY_DSN_FRONTEND` が設定されている（任意）
- [ ] `.env` に `VITE_ENVIRONMENT` が設定されている（local/development/production）
- [ ] `package.json` の `version` フィールドが正しく設定されている

#### 初期化確認
- [ ] ブラウザコンソールで `[Sentry] ✅ Initialized successfully` が表示される
- [ ] 環境別のサンプリングレートが正しい（local: 30%, dev: 100%, prod: 10%）
- [ ] Dedupe設定が環境に応じて正しい（local/dev: 無効、prod: 有効）

#### ユーザーコンテキスト
- [ ] ログイン時に `[Sentry] User context set` が表示される
- [ ] ログアウト時に `[Sentry] User context cleared` が表示される
- [ ] Sentryダッシュボードでユーザー情報（ID、メール）が正しく記録されている

#### エラーレポート
- [ ] システムエラー（5xx）が自動的にSentryへレポートされる
- [ ] `withErrorHandling()` で `reportToSentry: true` が設定されている（デフォルト）
- [ ] カスタムエラーに `reportError()` を使用している（必要な場合）
- [ ] エラーイベントに適切なタグが設定されている（errorCode, statusCode）

#### 環境別動作
- [ ] **local**: 全エラーが送信される（Dedupe無効）、デバッグログが出力される
- [ ] **development**: 全エラーが送信される（Dedupe無効）、デバッグログが出力される
- [ ] **production**: カスタムフィンガープリントで異なるエラーを区別（Dedupe有効）

#### Session Replay
- [ ] エラー発生時のSession Replayが記録されている（100%）
- [ ] 通常セッションのReplayがサンプリングレートに従って記録されている

#### フィードバックウィジェット
- [ ] ページ上にフィードバックボタンが表示されている
- [ ] フィードバック送信が正常に動作する

#### トラブルシューティング
- [ ] DSNが未設定の場合、コンソールログのみが出力される
- [ ] 同じエラーが複数回送信されない（本番環境のみ、異なるエラーコードは別イベント）
- [ ] バックエンドAPIとの分散トレーシングが動作する（`sentry-trace`ヘッダー）

#### 開発者向けテスト
- [ ] `/dev_tools/error-testing` でエラーテストが動作する（super_admin専用）
- [ ] 各種エラーコード（401, 403, 400, 500等）のテストが成功する
- [ ] テストエラーがSentryダッシュボードに正しく記録される

詳細は `ERROR_HANDLING.md` の「Sentry統合」セクションおよび `README.md` の「Sentry エラー監視設定」セクションを参照してください。

---

## 16. 禁止事項（再掲）

### 絶対にやってはいけないこと

- ❌ 機能の削除（エラーを理由にした削除も禁止）
- ❌ 直接fetch（必ずgenerated/client使用）
- ❌ 中間APIエンドポイント作成
- ❌ .envラッパー作成
- ❌ any型の使用
- ❌ @ts-ignoreの乱用
- ❌ invalidateAll()の使用
- ❌ **toMessage(), mapStatusToTitle() の使用（削除済み、代わりに統一エラーハンドリングシステムを使用）**
- ❌ テスト未作成
- ❌ 未検証データの処理
- ❌ 機密情報のクライアント格納
- ❌ DaisyUI v3の古いクラス使用
- ❌ $derivedにアロー関数を渡す
- ❌ 質問に対して勝手に作業開始
- ❌ 代替手段の勝手な決定
- ❌ **1ファイルディレクトリの作成（Section 4）**
- ❌ **routes/(app)/api/ の作成（Section 4）**
- ❌ **曖昧なディレクトリ名の使用（Section 4）**

---

## 17. トラブルシューティング

### よくある問題と解決

#### アバターの文字が中央に配置されない
```svelte
<!-- 必ずflex items-center justify-centerを追加 -->
<div class='avatar avatar-placeholder'>
	<div class='bg-neutral text-neutral-content rounded-full w-10 flex items-center justify-center'>
		<span class='leading-none'>{initials}</span>
	</div>
</div>
```

#### APIが複数回呼ばれる
- invalidateAll()をinvalidate()に変更
- キャッシュ期間を適切に設定
- depends()の宣言を確認

#### DaisyUIのクラスが効かない
- @import "tailwindcss"と@plugin "daisyui"が同一CSSにあるか確認
- v5の正しいクラス名を使用しているか確認

#### 同じエラーが繰り返し発生
- **3回以上同じエラーが出たら作業を停止**
- 状況を報告して指示を待つ

#### ファイルをどこに配置すべきかわからない
- **Section 4 のフローチャートに従う**
- 「3箇所以上で使うか？」を基準に判断
- 迷ったら機能内に配置し、後で必要になったら lib/ へ移動

#### エラーハンドリングがうまく動作しない
- `withErrorHandling()` を使用しているか確認
- `toMessage()`, `mapStatusToTitle()` を使用していないか確認（削除済み）
- エラーコードが `lib/errors/error-codes.ts` に定義されているか確認
- `transformApiError()` で正しく `UIError` に変換されているか確認
- Sentryレポートが必要な場合は `reportToSentry: true` が設定されているか確認

#### エラーメッセージが表示されない
- `showGlobalError: true` が設定されているか確認
- `lib/stores/error.ts` の `setError()` が呼ばれているか確認
- `ErrorToast.svelte` が `(app)/+layout.svelte` に配置されているか確認
- ブラウザのコンソールでエラーを確認

#### エラーが Sentry にレポートされない

**原因1: DSN が設定されていない**

- `.env` ファイルに `VITE_SENTRY_DSN_FRONTEND` が設定されているか確認
- DSN のフォーマットは `https://xxx@o123456.ingest.sentry.io/654321` の形式
- ブラウザコンソールで初期化ログを確認：
  ```
  [Sentry] Initialized for environment: production  // DSN設定済み
  [Sentry] DSN not configured, skipping initialization  // DSN未設定
  ```

**原因2: 初期化されていない**

- `lib/monitoring/sentry.ts` の `initSentry()` が呼ばれているか確認
- `hooks.client.ts` で初期化コードが実行されているか確認

**原因3: 自動レポートの対象外**

- システムエラー（5xx）のみが自動レポートされる
- クライアントエラー（4xx）は自動レポートされない
- 手動レポートする場合は `reportError()` を使用：
  ```typescript
  import { reportError } from '$lib/monitoring/sentry'

  reportError(new Error('カスタムエラー'), {
    level: 'warning',  // 'error', 'warning', 'info'
    tags: { feature: 'user-management' },
    extra: { userId: user.id }
  })
  ```

**原因4: サンプリングレートが低い**

- 開発環境ではサンプリングレート100%に設定済み（問題なし）
- 本番環境でサンプリングレートを変更している場合は確認

---

このプロンプトに従って、実装・テスト・デバッグを行い、制約を緩めず、常に再現可能な形で作業してください。
美しいUI/UXの実現と、堅牢なコードの両立を目指します。
