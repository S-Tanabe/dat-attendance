---
name: foundation
description: |
  【日本語】プロジェクトの基盤原則と絶対的禁止事項。実装開始前の強制調査プロセス、MCP 優先使用ルール、削除禁止・代替手段禁止・ESLint ルール変更禁止などの Critical Rules を定義。全ての開発タスクを開始する前に必ず参照し、プロジェクトの品質と一貫性を維持する。
  
  【WHEN to use】
  - 実装タスク・機能追加を開始する直前
  - 既存コードを修正・削除する前
  - エラー対応で代替案検討時
  - ユーザー要求に応じて既存機能の変更を検討するとき
  
  【WHEN NOT to use】
  - ドキュメント修正のみ（README等の説明文更新）
  - デバッグやトラブルシューティング中の情報検索（error-handling-system を使用）
  
  【TRIGGER keywords】
  実装開始、エラー解決、機能追加、既存削除、リファクタ、ESLint違反、代替手段検討、コード修正
allowed-tools: Read, Grep, Glob
---


# Foundation: プロジェクト基盤原則

このスキルは、プロジェクトの基盤原則を定義します。

**重要:** プロジェクト固有の情報（目的、スコープ、技術スタック、テストアカウント等）は、プロジェクトのドキュメント（CLAUDE.md や PROJECT.md など）に記載されています。

---

## 🏗️ テンプレートベース開発

**このプロジェクトは dashboard-accelerator テンプレート上に構築されています。**

### テンプレートが提供する機能

dashboard-acceleratorは管理画面系に特化したテンプレートで、以下の機能を予め実装済みです：

- **認証・認可システム** (JWT + Session + RBAC)
- **通知システム** (SSE リアルタイム通知)
- **基本UIレイアウト** (Header, Sidebar, Toast)
- **APIラッパー** (自動リフレッシュ、エラーハンドリング統合)
- **統一エラーハンドリング** (Backend + Frontend)
- **データベース設計パターン** (スキーマ分割、高度検索)
- **品質チェック機構** (ESLint + SvelteCheck + pre-commit hooks)
- **監視・ロギング** (Sentry統合)

### 実装開始前の必須確認フロー

```
Step 1: foundation-catalog で既存機能を確認
   ↓
Step 2: 該当する foundation-* スキルで詳細パターン確認
   ↓
Step 3: 既存機能を最大限再利用
   ↓
Step 4: テンプレート制約に従って実装
```

**重要**: 新機能実装前に必ず **foundation-catalog** スキルを参照し、既存機能の再利用可能性を確認してください。

### テンプレート提供スキル一覧

| スキル | 提供内容 | 使用タイミング |
|--------|---------|-------------|
| **foundation-catalog** | 全機能の索引 | 実装開始前（必須） |
| **foundation-auth** | 認証・認可パターン | ログイン、権限管理実装時 |
| **foundation-api** | API通信パターン | Backend通信実装時 |
| **foundation-components** | UIコンポーネント | UI実装時 |
| **foundation-database** | DB設計パターン | スキーマ設計、Migration作成時 |
| **foundation-error-handling** | エラー処理 | エラーハンドリング実装時 |
| **foundation-notification** | 通知システム | 通知機能実装時 |
| **foundation-monitoring** | 監視・ロギング | Sentry設定時 |
| **foundation-testing** | テストパターン | テスト作成時 |

---

## 🎯 技術スタック（汎用）

- **Backend**: Encore.dev (TypeScript)
- **Frontend**: SvelteKit v2 + Svelte 5 Runes
- **UI**: DaisyUI v5 + Tailwind CSS v4
- **Database**: PostgreSQL
- **Monitoring**: Sentry

---

## 📁 標準的なプロジェクト構成

```
project-root/
├── backend/              # Encore.dev TypeScript バックエンド
│   ├── services/        # マイクロサービス群
│   │   ├── auth/        # 認証サービス（auth.auth_users）
│   │   ├── app/         # 業務サービス（app_users + ビジネスロジック）
│   │   ├── notification/# 通知サービス
│   │   └── dev_tools/   # 開発ツール
│   └── shared/         # 共有モジュール（errors, monitoring）
├── frontend/            # SvelteKit フロントエンド
│   ├── src/
│   │   ├── lib/        # ライブラリ（API, errors, stores, components）
│   │   └── routes/     # ページルート
└── .claude/skills/     # Claude Code skills（このディレクトリ）
```

