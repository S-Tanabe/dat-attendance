#prompt-template
# 要件（Full-stack開発）

本内容は「要件」と「PLANの作成」の二部構成である。要件を理解し次のPLANの作成のルールに従ってこの要件を実現する完全な計画を立ててください。

## META情報

- **機能タイトル**: <機能タイトル>
- **backendサービス名**: <サービス名>
- **エンドポイントパス**: /api/xxx
- **frontendルート**: /xxxx/xxxx
- **アクセス可能ロール**: all / admin / user
- **認証**: 必要 / 不要
- **開発対象**: **backend & frontend**
- **port**: backend=4000, frontend=5173

## 説明

<ここに要求を記述する>

## 条件



## 要調査



## その他ルール

- **重要**: あまり抽象度を高め過ぎず、シンプルなAPI設計をおこなう
- **重要**: 実装・確認中に 「同じエラーが２回発生」した時点で作業を中止し、本ファイルの作業ログに状況と不具合状況を記録し報告を行ってください。このループのせいでコンテキストが枯渇します。
- **実装順序**: Backend → SDK生成 → Frontend の順で実装する
- encore mcpを利用してバックエンド処理の開発ルール・手法を踏襲する。特にencore.devのルールは必ず守る。
- encore testは行わなくて良い。代わりにこまめに encore mcpのcall_endpointでエンドポイントを呼び出して動作を確認する。
- UIの作成・修正を行う場合、最初にPlaywright MCPを使ってUI表示を行う。フロントエンドサーバーはホットリロードがかかるので修正・即確認を行う
- backend中心でテストを行う場合、encore mcpのcall_endpointで**利用シナリオ**を作成して順に実行すること。単体テストだけでは充分でないことを覚えておく。
- encore daemonに接続できない時は一回で諦め報告する。
- backend/frontendの起動は行わなくて良い。起動を確認して起動していなければ依頼する。自分で起動しない。

## Skills活用ガイド

### 📚 必読Skills（実装開始前）

**Phase 1 - 基盤理解（必須・開始時）**:
```yaml
1. foundation:
   path: .claude/skills/foundation/SKILL.md
   timing: 最初に必ず読む
   why: プロジェクト全体の基盤原則、Critical Rules
   read_also:
     - references/critical-rules.md
     - references/mcp-tools.md
```

**Phase 2 - 設計フェーズ（Backend/Frontend共通）**:
```yaml
2. error-handling-system:
   path: .claude/skills/error-handling-system/SKILL.md
   timing: 設計開始前
   why: Backend→Frontend エラーフロー全体の理解
   read_also:
     - references/error-codes.md
     - references/backend-patterns.md
     - references/frontend-patterns.md

3. database-design:
   path: .claude/skills/database-design/SKILL.md
   timing: DB設計が必要な場合
   why: スキーマ分割、Extensions、Migration作成
   read_also:
     - references/migration-patterns.md
     - references/extensions.md
```

**Phase 3 - Backend実装（必須）**:
```yaml
4. backend-encore:
   path: .claude/skills/backend-encore/SKILL.md
   timing: API実装前
   why: Encore.dev ルール、auth/expose 設計、サービス間通信
   critical: ⚠️ Encore MCP 必須（利用不可時は開発停止）
   read_also:
     - references/service-patterns.md
     - references/testing.md
     - examples/api-examples.md
```

**Phase 4 - Frontend実装（必須）**:
```yaml
5. frontend-sveltekit:
   path: .claude/skills/frontend-sveltekit/SKILL.md
   timing: UI実装前
   why: Svelte 5 Runes、DaisyUI v5、Colocation原則、状態管理
   critical: ⚠️ Svelte MCP 必須（Runes構文を必ず確認）
   read_also:
     - references/workflows.md
     - references/state-management.md
     - references/colocation-rules.md
     - references/api-communication.md
     - examples/implementation-patterns.md
```

