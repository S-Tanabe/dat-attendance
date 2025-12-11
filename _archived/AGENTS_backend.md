# AI作業プロンプト: Encore.dev (TypeScript) モジュラモノリス / 実装・テスト・デバッグ

このプロンプトは **AI** が `encore.dev (TypeScript版)` で構築されたバックエンドの **実装・テスト・デバッグ** を安全かつ効率的に行うための、**厳格な実行規約・手順書** です。  
**制限や指示を緩めたり曖昧化することは一切認めません。** 必ず本ドキュメントのルールを優先してください。

---

## 0. プロジェクト基本方針（必読）
- 本プロジェクトは **モジュラモノリス** で構築されています（Encore TypeScript 版を使用）。  
- 既存のサービスや仕様を **勝手に変更しない**。必要な追加は別タスクとして提案し、現在のタスクでは依存APIの呼び出しで対応します。  
- **フロントエンドSDKは自動生成**（`npm run gen:client`）。**生成物は直接編集不可**。API変更時は生成し直してからフロント作業を行います。  
- Encore の利用は **encore-mcp** と **公式ドキュメント**（https://encore.dev/docs/ts）を参照のうえ実施すること。

---

## 1. ハードルール（絶対順守）
1. **命名規則**: フォルダ・ファイル・API すべて **小文字 + スネークケース**。SDK生成時の整合性のため厳守。  
2. **他サービス非改変**: あるサービスを実装中は **他サービスの仕様変更を禁止**。必要APIは別プロセスで追加。  
3. **環境変数管理**: `.env` は禁止。**CUE**（`.secrets.local.cue` 等）で管理。秘密鍵は本番サーバに保存。  
4. **ログ**: Encore のロギングを必ず使用（`encore.dev/log`）。  
5. **API設定**: `auth` と `expose` の指定を必ず検討・設定（表は後述）。  
6. **トランザクション**: スキーマ横断の処理は **呼び出されるサービス側のフォルダに`orchestrator/`** を配置、自作オーケストレーションを実装し、API から呼び出す。**orchestrator はサービスではない**のでフロントから直接呼ばない。  
7. **サービス間参照**: 他サービスのテーブルは **直接参照しない**。**~encore/clients** 経由でそのサービスの API を呼ぶ。  
8. **EncoreはTypeScript版**のみ使用（Goは使用しない）。
9. servicesを編集・API追加などを行うときは各サービスフォルダ(services/auth等)の直下にあるdocs/DEV_GUIDE.mdを先に確認する。

---

## 2. アーキテクチャ：モジュラモノリス
- デプロイは **1環境**、内部は **複数モジュール（サービス）** で構成。  
- **データベースは `app` に統合**し、論理分離は PostgreSQL の `schema.table`（例: `crm.customer`, `workflow.order_header`）で行う。`auth`/`dev_tools`/`notification`/`app` 以外の SQLDatabase を新設してはならない。  
- 他サービスのデータは **API 経由（~encore/clients）** で関数呼び出し。通信越しではなく内部呼び出しとして扱われ、呼び出される側は `expose: false` でも良い。  
- **認証情報は内部呼び出しに自動伝搬**。必要に応じて **上書き** も可能。

### サービス間呼び出し（例）
```ts
import { api } from "encore.dev/api";
import { anotherService } from "~encore/clients";

export const handler = api(
  { expose: true, method: "GET", path: "/call" },
  async (): Promise<{ message: string }> => {
    const resp = await anotherService.foo({ /* params */ });
    return { message: `Response: ${resp.data}` };
  },
);
```
### 認証情報の上書き（例）
```ts
import { svc } from "~encore/clients";
const resp = await svc.endpoint(params, { authData: { userID: "...", userEmail: "..." } });
```

---

## 2.5. エラーハンドリング

本プロジェクトでは、バックエンドとフロントエンドで統一されたエラーハンドリングシステムを採用しています。

### エラー生成ヘルパー関数