**ユーザー管理の構造:**
- **auth_users**: 認証専用（authサービスが管理、authデータベース内）
- **app_users**: アプリケーション用（appサービスが管理、appデータベース内）
  - auth_usersと同じIDで自動作成
  - 実案件で拡張可能なベーステーブル
  - 基本的なプロフィール編集機能を提供

**重要**: Encoreの仕様上、各サービスのデータベースは物理的に分離されており、サービス間での直接的なテーブル参照はできません。必ずAPIを通じて連携してください。
```

---

## 🚨 絶対的禁止事項（CRITICAL RULES）

これらのルールは**いかなる理由があっても守らなければならない**。
違反した場合は即座に作業を停止し、ユーザーに報告すること。

### 1. 削除禁止・git checkout 禁止ルール

**判断フロー：既存機能を削除・無効化したいとき**

削除要求がきた
↓
ユーザーが「明示的に削除指示」している？
├─ YES → 許可（ただし確認報告必須）
└─ NO ↓
「エラー回避」「簡略化」が理由？
├─ YES → ❌ 禁止。根本原因を修正
└─ NO ↓
機能が必要だが新要求と衝突している？
├─ YES → ✅ 別画面/オプション/切り替え実装
└─ NO → ❌ 禁止。報告して相談

**禁止される行為:**
- ❌ エラーが出た機能の削除
- ❌ 自分のコミット履歴以外の `git checkout`
- ❌ 新しい要求によって以前の UI や機能を削除
- ❌ 「簡略化」と称した機能減少
- ❌ 「リファクタリング」での機能省略
- ❌ 一時的な回避としての機能無効化
- ❌ 追加に関係のない部分の破壊

**必須の対応:**
- ✅ エラーの根本原因を特定（機能は保持）
- ✅ 機能を維持したまま修正
- ✅ 機能や UI が衝突する場合はサンプル用の別画面を用意
- ✅ できない場合は代替実装を提案
- ✅ それでも無理なら **ユーザーに報告 + 実装の可否判断を依頼**


**必須の対応:**
- ✅ エラーの根本原因を特定
- ✅ 機能を維持したまま修正
- ✅ 機能や UI が衝突する場合はサンプル用の別画面を用意
- ✅ できない場合は代替実装を提案
- ✅ それでも無理なら明確に報告

### 2. ESLint ルール違反禁止ルール

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

### 3. 代替手段禁止ルール

**禁止される行為:**
- ❌ 定められた以外のバージョンやツールを勝手に切り替えない
  - 例: Tailwind v4 を v3 に切り替える
  - 例: mecab-wasm を kuromoji に切り替える
- ❌ 新しい要求が来ても以前の実装を上書きしない
- ❌ エラーを理由に別の実装に切り替えない

**必須の対応:**
- ✅ エラーの解消方法を追求する
- ✅ エラーが解消できない場合は、代替案を提案しメリット・デメリットを説明
- ✅ 自分で解消できないエラーは必ず相談

### 4. 未回答作業禁止ルール

**禁止される行為:**
- ❌ 質問をされた場合、勝手に作業を始めない
- ❌ 回答したからと言って勝手に作業を始めない
- ❌ 「以前の機能を消したのか?」と聞かれた場合に、消しているのに実装によって復元することで誤魔化さない

**必須の対応:**
- ✅ 質問には回答のみ出力する
- ✅ 回答が正しいことや、質問の意図を推測する
- ✅ 回答のエビデンスや状況の経緯を説明する

---

## 🎯 実装開始前の強制プロセス（チェックリスト）

**全ての実装タスクを開始する前に、以下の順序で必ず実施してから「了解した」と出力してください：**

### ☑️ 実装前チェックリスト

```checklist
□ Step 0: テンプレート機能の確認（NEW）
  - foundation-catalog スキルで既存機能を確認
  - 実装しようとしている機能がテンプレートで提供済みか確認
  - 提供済みの場合、該当する foundation-* スキルで詳細確認

