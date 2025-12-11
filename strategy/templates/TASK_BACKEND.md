#prompt-template
# 要件（Backend開発専用）

本内容は「要件」と「PLANの作成」の二部構成である。要件を理解し次のPLANの作成のルールに従ってこの要件を実現する完全な計画を立ててください。

## META情報

- **機能タイトル**: <機能タイトル>
- **backendサービス名**: <サービス名>
- **エンドポイントパス**: /api/xxx
- **アクセス可能ロール**: all / admin / user
- **認証**: 必要 / 不要
- **開発対象**: **backend only**
- **port**: backend=4000

## 説明

<ここに要求を記述する>

## 条件



## 要調査



## その他ルール

- **重要**: あまり抽象度を高め過ぎず、シンプルなAPI設計をおこなう
- **重要**: 実装・確認中に 「同じエラーが２回発生」した時点で作業を中止し、本ファイルの作業ログに状況と不具合状況を記録し報告を行ってください。このループのせいでコンテキストが枯渇します。
- encore mcpを利用してバックエンド処理の開発ルール・手法を踏襲する。特にencore.devのルールは必ず守る。
- encore testは行わなくて良い。代わりにこまめに encore mcpのcall_endpointでエンドポイントを呼び出して動作を確認する。
- backend中心でテストを行う場合、encore mcpのcall_endpointで**利用シナリオ**を作成して順に実行すること。単体テストだけでは充分でないことを覚えておく。
- encore daemonに接続できない時は一回で諦め報告する。
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
   why: エラーコード体系、ビジネスエラー生成、Sentry統合
   read_also:
     - references/error-codes.md
     - references/backend-patterns.md
```

**Phase 2 - DB設計（必要に応じて）**:
```yaml
3. database-design:
   path: .claude/skills/database-design/SKILL.md
   timing: Migration作成前、テーブル設計時
   why: スキーマ分割、Extensions、段階的検索実装
   read_also:
     - references/migration-patterns.md
     - references/extensions.md
```

**Phase 3 - Backend実装（必須）**:
```yaml
4. backend-encore:
   path: .claude/skills/backend-encore/SKILL.md
   timing: API設計・実装前
   why: Encore.dev ルール、auth/expose 設計、サービス間通信
   critical: ⚠️ Encore MCP 必須（利用不可時は開発停止）
   read_also:
     - references/service-patterns.md
     - references/testing.md
     - examples/api-examples.md
```

### 🔍 Skills参照のベストプラクティス

1. **実装前に必ずSkillを読む**
   - SKILL.md の「使用タイミング」セクションを確認
   - 関連する references/ と examples/ を特定

2. **迷ったらSkillに戻る**
   - エラー処理: error-handling-system
   - Migration作成: database-design/references/migration-patterns.md
   - サービス間通信: backend-encore/references/service-patterns.md

3. **Encore MCPを優先的に使用**
   - Backend: **Encore MCP なしでは開発不可**
   - データベース: `mcp__encore__get_databases`
   - サービス情報: `mcp__encore__get_services`
   - エンドポイント呼び出し: `mcp__encore__call_endpoint`
   - トレース確認: `mcp__encore__get_traces`

### ⚠️ Critical Rules（絶対遵守）

foundation skill の Critical Rules より抜粋:

1. **既存コードの削除・置換禁止**
   - 既存機能を削除・置換しない
   - 必要な場合はユーザーに相談

2. **命名規則（Backend）**
   - **全て小文字 + スネークケース**
   - ✅ `user_service`, `get_profile`, `invoice_items`
   - ❌ `UserService`, `getProfile`, `InvoiceItems`
   - 理由: SDK生成時の整合性維持

3. **他サービス非改変**
   - あるサービス実装中は他サービスの仕様変更禁止
   - 必要なAPIは別タスクで追加

4. **サービス間通信**
   - 他サービスのテーブル直接参照禁止
   - `~encore/clients` 経由でAPI呼び出し

5. **環境変数管理**
   - `.env` 禁止、**CUE**（`.secrets.local.cue`）で管理

### Backend実装の鉄則

1. **⚠️ Encore MCP 必須チェック（開発開始前）**
   ```bash
   # 接続確認、1回で諦める
   # MCP呼び出しでエラーが出たら即座に報告
   ```
   - Encore MCP が利用できない場合: **即座に開発を停止してユーザーに通知**
   - "Encore MCP が利用できません。開発を続行できません。"

2. **命名規則の徹底**
   ```typescript
   // ✅ Good
   export const get_user_profile = api(...)
   export const update_invoice_status = api(...)

   // ❌ Bad
   export const getUserProfile = api(...)
   export const updateInvoiceStatus = api(...)
   ```

3. **サービス間通信**
   ```typescript
   // ❌ Bad: 他サービスのDB直接参照
   import { db } from "../other_service/database";
   await db.users.findOne({ id });

   // ✅ Good: ~encore/clients 経由
   import { otherService } from "~encore/clients";
   const user = await otherService.getUser({ id });
   ```

4. **テスト方針**
   - `encore test` は実行しない
   - `mcp__encore__call_endpoint` で**利用シナリオテスト**
   - 単体テストだけでは不十分、フロー全体を確認

5. **エラーハンドリング**
   ```typescript
   import {
     createValidationError,
     createBusinessError,
     createNotFoundError,
     UserErrorCode
   } from "../../shared/errors";

   // バリデーションエラー
   if (!email.includes("@")) {
     throw createValidationError("email", "Invalid email format");
   }

   // ビジネスエラー
   if (existingUser) {
     throw createBusinessError(
       UserErrorCode.EMAIL_ALREADY_EXISTS,
       "Email already exists",
       { retryable: false }
     );
   }

   // リソース不在
   const user = await db.users.findOne({ id });
   if (!user) {
     throw createNotFoundError("User", id);
   }
   ```

6. **SDK生成（Frontend連携の準備）**
   ```bash
   # API実装後は必ず実行
   npm run gen:client
   ```
   - 生成されたSDKは直接編集不可
   - API変更時は必ず再生成

7. **Migration作成（DB変更時）**
   ```bash
   cd backend/services/app
   encore db migrate create your_migration_name
   # 4桁番号で生成: 0001_xxx.up.sql
   ```

8. **Sentry統合**
   ```typescript
   import { createSentryConfig, setSentryServiceContext } from "../../config/sentry.config";
   import * as Sentry from "@sentry/node";

   // サービス起動時
   Sentry.init(createSentryConfig("auth", sentryDsn()));

   // API関数内
   export const signup = api(
     { expose: true, method: "POST", path: "/auth/signup" },
     async (params: SignupParams): Promise<SignupResponse> => {
       setSentryServiceContext("auth", "signup");
       // ... 実装
     }
   );
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