`shared/errors/helpers.ts` に定義されたヘルパー関数を使用してエラーを生成します。

#### バリデーションエラー

```ts
import { createValidationError } from "../../shared/errors";

if (!email.includes("@")) {
  throw createValidationError("email", "Invalid email format", { providedValue: email });
}
```

#### ビジネスロジックエラー

```ts
import { createBusinessError, AuthErrorCode } from "../../shared/errors";

throw createBusinessError(
  AuthErrorCode.TOKEN_EXPIRED,
  "JWT token has expired",
  {
    retryable: true,
    suggestedAction: "relogin",
    metadata: { expiredAt: new Date().toISOString() }
  }
);
```

#### リソース不在エラー

```ts
import { createNotFoundError } from "../../shared/errors";

const user = await db.users.findOne({ id: userId });
if (!user) {
  throw createNotFoundError("User", userId);
}
```

#### 権限エラー

```ts
import { createPermissionError } from "../../shared/errors";

if (!hasPermission(user, "delete_user")) {
  throw createPermissionError("delete", "User");
}
```

#### 認証エラー

```ts
import { createAuthenticationError, AuthErrorCode } from "../../shared/errors";

throw createAuthenticationError(
  AuthErrorCode.INVALID_TOKEN,
  "Invalid authentication token",
  { reason: "Token signature verification failed" }
);
```

#### 外部サービスエラー

```ts
import { createExternalServiceError } from "../../shared/errors";

try {
  await externalApi.sendEmail(params);
} catch (err) {
  throw createExternalServiceError("EmailService", err as Error);
}
```

#### システムエラー（予期しないエラー）

```ts
import { createInternalError } from "../../shared/errors";

try {
  await criticalOperation();
} catch (err) {
  throw createInternalError("Critical operation failed", err as Error);
}
```

### エラーコード定義

エラーコードは `shared/errors/error-codes.ts` で管理されています：

- **AuthErrorCode**: 認証関連エラー（`ERR_AUTH_001` 〜 `ERR_AUTH_004`）
- **UserErrorCode**: ユーザー関連エラー（`ERR_USER_001` 〜 `ERR_USER_007`）
- **NotificationErrorCode**: 通知関連エラー（`ERR_NOTIFICATION_001` 〜 `ERR_NOTIFICATION_002`）
- **DevToolsErrorCode**: 開発ツール関連エラー（`ERR_DEVTOOLS_001`）

新しいエラーコードを追加する場合は、以下の命名規則に従います：

```typescript
// 例: Order サービスのエラーコード
export enum OrderErrorCode {
  ORDER_NOT_FOUND = "ERR_ORDER_001",
  INVALID_QUANTITY = "ERR_ORDER_002",
  INSUFFICIENT_STOCK = "ERR_ORDER_003",
}
```

### Sentry 統合（オプション）

サービスに Sentry ミドルウェアを適用することで、エラーを自動的に追跡できます：

```ts
// services/myservice/encore.service.ts
import { Service } from "encore.dev/service";
import { sentryMiddleware } from "../../shared/monitoring";

export default new Service("myservice", {
  middlewares: [sentryMiddleware],
});
```

**Sentry の設定**:
- ローカル開発環境: `backend/.secrets.local.cue` に `SENTRY_DSN_BACKEND` を設定
- 本番環境: `encore secret set --prod SENTRY_DSN_BACKEND` で設定

### ベストプラクティス

1. **適切なヘルパー関数を使用**: 直接 `APIError` を生成せず、ヘルパー関数を使用
2. **エラーコードの一貫性**: 新しいエラーコードは `ERR_<SERVICE>_<NUMBER>` 形式で定義
3. **再試行可能フラグ**: ネットワークエラーや一時的なエラーは `retryable: true` を設定
4. **機密情報を含めない**: エラーメッセージにパスワード、トークンなどを含めない
5. **フロントエンドとの連携**: エラーコードはフロントエンドの `error-messages.ts` でユーザー向けメッセージに変換される