□ Step 1: プロジェクト構造の確認
  - Serena MCP でシンボル検索、または `tree -L 3` で構成確認
  - 実装ディレクトリを特定

□ Step 2: 依存関係ファイルの確認
  - `package.json`, `pyproject.toml` 等を読む
  - ライブラリバージョンを記憶

□ Step 3: 領域別ルールの確認
  ○ 既存機能確認: `foundation-catalog` skill（必須）
  ○ Frontend: `foundation-components`, `foundation-api` skill
  ○ Backend: `foundation-auth`, `foundation-notification` skill
  ○ Database: `foundation-database` skill
  ○ エラー: `foundation-error-handling` skill
  ○ 監視: `foundation-monitoring` skill
  ○ テスト: `foundation-testing` skill
  （該当する領域のみ参照で可）

□ Step 4: 既存実装パターンの確認
  - 類似機能や同じ領域の既存コードを検索
  - 共通言語・命名規則・ファイル構成を理解
  - Context7 MCP で「ベストプラクティス」を調査

□ Step 5: ライブラリ・フレームワークのバージョン確認
  - AI学習時期 vs 実プロジェクト が異なる場合は Context7 で確認
  - 特に Svelte 5（Runes）は Svelte MCP で最新仕様確認

□ Step 6: Critical Rules の最終確認
  - 削除・代替・ESLint違反が含まれていないか
  - テンプレート制約に違反していないか
  - 例外に該当するか確認
