# Dashboard Accelerator Template v1.0.1 - セットアップガイド

このガイドは、Dashboard Accelerator Template を使用して新しいプロジェクトを開始する手順を説明します。

---

## v1.0.0

### 更新内容サマリー

- 🎉 CLAUDE CODE以外のLLMに対応するためAGENTS.mdとbackend/frontend直下にCLAUDE.md/AGENTS.mdを配置

## v1.0.0

### 更新内容サマリー

- 🎉 全てのドキュメントをclaude skillsに置き換え。CLAUDE.mdによって必要な時に必要なskillを選択出来るように設計
- 🎉 sentry統合完了。DSNを登録すると自動的にsentryが設定されます。ユーザーフィードバック機能も有効化。skillにルールを登録しているため、適切なタグや情報を自動付与
- 🎉 ESLint/svelte-checkの設定を追加。skillと連動して開発時にコードチェックが実行されます。huskyによるコミット・プッシュ時にも自動起動
- 🎉 エラー集約の実装。frontend, backend共にエラーを集約し意識せずとも一律したAPI送受信をAIに実装させることが出来ます
- 🎉 実装用テンプレートの配備。strategy/templatesに実装用プロンプトを出力するためのテンプレートを配置。

### 今後の予定

- 🚀 キャッシュの実装
- 🚀 より強力なroleの設計
- 🚀 2C用のfrontend対応
- 🚀 汎用サービス(CRMやEDIなど)レベルのSKILLの設計

## 📋 前提条件

以下のツールがインストールされていることを確認してください:

- **Node.js**: v20 以上
- **pnpm**: v9 以上
- **Encore CLI**: 最新版
  ```bash
  brew install encoredev/tap/encore
  # または
  curl -L https://encore.dev/install.sh | bash
  ```
- **PostgreSQL**: v17 以上（ローカル開発用）
- **Git**: 最新版

---

## 📖 ドキュメント体系

このテンプレートでは、目的別に整理されたドキュメント体系を提供しています。

### Level 1: エントリーポイント（概要レベル）

| ドキュメント | 内容 | いつ読むか |
|------------|------|-----------|
| **[CLAUDE.md](./CLAUDE.md)** | 開発ルール・制限事項・技術スタック | 開発開始前（必須） |
| **[ACCELERATOR.md](./ACCELERATOR.md)** | テンプレート機能説明・アーキテクチャ・設計原則 | 機能実装前（必須） |
| **README.md（本ドキュメント）** | セットアップガイド・プロジェクト概要 | 最初のセットアップ時 |

### Level 2: 領域別開発ルール

| ドキュメント | 内容 | いつ読むか |
|------------|------|-----------|
| **[backend/CLAUDE.md](./backend/CLAUDE.md)** | Backend開発ルール・ワークフロー | Backend実装時 |
| **[frontend/CLAUDE.md](./frontend/CLAUDE.md)** | Frontend開発ルール・ワークフロー | Frontend実装時 |

### Level 3: 詳細実装パターン