### 実装例

```ts
import { api } from "encore.dev/api";
import { createBusinessError, createNotFoundError, UserErrorCode } from "../../shared/errors";

export const updateUser = api(
  { expose: true, method: "PUT", path: "/users/:id", auth: true },
  async ({ id, email }: { id: string; email: string }): Promise<{ success: boolean }> => {
    // ユーザーの存在確認
    const user = await db.users.findOne({ id });
    if (!user) {
      throw createNotFoundError("User", id);
    }

    // メールアドレスの重複チェック
    const existing = await db.users.findOne({ email, id: { $ne: id } });
    if (existing) {
      throw createBusinessError(
        UserErrorCode.EMAIL_ALREADY_EXISTS,
        "Email address is already in use",
        {
          retryable: false,
          suggestedAction: "use_different_email",
          metadata: { email }
        }
      );
    }

    // 更新処理
    await db.users.updateOne({ id }, { email });
    return { success: true };
  }
);
```

---

## 3. API の auth / expose 設計
| 設定 | 外部アクセス | 内部サービス呼び出し | Cronジョブ |
| --- | --- | --- | --- |
| expose: false（デフォルト） | ❌ | ✅ | ✅ |
| expose: true | ✅ | ✅ | ✅ |

ポイント: 外部公開不要の内部専用エンドポイントは expose: false にする。認証が必要な場合は auth: true を設定。

### サービス間でデータベースを共有する
サービス間でデータベースを共有するには、主に2つの方法がある：

1. 共有モジュールの SQLDatabase オブジェクトをエクスポートされた変数として定義し、データベースにアクセスする必要のあるすべてのサービスからこのオブジェクト を参照することができます。
2. あるサービスでは new SQLDatabase("name", ...) を使用して SQLDatabase オブジェクトを定義し、他のサービスでは SQLDatabase.named("name") を使用して参照を作成してアクセスすることができます。

どちらのアプローチも同じ効果をもたらすが、後者の方がより明確である。

## 4. マイグレーション & シード

- **マイグレーション**: サービス単位で migrations/ を作成し、0001 から連番。encore run 時に自動実行。既存例は auth サービス を参照。
- **シード**: scripts/ に作成（例: scripts/seed.ts）。実行は encore exec -- npx tsx scripts/seed.ts。複数ファイルに分割可。

## 5. Cron ジョブ

```ts
import { CronJob } from "encore.dev/cron";
import { api } from "encore.dev/api";

const _ = new CronJob("welcome-email", {
  title: "Send welcome emails",
  every: "2h",
  endpoint: sendWelcomeEmail,
});

export const sendWelcomeEmail = api({}, async () => {
  // Send welcome emails...
});
```

## 6. ロギング
```ts
import log from "encore.dev/log";

log.info("log message", { is_subscriber: true });
log.error(err, "something went terribly wrong!");
```

- ライブ閲覧(例):
```bash
$ encore logs --env=prod
```

## 7. CLIからのDB接続（TTY問題回避）
```bash
cd {PROJECT_ROOT}/backend
encore db conn-uri <database-name>
# 例: postgresql://user:password@localhost:5432/database_name

export DB_CONN="postgresql://user:password@localhost:5432/database_name"

# 単一クエリ
psql "$DB_CONN" -c "SELECT * FROM users LIMIT 5;"

# 複数クエリ
psql "$DB_CONN" -c "
SELECT COUNT(*) as user_count FROM users;
SELECT COUNT(*) as session_count FROM sessions;
SELECT * FROM users WHERE created_at > NOW() - INTERVAL '1 day';
"

# ファイルから実行
psql "$DB_CONN" -f query.sql

```

## 8. テスト

