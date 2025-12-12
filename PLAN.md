# AI駆動開発 共通テンプレート: 出退勤ログ & ロール分離 PLAN.md

## 0. この PLAN の目的

AI駆動開発において、複数プロジェクトで再利用できる **「ユーザー／管理ロール分離 + 出退勤ログ」テンプレート** を実装する。

この PLAN.md は、ClaudeCode 等の AI コーディングエージェントがこのテンプレートを実装するための **要求仕様・設計方針・タスク分割** を定義する。

本 PLAN は、既存の以下構成を前提とする：

- backend: Encore.dev を利用した TypeScript 製バックエンド
- frontend-user: SvelteKit を利用したユーザー向けフロントエンド
- frontend-admin: SvelteKit を利用した管理者向けフロントエンド
- packages/shared: フロントエンド間で共有するコード（エラー処理、ストア、認証ヘルパー）

---

## 1. コンテキスト / 背景

- 社内・社外向けの Web システム開発において、
  - ログイン / ロール分離（ユーザー / 管理者）
  - 状態の変化を記録する「ログ」の仕組み
  を毎回ゼロから実装している。

- 一方で、**勤怠の「出退勤」という行為** は、
  - 「あるユーザーが、ある時刻に、あるアクションをした」
  という一般化しやすいログ構造を持ち、
  - 他のドメイン（予約・申込・在庫・進捗）にも転用しやすい。

- そこで本プロジェクトでは、  
  **「出退勤ログ」を題材に、汎用化可能なロール分離 + ログテンプレート** を実装し、  
  AI駆動開発における共通基盤として利用できる形にする。

---

## 2. ゴール / 非ゴール

### 2.1 ゴール

- 共通テンプレートとして以下を提供すること：

1. **ロール分離**
   - 一般ユーザー（`USER`）
   - 管理者（`ADMIN`）
   - 認証 + ロールによるアクセス制御

2. **出退勤ログの取得・保存**
   - 出勤／退勤ボタンによる打刻
   - 出退勤ログ（生データ）の保存
   - ユーザー自身の履歴取得 API
   - 管理者による全体一覧取得 API
   - 管理者によるログ修正 / コメント機能

3. **AI 駆動要素（簡易版）**
   - 指定ユーザー・期間の出退勤ログから
     - 週次／月次のテキスト要約を生成するエンドポイント
   - 実際の AI 呼び出しはラッパー層に切り出し、API キー等は環境変数で注入

4. **再利用しやすい構造化**
   - `backend`（Encore） + `frontend-user` + `frontend-admin` の 3 層構成
   - 将来的に「出退勤」以外のログ種別にも流用可能な設計

### 2.2 非ゴール（あえてやらないこと）

本テンプレートでは、以下は **スコープ外** とする：

- 勤怠 / 労務の詳細ロジック
  - 所定労働時間・休憩時間の判定
  - 残業・深夜・休日労働時間の計算
  - 遅刻・早退の判定
  - 有給 / 代休 / 振休などの休暇管理
  - シフト管理、裁量労働制などの勤務区分
  - 36協定の枠管理 など

- 給与・人事システム連携

- マルチテナント（複数企業）対応
  ※必要になれば、`organization_id` などを付与して拡張する想定

---

## 2.5 アカウント設計方針

### 同一認証基盤 + ロールベースアクセス制御