**Phase 5 - 統合（検証フェーズ）**:
```yaml
統合検証:
  - Backend: encore mcpのcall_endpointでシナリオテスト
  - Frontend: Playwright MCPで結合テスト
  - エラーフロー: error-handling-system の動作確認
  - SDK再生成: npm run gen:client の実行確認
```

### 🔍 Skills参照のベストプラクティス

1. **実装前に必ずSkillを読む**
   - SKILL.md の「使用タイミング」セクションを確認
   - 関連する references/ と examples/ を特定

2. **迷ったらSkillに戻る**
   - Backend実装: backend-encore/references/service-patterns.md
   - Frontend実装: frontend-sveltekit/references/implementation-patterns.md
   - エラー処理: error-handling-system
   - DB設計: database-design/references/migration-patterns.md

3. **MCPを優先的に使用**
   - **Encore MCP 必須**: Backend開発に不可欠
     - `mcp__encore__get_services`, `mcp__encore__get_databases`
     - `mcp__encore__call_endpoint`（シナリオテスト）
     - `mcp__encore__get_traces`（トレース確認）
   - **Svelte MCP 必須**: AI は Runes 構文を間違える
     - `mcp__svelte__list-sections()`
     - `mcp__svelte__get-documentation({ section: [...] })`
     - `mcp__svelte__svelte-autofixer(...)`
   - **Playwright MCP 必須**: UI確認
     - `mcp__playwright__browser_navigate(...)`
     - `mcp__playwright__browser_snapshot()`

### ⚠️ Critical Rules（絶対遵守）

foundation skill の Critical Rules より抜粋:

1. **既存コードの削除・置換禁止**
   - 既存機能を削除・置換しない
   - 必要な場合はユーザーに相談

2. **命名規則**
   - **Backend**: 小文字スネークケース
     - ✅ `user_service`, `get_profile`, `invoice_items`
     - ❌ `UserService`, `getProfile`, `InvoiceItems`
   - **Frontend**: キャメルケース（変数・関数）、パスカルケース（コンポーネント）
     - ✅ `getUserProfile()`, `UserCard.svelte`, `isLoggedIn`
     - ❌ `get_user_profile()`, `user-card.svelte`

3. **実装順序の厳守**
   - Backend実装 → SDK生成 → Frontend実装
   - 理由: Frontend は生成されたSDKに依存

4. **他サービス非改変（Backend）**
   - あるサービス実装中は他サービスの仕様変更禁止
   - サービス間通信は `~encore/clients` 経由のみ

5. **Colocation原則（Frontend）**
   - 3箇所以上で使用 → `src/lib/`
   - 機能専用 → `routes/(app)/[機能名]/`

6. **invalidateAll() 禁止（Frontend）**
   - 特定データのみ再取得: `invalidate('app:...')`

### Full-stack開発の鉄則

1. **⚠️ MCP必須チェック（開発開始前）**
   ```yaml
   Backend:
     - Encore MCP にアクセス可能か確認
     - 利用不可の場合: 即座に開発停止・ユーザー通知

   Frontend:
     - Svelte MCP にアクセス可能か確認
     - Playwright MCP にアクセス可能か確認
     - 利用不可の場合: 即座に開発停止・ユーザー通知
   ```

2. **実装フローの厳守**
   ```
   Phase 1: Backend実装
     1. DB設計・Migration作成（必要な場合）
     2. API実装（Encore.dev）
     3. エラーハンドリング実装
     4. encore call_endpoint でテスト

   Phase 2: SDK生成
     1. npm run gen:client 実行
     2. 生成ファイル確認

   Phase 3: Frontend実装
     1. 生成されたSDK確認
     2. コンポーネント設計・配置計画
     3. UI実装（Svelte 5 Runes）
     4. API通信実装（withErrorHandling）
     5. Playwright MCP で UI 確認

   Phase 4: 統合テスト
     1. Backend: シナリオテスト（call_endpoint）
     2. Frontend: UI操作テスト（Playwright）
     3. エラーフロー確認（Backend→Frontend）
   ```