- 原則: テストは別の指示で行う。
- encore test は テスト用 PostgreSQL を自動起動し、自然に接続される。
- テストのためにロジックを緩めない（本末転倒禁止）。
- テストケース: （仕様に基づき正常系/異常系/権限/境界値を網羅することを推奨。）
- encore testではencore側の性的構文解析とvitestが走るため、単独でのvitest実行は禁止。
- テスト用のレコードを作成する場合、id(uuid)は自動生成される。（id UUID PRIMARY KEY DEFAULT gen_random_uuid()）

### 認証モック(vitest)

```ts
import { describe, expect, test, vi } from "vitest";
import * as auth from "~encore/auth";
import { get } from "./hello";

describe("get", () => {
  test("should combine string with parameter value", async () => {
    const spy = vi.spyOn(auth, 'getAuthData');
    spy.mockImplementation(() => ({ 
      userID: "user-456",
      role: "user"  // 管理者権限なし
    }));

    const resp = await get({ name: "world" });
    expect(resp.message).toBe("Hello world! You are authenticated with user@email.com");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });
});
```
### DB操作(テスト)

- encore test により テスト用PostgreSQL が使用可能。ただし マイグレーションは自動適用されない ため、テスト直前に必要テーブル・データを投入 する。

```ts
import { describe, beforeEach, test, expect } from "vitest";
import { db } from "~encore/db"; // テスト用に接続される

describe("Product API", () => {
  beforeEach(async () => {
    await db.exec`
      INSERT INTO ...
    `;
  });

  test("should fetch products", async () => {
    // テストロジック...
  });
});

```

## 9. デバッグ運用

- DB接続URI（ローカル）:
```bash
encore db conn-uri <database-name> --env=local
```

- 開発環境専用のAI向けテストアカウント（UI操作やE2Eテストで使用可）:
  - ID: ai@fox-hound.jp
  - PW: A_word_is_enough_to_the_wise
  - role: super_admin
  - 開発環境のみで作成。本番での使用・作成は禁止。
- 一時スクリプト: backend/tmp/ を使用（Git管理外）。例:
```ts
// scripts/debug-db.ts
import { db } from "../services/yourservice/database";

async function debugDatabase() {
  console.log("=== Database Debug Info ===");
  
  const tables = await db.rawQueryAll(`
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public'
  `);
  console.log("Tables:", tables);
  
  for (const table of tables) {
    const count = await db.rawQueryRow(
      `SELECT COUNT(*) as count FROM ${table.tablename}`
    );
    console.log(`${table.tablename}: ${count.count} rows`);
  }
  
  const recentUsers = await db.rawQueryAll(`
    SELECT * FROM users 
    ORDER BY created_at DESC 
    LIMIT 3
  `);
  console.log("Recent users:", recentUsers);
}

debugDatabase().catch(console.error);
```
- 調査が難航する場合: 同一エラーに 3回以上連続 で遭遇したら、Encore の ブレークポイント機能 による調査が必要。現状 AIは未対応 のため、必ず人間（オーナー）に依頼 すること。

## 10. 既存構成 (初期セットアップ) の理解

- auth: 認証サービス（docs/SERVICE_AUTH_SPEC.md 参照）。
- user: ユーザー設定サービス（docs/SERVICE_USER_SPEC.md 参照）。
- auth.auth_user.id と user.user.id は 同一ID。
- 初期データ投入スクリプト: scripts/seed.ts。
- ORM は Encore ビルトイン を使用。
- サービスごとに schema を分け、各サービスの migrations/ を 0001 から連番で管理。encore run で自動実行。

## 11. フロントエンドSDK生成
```bash
npm run gen:client
```
- [IMPORTANT] **生成物は直接編集不可**。API を変更・追加したら 必ず再生成 のうえフロント作業を行うこと。

## 12. 作業フロー (AIの実行手順)

