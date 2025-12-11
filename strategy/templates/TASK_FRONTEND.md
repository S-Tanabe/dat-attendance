#prompt-template
# 要件（Frontend開発専用）

本内容は「要件」と「PLANの作成」の二部構成である。要件を理解し次のPLANの作成のルールに従ってこの要件を実現する完全な計画を立ててください。

## META情報

- **機能タイトル**: <機能タイトル>
- **frontendルート**: /xxxx/xxxx
- **アクセス可能ロール**: all / admin / user
- **認証**: 必要 / 不要
- **開発対象**: **frontend only**
- **port**: frontend=5173

## 説明

<ここに要求を記述する>

## 条件



## 要調査



## その他ルール

- **重要**: 実装・確認中に 「同じエラーが２回発生」した時点で作業を中止し、本ファイルの作業ログに状況と不具合状況を記録し報告を行ってください。このループのせいでコンテキストが枯渇します。
- frontend/AGENTS.md（削除済み、Skillsに統合）の内容を踏襲する
- UIの作成・修正を行う場合、最初にPlaywright MCPを使ってUI表示を行う。フロントエンドサーバーはホットリロードがかかるので修正・即確認を行う
- backend/frontendの起動は行わなくて良い。起動を確認して起動していなければ依頼する。自分で起動しない。

## Skills活用ガイド

### 📚 必読Skills（実装開始前）

**Phase 1 - 基盤理解（必須）**:
```yaml
1. foundation:
   path: .claude/skills/foundation/SKILL.md
   timing: 最初に必ず読む
   why: Critical Rules、命名規則、ファイル配置原則の把握
   read_also:
     - references/critical-rules.md
     - references/mcp-tools.md

2. error-handling-system:
   path: .claude/skills/error-handling-system/SKILL.md
   timing: 実装開始前
   why: Frontend エラー表示、変換ロジック、トースト表示
   read_also:
     - references/frontend-patterns.md
     - examples/error-display.md
```

**Phase 2 - Frontend実装準備（必須）**:
```yaml
3. frontend-sveltekit:
   path: .claude/skills/frontend-sveltekit/SKILL.md
   timing: コンポーネント設計前
   why: Svelte 5 Runes、DaisyUI v5、Colocation原則、状態管理
   critical: ⚠️ Svelte MCP 必須（Runes構文を必ず確認）
   read_also:
     - references/workflows.md（開発コマンド・チェックリスト）
     - references/state-management.md（状態管理手法選択）
     - references/colocation-rules.md（ファイル配置判断）
     - references/api-communication.md（API呼び出しパターン）
     - examples/implementation-patterns.md（実装パターン集）
```

### 🔍 Skills参照のベストプラクティス

1. **実装前に必ずSkillを読む**
   - SKILL.md の「使用タイミング」セクションを確認
   - 関連する references/ と examples/ を特定

2. **迷ったらSkillに戻る**
   - ファイル配置: frontend-sveltekit/references/colocation-rules.md
   - 状態管理: frontend-sveltekit/references/state-management.md
   - エラー処理: error-handling-system + frontend-sveltekit/references/api-communication.md

3. **MCPを優先的に使用**
   - **Svelte MCP 必須**: AI は Svelte 5 Runes を間違える（学習データが v3/v4）
     - `mcp__svelte__list-sections()` でセクション一覧
     - `mcp__svelte__get-documentation({ section: ["$state", "$effect", ...] })` で詳細取得
     - `mcp__svelte__svelte-autofixer({ code, desired_svelte_version: 5 })` でコード検証
   - **Playwright MCP 必須**: UI確認（ホットリロード活用）
     - `mcp__playwright__browser_navigate({ url: 'http://localhost:5173' })`
     - `mcp__playwright__browser_snapshot()`
     - `mcp__playwright__browser_click/type/...` で操作確認

### ⚠️ Critical Rules（絶対遵守）

foundation skill の Critical Rules より抜粋:

1. **既存コードの削除・置換禁止**
   - 既存機能を削除・置換しない
   - 必要な場合はユーザーに相談

2. **命名規則（Frontend）**
   - **キャメルケース（変数・関数）、パスカルケース（コンポーネント）**
   - ✅ `getUserProfile()`, `UserCard.svelte`, `isLoggedIn`
   - ❌ `get_user_profile()`, `user-card.svelte`

