# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project in the current directory
npx sv create

# create a new project in my-app
npx sv create my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Encore API base URL configuration

The frontend SDK talks to the Encore backend via the generated client in `src/lib/api/client.ts`. The client resolves its base URL using environment variables so that different environments (local development, staging, production) can target the correct Encore instance without code changes.

1. Copy `.env.development` to `.env.local` if you need developer-specific overrides, or adjust `.env.development` directly for shared defaults on this branch.
2. Set one of the following variables to a **full URL** (recommended) or to a **port number**:

```
VITE_ENCORE_BASE_URL=http://localhost:4002
ENCORE_BASE_URL=http://localhost:4002
```

- Variables with the `VITE_`/`PUBLIC_` prefix are available to browser code, while the un-prefixed variants are only read on the server.
- When a value is just a port number (for example `4002`), the client will automatically expand it to `http://localhost:<port>`.
- Resolution order is: `VITE_ENCORE_BASE_URL` → `PUBLIC_ENCORE_BASE_URL` → `ENCORE_BASE_URL` → `ENCORE_API_ORIGIN` → `ENCORE_API_URL` → `ENCORE_API_HOST` → `ENCORE_API_PORT` → Encore SDK's `Local` default (`http://localhost:4000`).

Use environment-specific files (`.env.production`, deployment secrets, etc.) to point staging or production builds at the correct Encore app.

## Sentry エラー監視設定

このプロジェクトは [@sentry/sveltekit](https://docs.sentry.io/platforms/javascript/guides/sveltekit/) を使用してエラー監視を行います。

### 環境変数の設定

`.env` または `.env.local` に以下を設定してください:

```bash
# Sentry DSN（Optional）
# 設定されていない場合は、コンソールログのみが出力されます
VITE_SENTRY_DSN_FRONTEND=https://xxxxx@oxxxxx.ingest.us.sentry.io/xxxxx

# 環境設定（local, development, production）
VITE_ENVIRONMENT=local
```

### 環境別の動作

- **local**: トレース30%、リプレイ10%、Dedupe無効（全エラー送信）
- **development**: トレース100%、リプレイ20%、Dedupe無効（全エラー送信）
- **production**: トレース10%、リプレイ5%、Dedupe有効+カスタムフィンガープリント

### 主な機能

- **自動エラー監視**: 未処理の例外やPromise rejectionを自動キャプチャ
- **ユーザーコンテキスト**: ログイン時に自動設定、ログアウト時に自動クリア
- **Session Replay**: ユーザー操作の録画（エラー発生時は100%）
- **フィードバックウィジェット**: ユーザーがブラウザ上から直接フィードバックを送信可能
- **分散トレーシング**: バックエンドAPIとの連携（`sentry-trace`ヘッダー自動付与）

### バージョン管理

アプリケーションバージョンは `package.json` の `version` フィールドから自動的に注入されます（`vite.config.ts` で処理）。

### トラブルシューティング

- **エラーが送信されない**: `VITE_SENTRY_DSN_FRONTEND` が設定されているか確認してください
- **ユーザー情報が表示されない**: ログイン後にページリロードしてみてください（通常は自動設定されます）
- **同じエラーが複数回送信されない（本番環境）**: これは正常動作です（Dedupe機能）。異なるエラーコードを持つエラーは別イベントとして記録されます

詳細は `ERROR_HANDLING.md` の「Sentry統合」セクションを参照してください。

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## OCR Preview Notes

- Document OCR のプレビューは画像ベース（PNG/JPEG/SVG）で座標オーバーレイを行います。
- PDF を直接プレビューしながら座標オーバーレイする機能は現状対象外です。PDF の場合はサーバーサイドでページごとの画像に変換し、フロントは画像を表示してオーバーレイします（将来対応）。
- 請求書／フォームの既存プレビュー（PDF/画像）は従来どおり動作します。

## 開発者ツール: 通知コンソール

- `/dev_tools/notifications` に super_admin 専用の通知送信コンソールを追加。ユーザー一覧から複数選択し、Encore SDK の `notification.createNotification` を呼び出してテスト通知を送信できる。
- DaisyUI v5 のカード/バッジ/テーブルを使って必須項目と任意項目を明確に分離し、リッチ変数やメタデータを JSON で投入可能。
- サーバーサイドでは Zod で入力検証を行い、Encore のトークン自動更新ヘルパー `withAutoRefresh` を再利用。送信結果はページ右側のサマリーカードに即時表示される。

## 汎用通知システム（SSE）統合メモ

- `src/lib/notifications/` に SSE クライアント・状態管理ストアを実装しました。
  - `client.ts`: EventSource の接続・再接続を担当。指数バックオフ（3s→6s→12s→30s→60s）の上限 5 回で停止。
  - `store.ts`: 未読件数・受信履歴を保持し、ヘッダー／ユーザー設定から共有利用します。
  - `types.ts`: バックエンドの `NotificationPayload` と同期した型定義。
- 共通ヘッダー (`src/lib/components/Header.svelte`) に通知ベルを追加し、最新 20 件までの通知をドロップダウンで確認できます。開いたタイミングで未読は自動的に既読化されます。
- `user-settings` の「その他」タブに通知ステータスカードを追加しました。接続状態・最終受信時刻・未読件数を確認でき、再接続ボタンを提供します。
- Playwright MCP を用いた E2E 確認はバックエンドが 500 応答のため未完了です。サーバー復旧後に `notification.createNotification` を encore MCP で発火し、5174 番ポートのダッシュボードで通知が表示されるか確認してください。
- Encore 生成クライアントの `Local` 基底 URL は暫定的に `http://localhost:4001` へ変更しています（バックエンドの起動ポートに合わせるため）。切り替え機構が導入されたら元に戻す想定です。
- SSE は SvelteKit 側の `/api/notifications/stream` が Encore(4001) をプロキシする構成です。同一オリジンで EventSource を利用し、サーバー側でアクセストークンを読み出して `Authorization` ヘッダーを付与します。`?channel=user-{id}` を指定すると追加の個別チャネルを購読できます（管理権限のみ他ユーザー分を追加可能）。
- ヘッダーの通知ドロップダウンは「自分」「個別（他者）」「全体」「運用」などのスコープフィルタを備えており、`NotificationItem.scopes` に格納されたチャネル種別で切り替えます。