1. 仕様確認 → 影響範囲特定（他サービス改変禁止の観点で分離）。
2. スキーマ/マイグレーション設計（必要時）。
3. サービスAPI実装（auth/expose 設計、ロギング必須）。
4. サービス間連携が必要なら ~encore/clients 経由で呼び出し（必要時 authData 上書き）。
5. ユニットテスト実装（認証モック・DB準備を行い、encore test を使用）。
6. シード/Fixtures 更新が必要なら encore exec -- npx tsx scripts/seed.ts。
7. SDK再生成 npm run gen:client。
8. ログ/DB/動作確認（encore logs / encore db conn-uri）。
9. 同一エラー3回以上 → ブレークポイント調査を人間に依頼。
10. 変更点と制約順守をチェックして完了。

## 13. クイックコマンド集

- テスト実行: `encore test`
- シード実行: `encore exec -- npx tsx scripts/seed.ts`
- SDK生成: `npm run gen:client`
- ログ確認: `encore logs --env=prod`
- DB接続URI取得: `encore db conn-uri <database-name> [--env=local]`
- マイグレーション適用（テスト環境）: `encore migrate apply --env=test`

## encore-mcpのクイックコマンド集

- データベースツール
  - `get_databases`： アプリケーションで定義されているすべての SQL データベース (スキーマ、テーブル、リレーションシップを含む) のメタデータを取得します。
  - `query_database`： アプリケーション内の1つ以上のデータベースに対して SQL クエリを実行する。
- APIツール
  - `call_endpoint`： アプリケーション内の任意のAPIエンドポイントにHTTPリクエストを行う。
  - `get_services`： アプリケーション内のすべてのサービスとそのエンドポイントに関する包括的な情報を取得します。
  - `get_middleware`： アプリケーション内のすべてのミドルウェアコンポーネントの詳細情報を取得します。
  - `get_auth_handlers`： アプリケーション内のすべての認証ハンドラに関する情報を取得する。
- トレースツール
  - `get_traces`： タイミング、ステータス、関連するメタデータを含む、 リクエストトレースのリストをアプリケーションから取得します。
  - `get_trace_spans`： すべてのスパン、タイミング情報、関連するメタデータを含む、1つ以上のトレースに関する詳細情報を取得します。
- ソースコードツール
  - `get_metadata`： サービス定義、データベーススキーマ、APIエンドポイント、その他のインフラストラクチャコンポーネントを含む、完全なアプリケーションメタデータを取得します。
  - `get_src_files`： アプリケーションから1つ以上のソース・ファイルの内容を取得する。
- PubSubツール
  - `get_pubsub`： アプリケーション内のすべてのPubSubトピックとその購読に関する詳細情報を取得します。
- 収納ツール
  - `get_storage_buckets`： アプリケーション内のすべてのストレージバケットに関する包括的な情報を取得します。
  - `get_objects`： 一つ以上のストレージバケットに格納されているオブジェクトのメタデータをリストアップして取得する。
- キャッシュツール
  - `get_cache_keyspaces`： アプリケーション内のすべてのキャッシュ鍵空間に関する包括的な情報を取得する。
- 測定ツール
  - `get_metrics`： アプリケーションで定義されているすべてのメトリクスに関する包括的な情報を取得します。
- クロンツール
  - `get_cronjobs`： アプリケーションでスケジュールされている全てのcronジョブの詳細情報を取得します。
- 秘密の道具
  - `get_secrets`： アプリケーションで使われる全ての秘密についてのメタデータを取得する。
- ドキュメンテーション・ツール
  - `search_docs`： アルゴリアの検索エンジンを使ってエンコアのドキュメントを検索します。
  - `get_docs`： 特定のドキュメントページの全内容を取得する。

## 15. 禁止事項(再掲)

- .env 使用（禁止。CUE を使用）。
- 直接 vitest 実行（禁止。encore test を使用）。
- 他サービスの仕様変更（禁止。別タスクで対応）。
- 他サービスのDBテーブルへ直接クエリ（禁止。API経由）。
- 生成済みフロントSDKの直接編集（禁止）。


このプロンプトに従って、実装・テスト・デバッグ を行い、制約を緩めず、常に再現可能な形で 作業してください。