3. **ファイル配置（Colocation原則）**
   - **3箇所以上で使用** → `src/lib/`
   - **機能専用** → `routes/(app)/[機能名]/`
   - **1ファイルディレクトリ禁止**
   - **曖昧なディレクトリ名禁止**（`utils`, `helpers`, `common`）

4. **ESLint Flat Config**
   - `eslint.config.js` を使用（`.eslintrc.cjs` ではない）
   - `@antfu/eslint-config` を使用（Prettier 不要）

5. **lint-staged 自動実行**
   - Git commit 時に自動でリント実行
   - エラーがあればコミット中断

### Frontend実装の鉄則

1. **⚠️ Svelte MCP 必須使用（開発開始前）**
   - AI は **Svelte 5 Runes を間違える**（学習データが v3/v4 のため）
   - 実装前に必ず MCP でドキュメント取得
   ```typescript
   // 1. セクション一覧確認
   mcp__svelte__list-sections()

   // 2. 必要なセクションを全て取得
   mcp__svelte__get-documentation({
     section: ["$state", "$derived", "$effect", "$props", "load functions", ...]
   })

   // 3. コード検証（実装後）
   mcp__svelte__svelte-autofixer({
     code: "...",
     desired_svelte_version: 5,
     filename: "Component.svelte"
   })
   ```
   - Svelte MCP が利用できない場合: **即座に開発を停止してユーザーに通知**
   - "Svelte MCP が利用できません。開発を続行できません。"

2. **⚠️ Playwright MCP で UI 確認（必須）**
   ```typescript
   // 1. ページ表示
   mcp__playwright__browser_navigate({ url: 'http://localhost:5173/your-route' })

   // 2. スナップショット確認
   mcp__playwright__browser_snapshot()

   // 3. 操作確認
   mcp__playwright__browser_click({ element: 'Button', ref: 'button[type=submit]' })
   mcp__playwright__browser_type({ element: 'Input', ref: 'input#email', text: 'test@example.com' })

   // 4. スクリーンショット保存
   mcp__playwright__browser_take_screenshot({ filename: 'feature-screenshot.png' })
   ```
   - ホットリロードで即座に反映確認
   - コンソールエラー確認: `mcp__playwright__browser_console_messages({ onlyErrors: true })`
   - ネットワークリクエスト確認: `mcp__playwright__browser_network_requests()`

3. **Colocation原則の厳守**
   ```
   ✅ Good:
   src/lib/components/ui/Button.svelte        # 複数箇所で使用
   routes/(app)/users/components/UserCard.svelte  # users機能専用

   ❌ Bad:
   src/lib/utils/UserCard.svelte              # 曖昧な配置
   routes/(app)/users/UserCard/UserCard.svelte  # 1ファイルディレクトリ
   ```

4. **状態管理の優先順位**
   ```typescript
   // 1. ローカル状態（Runes）
   let count = $state(0)
   const doubled = $derived(count * 2)

   // 2. URL状態（searchParams）
   $: currentPage = Number($page.url.searchParams.get('page') || '1')

   // 3. サーバー状態（load + invalidate）
   export async function load(event) {
     event.depends('app:users')  // 依存関係宣言
     return { users: await client.users.list() }
   }
   await invalidate('app:users')  // 特定データのみ再取得

   // 4. Context API（プロップドリリング回避）
   setContext('theme', { theme })

   // 5. stores（最小限・グローバル状態のみ）
   export const toast = createToastStore()
   ```

5. **invalidateAll() 禁止**
   ```typescript
   // ❌ Bad: 全てのload関数が再実行される
   await invalidateAll()

   // ✅ Good: 特定のdependsのみ再実行
   await invalidate('app:users')
   ```

6. **API通信（統一エラーハンドリング）**
   ```typescript
   import { withErrorHandling, serverClient } from '$lib/api/client'

   // グローバルエラー表示（デフォルト）
   const data = await withErrorHandling(
     () => client.app.getData(),
     { showGlobalError: true }
   )

   // フィールドエラー表示
   let fieldError = $state<string | null>(null)
   await withErrorHandling(
     () => client.app.updateEmail({ email }),
     {
       showGlobalError: false,
       onError: (uiError) => {
         fieldError = uiError.userMessage
       }
     }
   )
   ```