本プロジェクトでは、**同一の認証基盤（auth_users）を使用し、ロール（roles テーブル）によってアクセス制御を行う**設計を採用します。

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        同一認証基盤                                   │
│                                                                     │
│   ユーザー  ──┬──  auth_users (email + password)                    │
│              │                                                      │
│              └──► app_users + roles でロール判定                    │
│                        │                                            │
│         ┌──────────────┼──────────────┐                             │
│         ▼              ▼              ▼                             │
│   ┌──────────┐   ┌──────────┐   ┌──────────┐                        │
│   │super_admin│   │  admin   │   │   user   │                        │
│   │ (level 1)│   │ (level 2)│   │ (level 3)│                        │
│   └────┬─────┘   └────┬─────┘   └────┬─────┘                        │
│        │              │              │                              │
│        ▼              ▼              ▼                              │
│   ┌─────────────────────────┐  ┌─────────────┐                      │
│   │    frontend-admin       │  │frontend-user│                      │
│   │  (level <= 2 のみ)      │  │ (全員可)    │                      │
│   └─────────────────────────┘  └─────────────┘                      │
└─────────────────────────────────────────────────────────────────────┘
```

### アクセス制御ルール

| フロントエンド | 必要ロールレベル | 対象ユーザー |
|---------------|-----------------|-------------|
| frontend-admin | level <= 2 | super_admin, admin |
| frontend-user | 認証済み全員 | super_admin, admin, user |

### メリット

1. **シンプルな認証フロー**: ユーザーは1つのアカウント（email/password）で認証
2. **柔軟なロール管理**: app_users.role_id を変更するだけでロール変更可能
3. **auth_users は変更不要**: 認証ロジックに影響を与えずにロール拡張可能
4. **統一されたユーザー体験**: 管理者もユーザー画面にアクセス可能

### 実装時の注意点

- ログイン後、app_users からロール情報を取得してアクセス制御
- frontend-admin へのアクセス時は level <= 2 をチェック
- JWT トークンにはロール情報を含めない（都度 app_users を参照）
  - ※ロールが変更された場合に即座に反映するため

---

## 3. 全体アーキテクチャ

### 3.1 想定技術スタック

- Backend: **Encore.dev（TypeScript）**
  - REST API
  - PostgreSQL（Encoreのマネージド DB）
    - 物理DB分離: auth（認証）、app（アプリケーション）、notification（通知）
  - Sentry（エラー監視・ログ収集）

- Frontend: **SvelteKit + Svelte 5（Runes構文）+ TypeScript**
  - `frontend-user`: 一般ユーザー向け UI
  - `frontend-admin`: 管理者向け UI
  - `packages/shared`: 共通コード（エラー処理、ストア、認証ヘルパー、型定義）
  - DaisyUI v5 + Tailwind CSS v4（UIコンポーネント）

- AI連携:
  - `backend` または別パッケージに AI クライアントインターフェースを定義
  - 実装は OpenAI / Anthropic などを想定し、API キーは環境変数経由

### 3.2 ディレクトリ構造（前提）

既存構成を前提に、以下のような整理を行う：

```text
repo-root/
 ├── backend/                          # Encore.dev TypeScript アプリケーション
 │   ├── services/
 │   │   ├── auth/                     # 認証サービス（authデータベース）
 │   │   │   ├── migrations/           # auth_users テーブル
 │   │   │   └── modules/
 │   │   ├── app/                      # アプリケーションサービス（appデータベース）
 │   │   │   ├── migrations/           # app_users, roles, attendance_records テーブル
 │   │   │   └── modules/
 │   │   │       ├── users/            # ユーザー管理
 │   │   │       └── attendance/       # 出退勤ドメイン
 │   │   ├── notification/             # 通知サービス（notificationデータベース）
 │   │   └── dev_tools/                # 開発ツール
 │   └── shared/                       # バックエンド共通モジュール（errors, monitoring）
 │
 ├── frontend-admin/                   # 管理者向け SvelteKit アプリ
 │   └── src/
 │       ├── lib/                      # API, errors, stores, components
 │       └── routes/                   # /login, /dashboard, /attendance など
 │
 ├── frontend-user/                    # 一般ユーザー向け SvelteKit アプリ
 │   └── src/
 │       ├── lib/                      # API, errors, stores, components
 │       └── routes/                   # /login, /dashboard, /history など
 │
 ├── packages/
 │   └── shared/                       # フロントエンド共通コード（pnpm workspace）
 │       ├── errors/                   # エラー型・コード・変換
 │       ├── stores/                   # Svelte ストア
 │       ├── auth/                     # 認証ヘルパー・型
 │       ├── types/                    # 共通型定義
 │       └── utils/                    # ユーティリティ
 │
 ├── pnpm-workspace.yaml               # pnpm ワークスペース設定
 ├── PLAN.md
 ├── CLAUDE.md                         # 開発ルール
 ├── ACCELERATOR.md                    # テンプレート機能説明
 └── README.md