```

→ 上記をすべて完了したら：
  「実装開始前プロセス完了。以下の内容で進めます: [確認結果サマリ]」
  と出力してから実装開始


---

## 🛠️ MCP の優先使用

このプロジェクトでは以下の MCP が利用可能です。
**存在する場合は率先して使用すること。**

### Serena
**用途**: コードベースの構造把握、セマンティック検索

**使用タイミング:**
- プロジェクト構造の把握（`tree` コマンドの代わり）
- クラス、関数、シンボルの検索
- コードベース全体の理解

### Context7
**用途**: ライブラリ・フレームワークのドキュメント、ベストプラクティス検索

**使用タイミング:**
- コアの処理や共通処理を実装する前
- AI が学習していないバージョンのライブラリを使う場合
- ベストプラクティスを確認したい場合
- 特別なコードパターンを実装する前

**重要**: 必ず調べてから実装すること

### Playwright
**用途**: ブラウザ自動化、UI の動作確認

**使用タイミング:**
- UI 作成時の動作確認（必須）
- E2E テスト
- ブラウザでの挙動確認

### Encore MCP
**用途**: Encore.dev API の呼び出し、エンドポイントテスト

**使用タイミング:**
- Backend API の動作確認
- 認証フローのテスト
- エンドポイントの統合テスト

詳細は [references/mcp-tools.md](references/mcp-tools.md) を参照。

### Svelte MCP
**用途**: Svelte 5 の仕様確認、コンポーネントの検証

**使用タイミング:**
- Svelte 5 Runes の使用方法確認
- SvelteKit の最新機能確認
- コンポーネント実装パターンの確認

---

## 📐 技術的な規約

### データベース運用の原則

**Encore物理データベース分離:**
- Encore.devは各サービスに物理的に独立したデータベースを提供（`auth`, `app`, `notification`, `dev_tools`）
- `database.ts` では `new SQLDatabase("app")` のように物理データベース名を指定

**プロジェクト推奨パターン（PostgreSQL論理スキーマ分割）:**
- 業務系サービスは全て `app` 物理データベースを使用
- マイグレーションでPostgreSQLの論理スキーマを作成し機能別に分割
  - 例: `CREATE SCHEMA crm;` → `CREATE TABLE crm.customer (...);`
  - 例: `CREATE SCHEMA workflow;` → `CREATE TABLE workflow.instruction_template (...);`
- テーブル参照時は `schema.table` 形式で明示的に指定（例: `crm.customer`）

**重要な制約:**
- `auth` / `app` / `notification` / `dev_tools` 以外の新しいSQLDatabaseを追加してはいけない
- サービス間でのデータベース直接参照は禁止（必ずAPIを通じて連携）
- 既存コードを読む際は `schema.table` で明示的に参照されているかを確認

**テンプレートの現状:**
- テンプレート自体には論理スキーマ分割は未実装
- 実案件で必要に応じて論理スキーマを追加する

詳細は `foundation-database` skill を参照。

### ツールの選択
- **検索**: `grep` より `ast-grep` や `ripgrep` を優先
- **ファイル操作**: 大量のファイルを扱う場合は `batch` 処理
- **MCP**: 利用可能な場合は積極的に活用

### コード品質（絶対に守る）
- **ファイルサイズ**: 500 行以下に保つ
- **モジュール性**: 責任ごとに分離
- **型安全性**: TypeScript の型を活用

### フロントエンド: ESLint + svelte-check 設定

**役割分担:**
- **ESLint**: コードスタイル、構文チェック、**type-aware ルール**（型情報を活用）、auto-fix 対応
- **svelte-check**: TypeScript 型チェック、Svelte 固有の検証

**設定ファイル:**
- **ESLint Flat Config** (`eslint.config.js`) を使用
- `@antfu/eslint-config` を使用（Prettier 不要）

**設定方針:**
- TypeScript: `recommended-type-checked`（**type-aware 有効**）
  - **`.ts` ファイル**: 全ての type-aware ルールを適用（warning で開始）
  - **`.svelte` ファイル**: 互換性のないルール（unsafe-* 系）のみ無効化、async/await 関連は有効
  - **設定ファイル**: 全ての type-aware ルールを無効化
- スタイル: タブインデント、シングルクォート、セミコロン不要
- 段階的修正: 既存エラーと新規 type-aware ルールは warning から開始

**利用可能なコマンド:**
```bash
pnpm run lint        # ESLint チェック（キャッシュ付き）
pnpm run lint:fix    # 自動修正
pnpm run check       # svelte-check で型チェック
pnpm run validate    # check + lint を実行
pnpm run ci          # validate + build を実行
```

**Pre-commit hooks:**
- husky + lint-staged により、コミット時に自動で lint 実行
- ステージされたファイルのみチェック（高速化）
- 設定: `.lintstagedrc.json` で `*.{ts,tsx,js,jsx,svelte}` に `eslint --fix` を適用

**Frontend 開発ワークフロー:**
1. コード修正
2. `pnpm run lint:fix` - 自動修正可能な問題を修正
3. `pnpm run check` - 型チェック実行
4. `pnpm run lint` - 最終チェック
5. エラーがなければコミット

### Backend: Encore.dev 開発ワークフロー

**API 実装後の必須手順:**
1. API エンドポイントを実装
2. `npm run gen:client` - TypeScript SDK を生成
3. `tsc` - コンパイルチェック
4. Encore MCP で動作確認

### 環境と実行
- **環境変数**: `.env.example` を参考に `.env.local` を作成
- **ポート管理**: 既に使用中なら kill して再起動（別ポートは使わない）
- **サーバー起動**: Backend (Encore) と Frontend (SvelteKit/Vite) は既にホットリロードで起動済み
  - 再起動の必要はない
  - どうしても再起動が必要な場合はユーザーに依頼

---

## 🧪 品質保証

### テスト作成
- 別工程でテストを行う
- 作業完了報告は Encore MCP や Playwright MCP で動作確認後、エラーがないことを確認してから報告
- Encore や Playwright での動作確認は単体テスト的ではなく、**利用シーンを想定して行う**

### ドキュメント更新
`README.md` を更新する場合:
- プロジェクト概要
- 環境構築手順
- 技術スタック
- ライブラリの説明
- 機能一覧
- 更新履歴

**機能や仕様、利用しているライブラリ等に変更があったら必ず記述すること。**

---

## 🧠 AI 動作の原則

### やるべきこと
- ✅ 各種 md ファイルや対応する skill を必ず読む
- ✅ 不明な点は質問する & **検索**する（Context7, Serena MCP を活用）
- ✅ 既存のパターンを踏襲する
- ✅ コードベースを調査してから実装する

### やってはいけないこと
- ❌ コンテキストなしに推測する
- ❌ 存在しないライブラリを創作する
- ❌ 確認なしに既存コードを削除する
- ❌ AI が学習していない新しいバージョンを勝手に使う（Context7 で確認必須）

---

## 🎯 このスキルの使用タイミング

**必ず使用する場合:**
- 実装タスクを開始する前
- 新しい機能を追加する前
- 既存コードを修正する前
- エラーが発生して対応を考える前
- ユーザーから新しい要求を受けた時

**確認事項:**
1. Critical Rules を守っているか？
2. 実装開始前の強制プロセスを実行したか？
3. 適切な MCP を使用しているか？
4. 技術的な規約を理解しているか？

---

## 📚 関連スキル

## 📚 関連スキルと参照フロー

| 実装領域 | 参照するSkill | 参照タイミング |
|---------|-------------|-------------|
| **フロントエンド全般** | `foundation-components`, `foundation-api` | UI実装時、API通信実装時 |
| **バックエンド全般** | `foundation-auth`, `foundation-notification` | 認証・通知実装時 |
| **データベース設計** | `foundation-database` | スキーマ追加・変更前 |
| **エラー処理実装** | `foundation-error-handling` | エラーハンドリング実装時、debuggingセッション中 |
| **監視・ロギング** | `foundation-monitoring` | Sentry設定時 |
| **テスト** | `foundation-testing` | テスト作成時 |

**使用例:**
ユーザー要求「新しいフォーム機能を追加」
↓
foundation を参照 → Critical Rules 確認
↓
foundation-catalog 参照 → 既存機能確認
↓
foundation-components 参照 → 既存UIコンポーネント確認
↓
実装開始

---

## 例外処理とエスカレーション

### CRITICAL RULES の例外認定フロー

**例外を認める場合（以下すべてに該当）:**

├─ ユーザーが「明示的に」削除/変更を指示している？
│ └─ YES → Step 2
├─ かつ、削除理由が以下いずれかか？
│ ├─ セキュリティ脆弱性（報告 + 修正案提示必須）
│ ├─ データ保護法違反対応
│ ├─ 技術的実装不可能証明（代替案提示必須）
│ └─ ユーザー明示的指示（ただし確認メッセージ必須）
└─ 代替案や影響範囲をユーザーに確認した？
└─ YES → 例外認定、実行可能

### 例外対応の報告フォーマット

```markdown
**例外実行報告**