- 本内容を`PROJECT_ROOT/strategy/plans/TIMESTAMP-機能名-BACKEND-PLAN.md`に保存してください
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
- .secrets.local.cue, package.json 等

## 3. リサーチ

本実装を完璧に行うための調査を行う。

> リサーチ中は、明確なタスクを作り、必要なだけ多くのエージェント／サブエージェントをbatch tools で起動してください。シングルプロセスの場合は深く推論してください。ここでのリサーチが深いほど計画書の質は上がります。**速度ではなく成功確率を最適化すること。**

1. **Skills の完全把握**
    - **必須**: foundation, error-handling-system, backend-encore を読む
    - **必要に応じて**: database-design（DB変更がある場合）
    - 各Skill の references/ と examples/ を確認
    - Critical Rules を抽出して計画書に転記

2. **Encore MCP による調査**
    - `mcp__encore__get_services`: 既存サービス構成の把握
    - `mcp__encore__get_databases`: データベース構成の確認
    - 既存エンドポイントのパターン調査
    - 類似機能の実装方法を確認

3. **コードベースの深掘り分析**
    - 明確な ToDo を作成し、サブエージェントを起動してコードベース内の類似機能／パターンを探索する
    - 計画書で参照すべき**すべての**ファイルを特定する
    - 準拠すべき既存の命名規約・ディレクトリ規約などを洗い出す
    - 検証アプローチとして利用できる既存のテストパターンを確認

4. **外部情報の大規模調査**
    - Encore.dev の最新ドキュメント（必要に応じて）
    - PostgreSQL の最新ベストプラクティス（DB変更がある場合）
    - リサーチ結果は `PROJECT_ROOT/strategy/ai_docs` に **.md ファイル**として追加。PLAN実行時に参照する様に出力ファイルに記述。

5. **User Clarification（ユーザーへの確認）**
    - 必要であれば、疑問点を**必ず**確認して明確化を得る


## 4. PLANファイルの作成実行

### STEP 1: テンプレート選択

PLANファイルの出力形式は
`PROJECT_ROOT/strategy/templates/PLAN-FORMAT.md`
の形式に従うこと。

**Backend専用の追加要素**:
- Skills参照計画で Backend関連Skillsを明記
- Encore MCP 使用検証チェックリストを含める
- API設計セクションを詳細化
- エンドポイントテストシナリオを含める

### STEP 2: 必要コンテキストの収集

**このプロジェクトで既に決定されているコンテキスト**
必ず計画書にもパス付きで書き出す事。

- **Claude Code Skills**（Backend関連）:
  - `.claude/skills/foundation/SKILL.md`
  - `.claude/skills/error-handling-system/SKILL.md`
  - `.claude/skills/database-design/SKILL.md`（DB変更がある場合）
  - `.claude/skills/backend-encore/SKILL.md`

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
	- `PROJECT_ROOT/strategy/logs/TIMESTAMP-機能名-BACKEND-EXECUTE-LOG.md` に追記
	- 途中でプロセスを立ち上げ直しても継続できる粒度で記述すること
	- 「実装サマリ」「計画との差分」「実装時の決定事項」「テスト項目」「検証結果」などを記録

### STEP 4: ULTRATHINK - 計画書作成

1. フォーマットに従って計画書を作成する。
2. 以下の内容で品質を確認する
	- [ ] ディレクトリ確認タスクが最初にある
	- [ ] **Encore MCP 使用検証**が含まれている
	- [ ] 設計はシンプルであるか確認する
	- [ ] 現在位置確認が複数箇所に含まれている
	- [ ] 禁止事項が明確である（他サービス非改変、命名規則等）
	- [ ] タスクの成功基準が明確であること
	- [ ] **Skills参照計画**が明記されている
	- [ ] エンドポイントテストシナリオが含まれている
	- [ ] ビルド検証が途中で実施されること（`tsc` でのコンパイルチェック）
	- [ ] 参照コンテキストや参考ソースコードのパスが明確である
	- [ ] ai_docsを適切なタイミングで参照させている
	- [ ] ログファイルへの書き込み指示、ファイルパスが明記されている
	- [ ] **SDK生成手順**が含まれている（Frontend連携の準備）
3. ユーザー(私)への質問リストを作成する
4. **再確認**: 一度要求に立ち返って、本計画が妥当であるか俯瞰し問題ないことを確認する