7. **リント・型チェック（commit前必須）**
   ```bash
   # 型チェック
   pnpm run check

   # リント（キャッシュなし、commit前・CI用）
   pnpm run lint:ci

   # リント + 自動修正
   pnpm run lint:fix

   # lint-staged が commit 時に自動実行
   # エラーがあればコミット中断
   ```

8. **Svelte 5 Runes の注意点**
   ```typescript
   // ✅ Good: $derived は値を直接返す
   const doubled = $derived(count * 2)

   // ❌ Bad: アロー関数を渡さない
   const doubled = $derived(() => count * 2)

   // ✅ Good: $effect の cleanup
   $effect(() => {
     const timer = setInterval(() => { ... }, 1000)
     return () => clearInterval(timer)  // cleanup
   })
   ```

9. **DaisyUI v5 の注意点**
   ```svelte
   <!-- ✅ Good: join + join-item -->
   <div class="join">
     <button class="join-item btn">Button 1</button>
     <button class="join-item btn">Button 2</button>
   </div>

   <!-- ❌ Bad: btn-group (v4のクラス) -->
   <div class="btn-group">
     <button class="btn">Button 1</button>
   </div>

   <!-- ✅ Good: アバターに flex items-center justify-center -->
   <div class="avatar flex items-center justify-center">
     <div class="w-24 rounded-full">
       <img src="..." alt="..." />
     </div>
   </div>
   ```

10. **SDK使用（Backend API呼び出し）**
    ```typescript
    // ✅ Good: generated/client 経由
    import { serverClient } from '$lib/api/client'
    const client = serverClient(event)
    const users = await client.users.list()

    // ❌ Bad: fetch を直接使用
    const response = await fetch('/api/users')
    ```

---

# PLANの作成

上記の内容を実現化するための完全な計画書を作成する。
計画書はAIが実行できるコンテキストとして作成することで別のプロセスのAIがこの内容を以て実装を行う。

__※ 本指示は一部「サブエージェント」などCLAUDE CODE専用の指示があります。適宜読み替えてください。__

## 1. 前提

要件からシステムの本質を理解し、適切な技術選択と実現計画を作成する。

重要: 本計画を実行するAIが参照できるのは以下だけである事を前提に作成する。
	- **Claude Code Skills**（.claude/skills/配下の各Skill）
	- プロジェクト内にあるドキュメント(mdファイル)
	- あなたがこれから作成する計画ファイル
	- コードベースのファイルへのアクセス（ただし、どれを参照すべきかのガイダンスが必要）
	- モデルのトレーニングデータ

**したがって**：あなたのリサーチとコンテキストの整備が、実装成功を**直接**左右する。不完全な「コンテキスト = 実装失敗」となる。これらの情報のみで実装が完了する情報を余す事なく記述する事。

- 本内容を`PROJECT_ROOT/strategy/plans/TIMESTAMP-機能名-FRONTEND-PLAN.md`に保存してください
- **コンテキストゼロから再開できる事**: 作業はプロセス再起動後も今回作成するPLANファイルを見れば元の指示からプランまで全てが１つのファイルで理解できるように、要求・開発ルール、参考情報など必要な内容は全て転記してください。今回の指示や情報提供はこの１度きりしか行いません。

## 2. 実行前の準備・プロジェクト理解

### 構造理解

1. **現在位置の確認**
```bash
pwd  # 現在のディレクトリを確認
ls -la  # ディレクトリ内容を確認
```

2. **プロジェクト構造の把握**
```bash
tree -L 2 -a  # プロジェクト全体構造を確認（隠しファイル含む）
```

3. **設定ファイルによる状態確認**
- package.json, eslint.config.js, .lintstagedrc.json 等

## 3. リサーチ

本実装を完璧に行うための調査を行う。

> リサーチ中は、明確なタスクを作り、必要なだけ多くのエージェント／サブエージェントをbatch tools で起動してください。シングルプロセスの場合は深く推論してください。ここでのリサーチが深いほど計画書の質は上がります。**速度ではなく成功確率を最適化すること。**

1. **Skills の完全把握**
    - **必須**: foundation, error-handling-system, frontend-sveltekit を読む
    - frontend-sveltekit の全 references/ と examples/ を確認
    - Critical Rules を抽出して計画書に転記