- ルール違反: [どのCritical Ruleか]
- 理由: [セキュリティ/不可能/ユーザー指示]
- 対応内容: [具体的な実行内容]
- 影響範囲: [修正・削除したファイル]
- 代替案/復旧方法: [あれば記述]

**例:**
ルール違反: 削除禁止ルール
理由: ユーザー明示的指示
対応内容: /src/routes/old-feature を削除
影響範囲: UI から該当メニュー削除、リンク削除
代替案: git revert で復旧可能（コミット: abc123）
```



---

## 🔄 スキルのメンテナンス方針

### レビュー頻度
- **技術更新時**（新しいライブラリバージョン導入、大型アップデート）
- **3ヶ月ごと**（定期的な方針見直し、新しいパターン追加）
- **重大な問題発生時**（Critical Rules 違反が多発した場合）

### メンテナンスチェックリスト

```checklist
□ 技術スタック版はまだ最新か（Svelte 5.0.0 以降でも同じ？）
□ Encore.dev/SvelteKit の新機能が反映されているか
□ Critical Rules に抜けはないか（過去に違反があった？）
□ 関連 skill との重複・矛盾がないか
□ 参照ファイル（references/）が最新か
□ 「使用タイミング」の実例が現在のプロジェクト状況と合致しているか
```

### 更新時の手順
1. `git branch -b maintenance/foundation-skill-update`
2. 上記チェックリストに基づき更新
3. Pull Request + Code Review
4. マージ時に changelog を `SKILL_UPDATES.md` に記録

---

## まとめ

この Foundation skill は、プロジェクトの品質と一貫性を保つために存在します。

**重要な原則:**
1. 実装前に必ず読む
2. Critical Rules は絶対に守る
3. 疑問がある場合は必ずユーザーに確認
4. 自己判断での省略や変更は絶対に行わない
5. MCP を積極的に活用する

**疑問や不明点がある場合:**
- ユーザーに質問する
- 関連する skill を参照する
- MCP（Context7, Serena 等）で調査する