```

> **重要**: Encoreの仕様上、各サービスのデータベースは物理的に分離されており、
> サービス間での直接的なテーブル参照はできません。必ずAPIを通じて連携してください。

---

## 4. ドメインモデル

本プロジェクトでは、認証とアプリケーションのユーザー情報を物理的に分離したDB設計を採用しています。

### 4.1 auth_users（認証専用 - auth データベース）

認証サービス（authサービス）が管理するテーブル。認証に必要な最小限の情報のみを保持。

* `id: UUID` (PK)
* `email: string` (UNIQUE) — ログイン識別子
* `password_hash: string` — bcrypt ハッシュ
* `is_active: boolean` — アカウント有効フラグ
* `last_login_at: timestamp | null`
* `created_at: timestamp`
* `updated_at: timestamp`

> **注意**: auth_users は認証専用であり、ロールやプロフィール情報は保持しない。

### 4.2 roles（ロール定義 - app データベース）

アプリケーションサービス（appサービス）が管理するロールマスタ。

* `id: UUID` (PK)
* `name: string` (UNIQUE) — ロール名
* `level: int` — 権限レベル（数値が小さいほど高権限）
* `description: string | null`
* `created_at: timestamp`
* `updated_at: timestamp`

**初期ロール:**
| name | level | description |
|------|-------|-------------|
| super_admin | 1 | スーパー管理者 |
| admin | 2 | クライアント管理者 |
| user | 3 | 一般ユーザー |

### 4.3 app_users（アプリケーション用 - app データベース）

アプリケーションサービス（appサービス）が管理するユーザーテーブル。auth_usersと同じIDで自動作成される。

* `id: UUID` (PK) — auth_users.id と同一
* `display_name: string | null` — 表示名
* `role_id: UUID` (FK → roles.id) — ロール
* `first_name: string | null`
* `last_name: string | null`
* `avatar_url: string | null`
* `timezone: string` (default: 'Asia/Tokyo')
* `language: string` (default: 'ja')
* `created_at: timestamp`
* `updated_at: timestamp`

### 4.4 attendance_records（出退勤ログ - app データベース）

* `id: UUID` (PK)
* `user_id: UUID` (FK → app_users.id)
* `timestamp: timestamp` — 打刻日時（UTC 保存）
* `type: "CLOCK_IN" | "CLOCK_OUT" | "ADJUSTMENT"`
* `note: string | null` — 管理者コメント / 理由
* `source: "USER" | "ADMIN" | "SYSTEM"` — 誰が登録したか
* `created_at: timestamp`
* `updated_at: timestamp`

> **重要**:
>
> * このレコードはあくまで **「生の打刻ログ」** を保持する。
> * 労務上の「所定時間」「残業」等はここでは計算しない。
> * 集計ロジックは各プロジェクト側で実装する前提。

### 4.5 ER図

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                           auth データベース                              │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐                                                │
│  │     auth_users      │                                                │
│  ├─────────────────────┤                                                │
│  │ id (PK)             │◄──────────────────────────────────────────┐    │
│  │ email               │                                           │    │
│  │ password_hash       │                                           │    │
│  │ is_active           │                                           │    │
│  │ last_login_at       │                                           │    │
│  └─────────────────────┘                                           │    │
└─────────────────────────────────────────────────────────────────────│────┘
                                                                     │
                                                          同一ID     │
                                                          (API経由)  │
                                                                     │
┌─────────────────────────────────────────────────────────────────────│────┐
│                            app データベース                          │    │
├─────────────────────────────────────────────────────────────────────│────┤
│                                                                     │    │
│  ┌─────────────────────┐          ┌─────────────────────┐          │    │
│  │       roles         │          │     app_users       │          │    │
│  ├─────────────────────┤          ├─────────────────────┤          │    │
│  │ id (PK)             │◄─────────┤ role_id (FK)        │          │    │
│  │ name                │          │ id (PK)             │◄─────────┘    │
│  │ level               │          │ display_name        │               │
│  │ description         │          │ first_name          │               │
│  └─────────────────────┘          │ last_name           │               │
│                                   └─────────┬───────────┘               │
│                                             │                           │
│                                             │ 1:N                       │
│                                             ▼                           │
│                                   ┌─────────────────────┐               │
│                                   │ attendance_records  │               │
│                                   ├─────────────────────┤               │
│                                   │ id (PK)             │               │
│                                   │ user_id (FK)        │               │
│                                   │ timestamp           │               │
│                                   │ type                │               │
│                                   │ note                │               │
│                                   │ source              │               │
│                                   └─────────────────────┘               │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. API 仕様（サマリ）

※ Encore.dev のサービス関数として実装する想定。

### 5.1 認証 / ユーザー関連

* `POST /auth/login`

  * 入力: `{ email, password }`（認証方式はダミーでもよい）
  * 出力: `{ token, user: { id, name, email, role } }`
  * 備考:

    * ロール情報を JWT / セッションに含める
    * 本テンプレでは認証方式は簡易でよい（本番は各プロジェクトで差し替え）

* `GET /auth/me`

  * 現在ログインユーザー情報を返す

### 5.2 出退勤（一般ユーザー側）

* `POST /attendance/clock-in`

  * 認証必須: USER or ADMIN
  * 入力: `{ timestamp?: string }`（未指定ならサーバー時刻）
  * 処理:

    * `AttendanceRecord` に `type = CLOCK_IN` のレコードを保存
  * 出力: 保存したレコード

* `POST /attendance/clock-out`

  * 認証必須: USER or ADMIN
  * 入力: `{ timestamp?: string }`
  * 処理:

    * `AttendanceRecord` に `type = CLOCK_OUT` のレコードを保存
  * 出力: 保存したレコード

* `GET /attendance/me?from=YYYY-MM-DD&to=YYYY-MM-DD`

  * 認証必須: USER or ADMIN
  * ログインユーザーの期間内打刻一覧を返す

### 5.3 管理者向け出退勤

* `GET /admin/attendance?userId=&from=&to=`

  * 認証必須: ADMIN
  * 任意ユーザー・期間で打刻一覧を返す

* `PATCH /admin/attendance/:id`

  * 認証必須: ADMIN
  * 入力例:
    `{ timestamp?: string, type?: "CLOCK_IN" | "CLOCK_OUT" | "ADJUSTMENT", note?: string }`
  * 管理者による修正・コメント追加

### 5.4 AI 要約 API

* `POST /ai/attendance-summary`

  * 認証必須: ADMIN or USER（自分の分のみ or 全体などポリシーはオプション）
  * 入力:

    ```json
    {
      "userId": "string",
      "from": "YYYY-MM-DD",
      "to": "YYYY-MM-DD",
      "locale": "ja-JP"
    }
    ```
  * 処理:

    * 指定ユーザーの期間内 `AttendanceRecord` を取得
    * プロンプトテンプレートに埋め込み、AI クライアントに要約を依頼
  * 出力:

    ```json
    {
      "summary": "この期間の出退勤傾向の自然文サマリ",
      "rawRecordsCount": 24
    }
    ```

* AI クライアントのインターフェース例（TypeScript 擬似コード）:

  ```ts
  export interface AttendanceSummaryAI {
    summarizeAttendance(
      logs: AttendanceRecord[],
      options: { locale: string }
    ): Promise<string>;
  }
  ```

---

## 6. フロントエンド仕様（URL / 画面イメージ）

### 6.0 デプロイ構成

本プロジェクトでは、frontend-admin と frontend-user を**別サブドメイン**でデプロイすることを推奨します。

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        デプロイ構成                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [管理者向け]                    [ユーザー向け]                        │
│  admin.example.com              app.example.com                     │
│  └── frontend-admin             └── frontend-user                   │
│                                                                     │
│  [バックエンドAPI]                                                    │
│  api.example.com                                                    │
│  └── backend (Encore.dev)                                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**認証Cookie共有**: 同一ドメイン配下（example.com）のサブドメインであれば、Cookie の domain 設定により認証状態を共有可能。

### 6.1 `frontend-user` 側の URL 体系

ユーザー向けフロントエンド（`app.example.com`）は、以下のルートを持つ：

* `/login`
  * メール + パスワードの簡易ログインフォーム
  * ログイン成功時に `/dashboard` へ遷移
  * ログイン済みユーザーは自動リダイレクト

* `/dashboard`
  * 今日の出退勤状態の表示
    * 「出勤前」「勤務中」「退勤済み」など簡易ステータス
  * 出勤 / 退勤ボタン
  * 当日分の打刻履歴（時刻・種別）

* `/history`
  * 日付範囲フィルタ
  * 自分の打刻履歴一覧（テーブル or カレンダー）

* `/profile`（オプション）
  * ユーザー自身のプロフィール編集
  * 表示名、タイムゾーン、言語設定など

### 6.2 `frontend-admin` 側の URL 体系

管理者向けフロントエンド（`admin.example.com`）は、以下のルートを持つ：

* `/login`
  * 管理者用ログインフォーム
  * ログイン成功時に `/dashboard` へ遷移
  * **ロールチェック**: level <= 2 でない場合はエラー表示

* `/dashboard`
  * ユーザー一覧の簡易表示
  * 選択したユーザーの最近の打刻状況サマリなど
  * システム統計（オプション）

* `/attendance`
  * ユーザー選択（セレクトボックスなど）
  * 期間選択（from / to）
  * 打刻一覧テーブル
    * 行単位で「編集」ボタン（モーダルで timestamp / type / note 修正）
  * 「AI要約を表示」ボタン
    * 期間内のサマリを画面上にテキストで表示

* `/users`（オプション）
  * ユーザー管理画面
  * ロール変更、アカウント有効/無効切り替え

### 6.3 認証フローの詳細

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        認証フロー                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. ユーザーがログインフォームで認証情報を入力                          │
│     └── POST /auth/login (email, password)                          │
│                                                                     │
│  2. バックエンドで認証処理                                            │
│     ├── auth_users でメール/パスワード検証                            │
│     ├── app_users からロール情報取得                                  │
│     └── JWT トークン発行（access_token + refresh_token）              │
│                                                                     │
│  3. フロントエンドでトークン保存                                       │
│     └── HttpOnly Cookie（domain: .example.com）                      │
│                                                                     │
│  4. アクセス制御（frontend-admin の場合）                              │
│     ├── GET /app/users/me でロール取得                               │
│     ├── level <= 2 ならアクセス許可                                   │
│     └── level > 2 ならエラー画面 or frontend-user へリダイレクト       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 7. セキュリティ / バリデーション

* 最低限、以下のチェックを行う：

  * 認証必須エンドポイントでの JWT / セッション検証
  * USER は自分以外の `userId` のデータを参照できない
  * ADMIN のみ `/admin/*` に関するエンドポイントへアクセス可能
  * 入力時の timestamp のフォーマット検証

* 本テンプレは **セキュリティの完全性** を目的としないが、
  「参考実装として恥ずかしくない程度」のバリデーション・チェックは行う。

---

## 8. ClaudeCode / AIエージェント向け 実装タスク

以下のタスクを順番に実施する想定。
**既存のテンプレート機能（認証、エラーハンドリング、API ラッパー等）を最大限活用すること。**

### Phase 0: 既存リポジトリの確認 ✅ 完了

* [x] `backend`（Encore TypeScript プロジェクト）の構成確認
  * services/auth: 認証サービス（auth_users テーブル）
  * services/app: アプリケーションサービス（app_users, roles テーブル）
  * services/notification: 通知サービス
  * shared/: 共通モジュール（errors, monitoring）
* [x] `frontend-admin` の SvelteKit プロジェクト構成を確認
* [x] `frontend-user` の SvelteKit プロジェクト構成を確認（新規作成）
* [x] `packages/shared` ディレクトリ作成（pnpm workspace）
  * errors/: エラー型・コード・変換
  * stores/: Svelte ストア
  * auth/: 認証ヘルパー・型
  * types/: 共通型定義

### Phase 1: バックエンド ドメインモデル & DB（出退勤）

* [ ] `backend/services/app/migrations/` に attendance_records テーブル追加
  ```sql
  CREATE TABLE attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id),
    timestamp TIMESTAMPTZ NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('CLOCK_IN', 'CLOCK_OUT', 'ADJUSTMENT')),
    note TEXT,
    source TEXT NOT NULL CHECK (source IN ('USER', 'ADMIN', 'SYSTEM')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ```
* [ ] `backend/services/app/modules/attendance/` に型定義・リポジトリ実装
* [ ] シードデータ（テスト用打刻レコード）

### Phase 2: 認証 & ロール分離 ✅ 既存機能活用

既存の認証システムを活用：
* [x] auth サービス: ログイン/ログアウト/トークンリフレッシュ
* [x] app サービス: ユーザー情報取得（ロール含む）
* [x] permissions.ts: ロールチェック機能（checkPermission, requirePermission）

追加タスク：
* [ ] frontend-admin でのロールチェック（level <= 2）実装
* [ ] frontend-user でのロールチェック（認証済み全員）実装

### Phase 3: 出退勤 API

* [ ] `POST /app/attendance/clock-in` - 出勤打刻
* [ ] `POST /app/attendance/clock-out` - 退勤打刻
* [ ] `GET /app/attendance/me` - 自分の打刻履歴取得
* [ ] `GET /app/attendance/today` - 今日の打刻状態取得
* [ ] `GET /app/admin/attendance` - 管理者: 任意ユーザーの打刻一覧（level <= 2 必須）
* [ ] `PATCH /app/admin/attendance/:id` - 管理者: 打刻修正（level <= 2 必須）
* [ ] バリデーション・エラーハンドリング（shared/errors 活用）

### Phase 4: `frontend-user` 実装

* [ ] `/login` 画面（既存 frontend-admin から移植・調整）
* [ ] `/dashboard` に出退勤ボタン + 当日ログ表示
  * 出勤/退勤ボタン
  * 今日の打刻ステータス表示
  * 当日打刻履歴
* [ ] `/history` に履歴一覧
  * 日付範囲フィルタ
  * テーブル or カレンダー表示
* [ ] `/profile` プロフィール編集（オプション）
* [ ] API クライアント実装（packages/shared の認証ヘルパー活用）

### Phase 5: `frontend-admin` 拡張

* [ ] `/attendance` 出退勤管理画面
  * ユーザー選択
  * 期間選択
  * 打刻一覧テーブル
  * 編集モーダル
* [ ] `/users` ユーザー管理画面拡張（ロール変更機能）

### Phase 6: AI 要約機能

* [ ] `backend/services/app/modules/ai/` に AI クライアントインターフェース定義
  ```typescript
  export interface AttendanceSummaryAI {
    summarizeAttendance(
      logs: AttendanceRecord[],
      options: { locale: string }
    ): Promise<string>;
  }
  ```
* [ ] ダミー実装 or OpenAI/Anthropic クライアント実装
* [ ] `POST /app/ai/attendance-summary` エンドポイント実装
* [ ] `frontend-admin` の `/attendance` 画面に「AI要約」ボタン追加

### Phase 7: ドキュメント & テスト

* [ ] `README.md` にセットアップ手順・全体説明
* [ ] E2E テスト（Playwright）
  * ログインフロー
  * 出退勤操作
  * 管理者機能
* [ ] 本 PLAN と「責務境界」の説明を README に簡略版として記載

---

## 9. 今後の拡張のための注意点

* AttendanceRecord の構造は、将来的に

  * 予約ログ
  * 申込ステータス履歴
  * チャットログ
    などにも再利用できるよう、**イベントログ的な設計** を意識する。

* 法令・就業規則依存のロジックは、本テンプレ側には一切持ち込まない。

  * 必要であれば、「集計結果を保存する別テーブル」は各プロジェクトで追加する前提。