3. **エラーハンドリングの統合確認**
   ```typescript
   // Backend: エラー生成
   throw createBusinessError(
     UserErrorCode.EMAIL_ALREADY_EXISTS,
     "Email already exists",
     { retryable: false }
   )

   // Frontend: エラー表示
   await withErrorHandling(
     () => client.users.signup({ email }),
     { showGlobalError: true }  // トースト自動表示
   )
   ```

4. **SDK生成と連携確認**
   ```bash
   # Backend API実装後
   cd backend
   npm run gen:client

   # Frontend で生成されたSDK確認
   cd ../frontend
   ls -la src/lib/generated/client.ts

   # 型チェックで確認
   pnpm run check
   ```

5. **統合テスト戦略**
   ```yaml
   Backend テスト:
     tool: mcp__encore__call_endpoint
     scenario:
       - 正常系: データ作成・取得・更新・削除
       - 異常系: バリデーションエラー、ビジネスエラー
       - 認証: 認証必須エンドポイントの動作確認

   Frontend テスト:
     tool: mcp__playwright__*
     scenario:
       - ページ表示: 初期表示、ローディング、データ表示
       - ユーザー操作: フォーム入力、ボタンクリック、遷移
       - エラー表示: トースト、フィールドエラー、エラー画面
       - レスポンシブ: モバイル・デスクトップ表示

   統合テスト:
     - Backend→Frontend エラー伝搬
     - 認証フロー全体
     - データの整合性
   ```

