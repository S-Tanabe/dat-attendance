# Dev Tools Storage UI

このディレクトリは dev_tools サービス向けバケットエクスプローラー画面 (`/dev_tools/storage`) の実装を保持します。super_admin が Encore Object Storage の全バケットをブラウズ・アップロード・削除できる内部ツールです。

## 構成

| ファイル | 役割 |
| -------- | ---- |
| `+page.server.ts` | Encore SDK を利用してバケット一覧・ディレクトリ一覧を取得するサーバーロード。すべてのフォームアクションで `withAutoRefresh` を用い、401 時に自動で `auth.refresh` を行います。 |
| `+page.svelte` | UI 本体。リスト表示とカラム表示を持つ Finder 風レイアウトで、署名付き URL を使ったアップロード／ダウンロード／削除／フォルダ作成を実装。 |
| `api.ts` | Encore SDK への薄いクライアント。list/generate/delete などのメソッドをまとめた 1 ファイルに集約しています。 |
| `api/objects/+server.ts` | カラムビューの遅延ロード用 API。選択フォルダの prefix を渡して `list_objects` を再呼び出します。 |
| `utils/` | 追加ユーティリティ用。現状は未使用の雛形です。 |

## データフロー

1. `+page.server.ts` が Encore クライアント (`serverClient`) を生成し、`list_available_buckets` と `list_objects` を呼び出して初期データを返します。
2. クライアント側では `columnsData` と `selectedItemInColumn` でカラム表示を構築。ディレクトリをクリックすると `api/objects` をフェッチし、新しい列を追加します。
3. ファイル選択時 (`onFileChange`) は現在選択中のフォルダを解析し、`?/upload` フォームを自動送信 → 署名付き PUT URL に直接アップロード → 再読込 (`invalidateDeps`) という流れになります。
4. 削除・ダウンロード・フォルダ作成も同様に、サーバーアクション経由で Encore API を呼び出します。フォルダ削除（キー末尾が `/`）の場合は、バックエンドがプレフィックス以下のオブジェクトを再帰的に削除します。

## キーボードショートカット

- `Cmd/Ctrl + A`: 現在表示中の列（またはリスト）内のファイルを全選択。
- `Escape`: 選択解除。
- `Cmd/Ctrl + Delete`: 選択項目を削除（確認はフォームで処理）。
- `Cmd/Ctrl + 1` / `Cmd/Ctrl + 2`: リスト表示・カラム表示の切り替え。
- `Alt + ↑`: 親フォルダへ移動。

## ビュー切替

- **List View**: `viewMode === 'list'`。現在の prefix 内のディレクトリ/ファイルをテーブル形式で表示します。
- **Column View**: macOS Finder 風の複数カラム構成。最後の列が現在のアップロード先になります。カラム幅はドラッグで調整できます。

## アップロードの挙動

- 画面右上のアップロードボタンでファイルピッカーを開くと、自動で `?/upload` フォームが送信されます。
- アップロード先キーは、カラム表示では最後に展開した列の `path`、リスト表示では URL の `prefix` を元に決定されます。
- 署名付き URL を取得後、ブラウザから直接 PUT し、完了後に `invalidate('app:dev_tools:storage')` で最新状態を取得します。

## 開発メモ

- バックエンド仕様は `backend/services/dev_tools/docs/STORAGE_BROWSER.md` を参照してください。
- Encore API を更新したら `npm run gen:client` を必ず実行し、`storage/api.ts` を同期してください。
- `?/delete` のサーバーアクションではフォームから受け取ったキーを重複排除してからリクエストし、バックエンド側でプレフィックス削除をまとめて処理します。
- 今後の TODO: ページング、インラインプレビュー、検索 UI の再導入、複数ファイル同時アップロードなど。

## 環境変数

- `src/lib/api/client.ts` が `VITE_ENCORE_BASE_URL` / `ENCORE_BASE_URL` などを解決します。`.env.example` から `.env.local` を作成し、接続先を設定してください。
- 本画面は super_admin ロールでの利用を前提としているため、検証時は管理者アカウントでログインしてください。

変更や調査結果があれば、この README を更新してノウハウを蓄積してください。