2. **Svelte MCP による調査**
    - `mcp__svelte__list-sections()`: 利用可能なドキュメントセクション一覧
    - `mcp__svelte__get-documentation({ section: [...] })`: 必要なセクションを全て取得
    - Runes 構文、状態管理、ルーティングの最新情報を確認

3. **コードベースの深掘り分析**
    - 明確な ToDo を作成し、サブエージェントを起動してコードベース内の類似機能／パターンを探索する
    - 既存コンポーネントの配置パターンを確認（lib/ vs routes/）
    - 準拠すべき既存の命名規約・ディレクトリ規約などを洗い出す
    - 既存の状態管理パターン（load関数、stores、Context API）を確認

4. **外部情報の大規模調査**
    - SvelteKit v2 の最新ドキュメント（必要に応じて）
    - DaisyUI v5 の最新コンポーネント（必要に応じて）
    - 実装が必要なUI/UXを最新で評判の良い類似サービスを中心に調査する
    - リサーチ結果は `PROJECT_ROOT/strategy/ai_docs` に **.md ファイル**として追加。PLAN実行時に参照する様に出力ファイルに記述。

5. **User Clarification（ユーザーへの確認）**
    - 必要であれば、疑問点を**必ず**確認して明確化を得る


## 4. PLANファイルの作成実行

### STEP 1: テンプレート選択

PLANファイルの出力形式は
`PROJECT_ROOT/strategy/templates/PLAN-FORMAT.md`
の形式に従うこと。

**Frontend専用の追加要素**:
- Skills参照計画で Frontend関連Skillsを明記
- Svelte MCP + Playwright MCP 使用検証チェックリストを含める
- コンポーネント設計セクションを詳細化
- ファイル配置計画（Colocation原則）を含める
- UI確認シナリオを含める

### STEP 2: 必要コンテキストの収集

**このプロジェクトで既に決定されているコンテキスト**
必ず計画書にもパス付きで書き出す事。

- **Claude Code Skills**（Frontend関連）:
  - `.claude/skills/foundation/SKILL.md`
  - `.claude/skills/error-handling-system/SKILL.md`
  - `.claude/skills/frontend-sveltekit/SKILL.md`
  - 全 references/ と examples/

- プロジェクト内にあるMDファイルの中で本実装に必要なドキュメント

### STEP 3: 計画書の準備

計画書を作成する前に以下の準備を行う

1. ここまでの調査内容のマージ
2. 指定された要件情報を完全な仕様書に変換し計画書に書き込む準備
3. 作業フェーズの設定
4. 作業フェーズごとの検証ゲートの設定(何を持ってゴールとするか、どうやって確認するか)
5. 包括的な実装計画を決定
6. ツール、コマンド、MCP等の利用方法や利用許可について定義
7. 進捗ログの定義を確認
	- `PROJECT_ROOT/strategy/logs/TIMESTAMP-機能名-FRONTEND-EXECUTE-LOG.md` に追記
	- 途中でプロセスを立ち上げ直しても継続できる粒度で記述すること
	- 「実装サマリ」「計画との差分」「実装時の決定事項」「テスト項目」「検証結果」などを記録

### STEP 4: ULTRATHINK - 計画書作成

1. フォーマットに従って計画書を作成する。
2. 以下の内容で品質を確認する
	- [ ] ディレクトリ確認タスクが最初にある
	- [ ] **Svelte MCP + Playwright MCP 使用検証**が含まれている
	- [ ] 設計はシンプルであるか確認する
	- [ ] 現在位置確認が複数箇所に含まれている
	- [ ] 禁止事項が明確である（invalidateAll禁止、Colocation原則等）
	- [ ] タスクの成功基準が明確であること
	- [ ] **Skills参照計画**が明記されている
	- [ ] **ファイル配置計画**（Colocation原則）が含まれている
	- [ ] **UI確認シナリオ**（Playwright MCP）が含まれている
	- [ ] ビルド検証が途中で実施されること（`pnpm run check`, `pnpm run lint:ci`）
	- [ ] 参照コンテキストや参考ソースコードのパスが明確である
	- [ ] ai_docsを適切なタイミングで参照させている
	- [ ] ログファイルへの書き込み指示、ファイルパスが明記されている
	- [ ] **4状態（loading/error/empty/success）対応**が含まれている
3. ユーザー(私)への質問リストを作成する
4. **再確認**: 一度要求に立ち返って、本計画が妥当であるか俯瞰し問題ないことを確認する