6. **検証チェックリスト**
   ```yaml
   Backend:
     - [ ] 命名規則: 小文字スネークケース
     - [ ] エラーハンドリング: 統一システム使用
     - [ ] サービス間通信: ~encore/clients 使用
     - [ ] encore call_endpoint でテスト完了

   Frontend:
     - [ ] 命名規則: キャメル/パスカルケース
     - [ ] Colocation原則: 正しいファイル配置
     - [ ] Svelte 5 Runes: MCP で構文確認
     - [ ] invalidate: invalidateAll()未使用
     - [ ] pnpm run check: 0エラー
     - [ ] pnpm run lint:ci: 0エラー
     - [ ] Playwright MCP: UI確認完了

   統合:
     - [ ] SDK生成: 成功
     - [ ] エラーフロー: Backend→Frontend 正常動作
     - [ ] 認証: 全フロー動作
     - [ ] シナリオテスト: 全パターン確認
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

- 本内容を`PROJECT_ROOT/strategy/plans/TIMESTAMP-機能名-FULLSTACK-PLAN.md`に保存してください
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
- backend: .secrets.local.cue, package.json
- frontend: package.json, eslint.config.js, .lintstagedrc.json

## 3. リサーチ

本実装を完璧に行うための調査を行う。

> リサーチ中は、明確なタスクを作り、必要なだけ多くのエージェント／サブエージェントをbatch tools で起動してください。シングルプロセスの場合は深く推論してください。ここでのリサーチが深いほど計画書の質は上がります。**速度ではなく成功確率を最適化すること。**

1. **Skills の完全把握**
    - **必須**: 全5つのSkillsを段階的に読む
      - foundation（基盤）
      - error-handling-system（エラー統合）
      - database-design（DB設計、必要に応じて）
      - backend-encore（Backend実装）
      - frontend-sveltekit（Frontend実装）
    - 各Skill の references/ と examples/ を確認
    - Critical Rules を抽出して計画書に転記

2. **Encore MCP による Backend 調査**
    - `mcp__encore__get_services`: 既存サービス構成
    - `mcp__encore__get_databases`: データベース構成
    - 既存エンドポイントのパターン調査
    - 類似機能の実装方法を確認

3. **Svelte MCP による Frontend 調査**
    - `mcp__svelte__list-sections()`: 利用可能なドキュメントセクション
    - `mcp__svelte__get-documentation({ section: [...] })`: Runes構文・状態管理・ルーティング
    - 既存コンポーネントの配置パターン確認

4. **コードベースの深掘り分析**
    - 明確な ToDo を作成し、サブエージェントを起動してコードベース内の類似機能／パターンを探索する
    - Backend: 既存サービスのAPI設計パターン
    - Frontend: 既存コンポーネントの配置・状態管理パターン
    - 計画書で参照すべき**すべての**ファイルを特定する

5. **外部情報の大規模調査**
    - Encore.dev の最新ドキュメント（必要に応じて）
    - SvelteKit v2 / Svelte 5 の最新情報（必要に応じて）
    - 実装が必要なUI/UXを最新で評判の良い類似サービスを中心に調査する
    - リサーチ結果は `PROJECT_ROOT/strategy/ai_docs` に **.md ファイル**として追加

6. **User Clarification（ユーザーへの確認）**
    - 必要であれば、疑問点を**必ず**確認して明確化を得る


## 4. PLANファイルの作成実行

### STEP 1: テンプレート選択

PLANファイルの出力形式は
`PROJECT_ROOT/strategy/templates/PLAN-FORMAT.md`
の形式に従うこと。

**Full-stack専用の追加要素**:
- Skills参照計画で全Skillsを段階的に明記
- Encore MCP + Svelte MCP + Playwright MCP 使用検証チェックリスト
- Backend → Frontend の実装順序を明確化
- SDK生成タイミングを明記
- 統合テストシナリオを含める

### STEP 2: 必要コンテキストの収集

**このプロジェクトで既に決定されているコンテキスト**
必ず計画書にもパス付きで書き出す事。

- **Claude Code Skills**（全Skill）:
  - `.claude/skills/foundation/SKILL.md`
  - `.claude/skills/error-handling-system/SKILL.md`
  - `.claude/skills/database-design/SKILL.md`（DB変更がある場合）
  - `.claude/skills/backend-encore/SKILL.md`
  - `.claude/skills/frontend-sveltekit/SKILL.md`
  - 全 references/ と examples/

- プロジェクト内にあるMDファイルの中で本実装に必要なドキュメント

### STEP 3: 計画書の準備

計画書を作成する前に以下の準備を行う

1. ここまでの調査内容のマージ
2. 指定された要件情報を完全な仕様書に変換し計画書に書き込む準備
3. 作業フェーズの設定（Backend → SDK → Frontend → 統合）
4. 作業フェーズごとの検証ゲートの設定
5. 包括的な実装計画を決定
6. ツール、コマンド、MCP等の利用方法や利用許可について定義
7. 進捗ログの定義を確認
	- `PROJECT_ROOT/strategy/logs/TIMESTAMP-機能名-FULLSTACK-EXECUTE-LOG.md` に追記
	- 途中でプロセスを立ち上げ直しても継続できる粒度で記述すること

### STEP 4: ULTRATHINK - 計画書作成

1. フォーマットに従って計画書を作成する。
2. 以下の内容で品質を確認する
	- [ ] ディレクトリ確認タスクが最初にある
	- [ ] **全MCP使用検証**（Encore + Svelte + Playwright）が含まれている
	- [ ] 設計はシンプルであるか確認する
	- [ ] 現在位置確認が複数箇所に含まれている
	- [ ] 禁止事項が明確である（両方の命名規則、Colocation原則等）
	- [ ] **Backend → Frontend の実装順序**が明確
	- [ ] **SDK生成タイミング**が明記されている
	- [ ] タスクの成功基準が明確であること
	- [ ] **Skills参照計画**（全Skill）が段階的に明記されている
	- [ ] **統合テストシナリオ**が含まれている
	- [ ] ビルド検証が途中で実施されること（Backend: `tsc`, Frontend: `pnpm run check`）
	- [ ] 参照コンテキストや参考ソースコードのパスが明確である
	- [ ] ai_docsを適切なタイミングで参照させている
	- [ ] ログファイルへの書き込み指示、ファイルパスが明記されている
3. ユーザー(私)への質問リストを作成する
4. **再確認**: 一度要求に立ち返って、本計画が妥当であるか俯瞰し問題ないことを確認する