| ドキュメント | 内容 | いつ読むか |
|------------|------|-----------|
| **[.claude/skills/](/.claude/skills/)** | 機能別詳細実装パターン（foundation-* スキル群） | 各機能実装時 |
| **docs/** | 詳細ドキュメント（将来追加予定） | 必要に応じて |

### 開発フロー

```
開発タスク開始
   ↓
Step 1: CLAUDE.md で開発ルール・禁止事項を確認
   ↓
Step 2: ACCELERATOR.md で既存機能を確認
   ↓
Step 3: backend/CLAUDE.md または frontend/CLAUDE.md で領域別ルールを確認
   ↓
Step 4: .claude/skills/foundation-* で詳細実装パターンを確認
   ↓
実装開始
```

**重要**: 実装開始前に必ず **CLAUDE.md** と **ACCELERATOR.md** を読んでください。これらはテンプレートの設計思想と制約を理解するために不可欠です。

---

## 🚀 Step 1: テンプレートの複製

### GitHub UI を使用する場合

1. このリポジトリのページで "Use this template" ボタンをクリック
2. 新しいリポジトリ名を入力
3. "Create repository from template" をクリック
4. 作成されたリポジトリをクローン:
   ```bash
   git clone https://github.com/YOUR_USERNAME/YOUR_PROJECT_NAME.git
   cd YOUR_PROJECT_NAME
   ```

### Git コマンドを使用する場合

```bash
# テンプレートをクローン
git clone https://github.com/YOUR_ORG/dashboard-accelerator-template.git YOUR_PROJECT_NAME
cd YOUR_PROJECT_NAME

# 新しいリポジトリとして初期化
rm -rf .git
git init
git add .
git commit -m "Initial commit from Dashboard Accelerator Template"

# リモートリポジトリに接続（オプション）
git remote add origin https://github.com/YOUR_USERNAME/YOUR_PROJECT_NAME.git
git push -u origin main
```

---

## 📝 Step 2: プロジェクト情報の更新

### PROJECT.md の編集

`PROJECT.md` を開いて、プロジェクト固有の情報に置き換えます:

```markdown
### プロジェクト名
**あなたのプロジェクト名**  # ← 変更

### プロジェクトタイプ
小売企業の基幹システム  # ← 変更

### プロジェクトの目的
このプロジェクトは、○○会社の店舗管理と在庫管理を統合するシステムです。  # ← 変更

### スコープ
このプロジェクトは以下の機能を提供します:
- 店舗管理  # ← プロジェクト固有の機能を追加
- 在庫管理
- 発注管理
...
```

### 更新すべき主なセクション

1. **基本情報**
   - プロジェクト名
   - プロジェクトタイプ
   - プロジェクトの目的
   - スコープ

2. **テストアカウント**
   - プロジェクト固有のテストアカウント情報に更新
   - セキュリティ上の理由で、本番環境のアカウント情報は記載しない

3. **プロジェクト固有の制約事項**
   - 必要に応じて追加の制約を記載

4. **主な機能**
   - テンプレートの機能を削除・追加してプロジェクトに合わせる

---

## 🔧 Step 3: 環境設定

### Backend の設定

```bash
cd backend
# 多分この方法が正しい
rm encore.app
# encore app initを実行してアプリ名を決める
encore app init

npm install
```

`.env.local` ファイルを作成:

```bash
cp .env.example .env.local
```

`.env.local` を編集して、必要な環境変数を設定:

```env
# JWT Secret（必須）
# 本番環境では強力なランダム文字列を使用
JWT_SECRET=your_secure_jwt_secret_here_at_least_32_characters_long

# Sentry（任意）
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# その他の環境変数
NODE_ENV=development
```

**重要:** JWT_SECRET は32文字以上の強力なランダム文字列を使用してください:

```bash
# ランダムな JWT_SECRET を生成（macOS/Linux）
openssl rand -base64 32
```

### Frontend の設定

```bash
cd ../frontend
pnpm install
```

必要に応じて `.env` ファイルを作成（通常は不要）:

```bash
# Frontend の環境変数（必要な場合のみ）
PUBLIC_API_URL=http://localhost:4000
```

---

## 🗄️ Step 4: データベースのセットアップ

### ローカル PostgreSQL の準備

Encore は自動的にローカル PostgreSQL データベースを管理します:

```bash
cd backend
encore db conn-uri app --env=local
```

データベース接続情報が表示されます。


### マイグレーションの実行

単にecnore runでマイグレーションは実行されます。以下は手動でマイグレーションを実行する方法です。

```bash
cd backend
encore db migrate up
```

これにより、以下のスキーマとテーブルが作成されます:
- `app` スキーマ（業務系データ）
- `auth` スキーマ（認証系データ）
- `dev_tools` スキーマ（開発者ツール）
- `notification` スキーマ（通知システム）

### 初期データの投入（任意）

```bash
cd backend
encore exec -- npx tsx scripts/seed_create_default_account.ts
```

これにより、テストアカウントが投入されます。

---

## 🚀 Step 5: サーバーの起動

### Backend の起動

```bash
cd backend
encore run
```

Backend が起動します:
- API Server: http://localhost:4000
- Admin UI: http://localhost:9400（Encore Local Development Dashboard）

### Frontend の起動

新しいターミナルを開いて:

```bash
cd frontend
pnpm run dev
```

Frontend が起動します:
- Dev Server: http://localhost:5173

---

## ✅ Step 6: 動作確認

### 1. Frontend へアクセス

ブラウザで http://localhost:5173 を開きます。

### 2. ログイン

デフォルトのテストアカウントでログイン:
- **Email**: `admin@fox-hound.jp`
- **Password**: `Archimedes212`

### 3. 基本機能の確認

- ログイン・ログアウト
- ダッシュボード表示
- ユーザー一覧表示
- 通知機能
- プロフィール編集
- sentry統合

### 4. Backend API の確認

Encore Local Development Dashboard で API エンドポイントを確認:
http://localhost:9400

---

## 🔐 Step 7: セキュリティ設定

### JWT Secret の更新

`.env.local` の `JWT_SECRET` を本番用の強力な値に変更:

```bash
# 強力なランダム文字列を生成
openssl rand -base64 32

# .env.local に設定
JWT_SECRET=<生成された文字列>
```

### テストアカウントの変更

初期データ投入スクリプト（`backend/scripts/seed.ts` など）を編集して、テストアカウントのパスワードを変更:

```typescript
// デフォルトのパスワードを変更
const defaultPassword = "your_new_secure_password";
```

### .gitignore の確認

機密情報がコミットされないことを確認:

```bash
# .env.local が無視されていることを確認
cat .gitignore | grep .env.local
```

---

## 🎨 Step 8: プロジェクトのカスタマイズ

### ブランディング

1. **アプリ名の変更**
   - `frontend/src/lib/constants.ts` の APP_NAME を変更
   - `frontend/src/app.html` の title を変更

2. **ロゴの変更**
   - `frontend/static/logo.svg` を置き換え
   - `frontend/static/favicon.png` を置き換え

3. **カラーテーマの変更**
   - `frontend/tailwind.config.ts` の DaisyUI テーマ設定を編集

### 機能の追加・削除

1. **不要な機能の削除**
   - Backend: `backend/services/` から不要なサービスを削除
   - Frontend: `frontend/src/routes/(app)/` から不要なページを削除

2. **新機能の追加**
   - `CLAUDE.md` と `.claude/skills/` のガイドに従って開発

---

## 📚 Step 9: ドキュメントの整備

### README.md の更新

プロジェクト固有の情報を追加:
- プロジェクトの概要
- セットアップ手順（このファイルへのリンク）
- デプロイ手順
- チーム情報

---

## 🧪 Step 10: テストの実行

### Backend のテスト

```bash
cd backend
encore test
```

### Frontend のテスト

```bash
cd frontend
pnpm run check  # 型チェック
pnpm run lint   # リント
pnpm run test   # ユニットテスト
```

---

## 🚢 Step 11: デプロイの準備

### Encore Platform へのデプロイ

1. **Encore アカウントの作成**
   https://encore.dev/ でアカウント作成

2. **アプリの作成**
   ```bash
   encore app create
   ```

3. **環境変数の設定**
   Encore Platform で環境変数を設定:
   - `JWT_SECRET`
   - `SENTRY_DSN`

4. **デプロイ**
   ```bash
   git push encore main
   ```

### Frontend のデプロイ

Vercel, Netlify, Cloudflare Pages などにデプロイ:

```bash
cd frontend
pnpm run build

# Vercel の場合
vercel deploy
```

---

## 🎯 開発のベストプラクティス

### Claude Code との連携

このテンプレートは Claude Code Skills を活用しています:

1. **CLAUDE.md を読む**: 開発ルールとプロセスを理解
2. **PROJECT.md を読む**: プロジェクト固有の情報を確認
3. **Skills を活用**: `.claude/skills/` に各技術領域のガイド

### MCP の活用

以下の MCP を優先的に使用:
- **Serena MCP**: プロジェクト構造把握
- **Encore MCP**: API 動作確認
- **Svelte MCP**: Svelte 5 ドキュメント
- **Context7 MCP**: ライブラリドキュメント
- **Playwright MCP**: UI 動作確認

### Critical Rules の遵守

1. **削除禁止**: 既存のコード・機能を削除しない
2. **ESLint 強制**: ESLint ルールを必ず遵守
3. **代替手段禁止**: 定められたツール以外を勝手に使わない
4. **MCP 必須**: MCP が利用できない場合は開発停止

---

## 🆘 トラブルシューティング

### Backend が起動しない

```bash
# Encore のバージョン確認
encore version

# Encore の更新
brew upgrade encoredev/tap/encore

# ポート競合の確認
lsof -i :4000
```

### Frontend が起動しない

```bash
# node_modules を削除して再インストール
cd frontend
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### データベース接続エラー

```bash
# Encore のローカルデータベース接続情報を確認
encore db conn-uri app --env=local

# PostgreSQL が起動しているか確認
pg_isready
```

### Migration エラー

```bash
# Migration 状態を確認
encore db migrate status

# Migration をリセット（開発環境のみ）
encore db reset
encore db migrate up
```

---

## 📞 サポート

### 公式ドキュメント

- **Encore.dev**: https://encore.dev/docs
- **SvelteKit**: https://kit.svelte.dev/docs
- **Svelte 5**: https://svelte.dev/docs/svelte/overview
- **DaisyUI**: https://daisyui.com/

### コミュニティ

- Encore Discord: https://encore.dev/discord
- Svelte Discord: https://svelte.dev/chat

---

## ✅ セットアップ完了チェックリスト

- [ ] テンプレートをクローン
- [ ] `PROJECT.md` を編集
- [ ] Backend の依存関係をインストール
- [ ] Frontend の依存関係をインストール
- [ ] `.env.local` を作成・編集
- [ ] `JWT_SECRET` を設定
- [ ] データベースマイグレーション実行
- [ ] 初期データ投入（任意）
- [ ] Backend サーバー起動確認
- [ ] Frontend サーバー起動確認
- [ ] ログイン動作確認
- [ ] テストアカウント変更
- [ ] ブランディング変更（ロゴ、カラー）
- [ ] README.md 更新
- [ ] テスト実行
- [ ] Git リポジトリ初期化・プッシュ

---

## 📝 実装のコツ

### PLAN駆動開発

- strategy/templatesには「バックエンド用」「フロントエンド用」「両用」のプラン生成用プロンプトテンプレートが配置されています。
- テンプレートをコピーし、必要な部分を追記。基本的には要求と制約事項程度でも十分です。
- 出力されたPLANをそのままAIに読ませれば実行が開始されます。PLANには適宜SKILLを選択するための指示が含まれています。
- ❌️ １時間以上のプロンプトエンジニアリングはPLAN駆動に切り替えましょう。

### リファクタリング

- 実装が増えてきた時、現在の実装がskillを活用してルールを守っているかチェックするための依頼をAIに投げる事で、より良い実装が得られます。

### serena mcp

- 自身で設定している場合は問題ないですが、現設定ではserenaがプロジェクトをロードしません。AIを起動したら「serenaでプロジェクトをロードして」と指示するとserenaが利用開始されます
- serenaのメモリは古いままで更新されていないケースがあります。「メモリを更新して」と指示すると更新されます。

### svelte mcp

- skillに記載されていますがsvelteにもmcpサポートが追加されました。
- プロンプトエンジニアリングで修正している場合、明示的に「svelte mcp」を指示する事で開発が効率化する場合があります。


## 🎉 次のステップ

セットアップが完了したら、以下を実行してください:

1. **チーム向けドキュメント作成**: プロジェクト固有のドキュメントを追加
2. **CI/CD 設定**: GitHub Actions などで自動テスト・デプロイを設定
3. **開発開始**: `CLAUDE.md` と `.claude/skills/` を参照しながら開発

Happy coding! 🚀
