# **AI駆動開発：勤怠テンプレート発表用スライド構成案（15枚）**

---

# **1. タイトルスライド**

### **AI駆動開発における共通テンプレートの提案

― 出退勤ログ × ロール分離ベース ―**

**内容**

* 発表者名
* 日付
* プロジェクト名（任意）

**話すポイント**

* 今回は「AI駆動開発で使い回せるテンプレート」として出退勤ベースを提案する。

---

# **2. 背景：なぜ共通テンプレートが必要か**

**内容**

* プロジェクトごとに UI / API / 認証 / ロール分離が毎回バラバラに実装されている
* 実装コストの重複
* 初学者が構造を理解しづらい
* AI駆動開発のフローにもばらつきがある

**話すポイント**

* プロジェクト横断で利用できる最低限の基盤を揃える必要性が高まっている。

---

# **3. 解決策：出退勤 × ロール分離のテンプレート化**

**内容**

* 汎用性の高い「ユーザー/管理者ロール分離」と
* どのサービスにも応用できる「状態ログ（出退勤）」を題材に選定

**話すポイント**

* 出退勤は業務ロジックの深い部分に入らず、どのサービスにも展開できる"教育しやすい題材"。

---

# **4. なぜ勤怠全体ではなく出退勤に絞るのか？**

**内容：簡易表（3点）**

* 勤怠全体は会社ごとの就業規則でロジックが激変する
* 汎用化しようとすると例外処理だらけになり、再利用性が低下
* 出退勤は「ログ収集」として普遍的でテンプレ化しやすい

**話すポイント**

* 出退勤ならあくまでローデータなので、法的・会社固有ルールに巻き込まれない。

---

# **5. テンプレが担当する範囲（責務）**

（図つきで示すと良い）

**内容**

* ロール分離（user / admin）
* 認証と画面遷移制御
* **3種類の打刻方式**
  * ボタン打刻
  * QRコード打刻（ユーザーがQR表示 → 管理者がスキャン）
  * 顔認証打刻（顔データ登録・照合）
* 打刻ログ保存（時刻・種別・方式）
* 打刻履歴 API（ユーザー / 月次 / 日次）
* 管理向け一覧・打刻承認
* **ユーザー設定（プロフィール編集・顔データ管理）**
* AI要約（週次/傾向分析）

**話すポイント**

* **ここだけ**を共通化することで、あらゆるプロジェクトに組み込みやすくする。
* 多様な打刻方式に対応し、現場の運用に合わせて選択可能。

---

# **6. テンプレが担当しない範囲（各プロジェクト固有領域）**

（例を箇条書きで表示）

**内容**

* 所定労働時間・休憩ルール
* シフト管理
* 遅刻・早退の判定
* 残業時間の計算ロジック
* 深夜・休日割増計算
* 有給・休暇制度
* 給与システム連携

**話すポイント**

* なぜ"やらない"のか？ → 会社ごとにまったく違うためテンプレ側の責務にしない方が再利用性が高い。

---

# **7. 責務の境界線（主要スライド）**

※さきほどの一枚絵をそのまま使う

**内容**

* 上段：就業規則（企業ごとに違う世界）
* 中段：各プロジェクト固有ロジック
* 下段：共通テンプレが担当するコア（出退勤ログ・ロール分離）

**話すポイント**

* 「この線引きを明確にすることがAI駆動開発のテンプレ化成功の鍵」
* この図をチームで共有することで、各プロジェクトの実装範囲も明確化される。

---

# **8. Frontend分離の設計思想**

**なぜ分離したか？**

| 単一ディレクトリの問題 | 分離のメリット |
|---------------------|--------------|
| 同一ソースから2つのビルド生成が複雑 | 独立したビルド・デプロイが可能 |
| admin用コードがuser側に混入するリスク | バンドルサイズ最適化 |
| 環境変数管理が煩雑 | 設定の明確化 |
| 片方だけ更新したくても両方ビルド | 将来的なチーム分離も可能 |

**デプロイ構成イメージ**

```
              ┌─────────────────────────┐
              │      Load Balancer      │
              └───────────┬─────────────┘
                          │
      ┌───────────────────┼───────────────────┐
      │                   │                   │
      ▼                   ▼                   ▼
admin.example.com   app.example.com    api.example.com
      │                   │                   │
┌─────┴─────┐       ┌─────┴─────┐       ┌─────┴─────┐
│ frontend- │       │ frontend- │       │  backend  │
│   admin   │       │   user    │       │(Encore.dev)│
└───────────┘       └───────────┘       └───────────┘
```

**話すポイント**

* 管理画面とユーザー画面を**サブドメインで完全分離**
* 独立デプロイにより、片方の更新が他方に影響しない
* セキュリティ境界も明確化（管理者向けコードがユーザーに露出しない）

---

# **9. packages/shared の詳細設計**

**pnpm workspace による monorepo 構成**

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'       # 共通パッケージ
  - 'frontend-admin'   # 管理画面
  - 'frontend-user'    # ユーザー向け
```

**packages/shared の構造**

```text
packages/shared/
├── package.json          # "@dat-attendance/shared"
├── errors/               # 統一エラーハンドリング
│   ├── error-codes.ts    # エラーコード定義（AUTH_001等）
│   ├── error-messages.ts # 日本語エラーメッセージ
│   ├── transformer.ts    # API→UIエラー変換
│   └── types.ts          # UIError型定義
├── stores/               # Svelte stores
│   ├── error.ts          # エラー状態管理
│   └── toast.ts          # Toast通知
├── auth/                 # 認証ヘルパー
│   └── tokens.ts         # Cookie操作、token管理
└── types/                # 共通型定義
    └── index.ts
```

**各frontendからの参照方法**

```json
// frontend-user/package.json
{
  "dependencies": {
    "@dat-attendance/shared": "workspace:*"  // workspaceプロトコル
  }
}
```

```typescript
// frontend-user/src/lib/errors/transformer.ts
export { transformToUIError, type UIError } from '@dat-attendance/shared/errors';
```

**話すポイント**

* **workspace:*** でローカルパッケージを参照（npm publish不要）
* 共通コードの変更が両frontendに即座に反映
* 型定義も共有されるため、一貫性のあるエラーハンドリングが可能

---

# **10. 認証・権限の設計**

**認証フローの共有**

```typescript
// packages/shared/auth/tokens.ts（両frontendで共通利用）
export function setTokensToCookies(cookies, tokens) {
  cookies.set('access_token', tokens.access_token, { ... });
  cookies.set('refresh_token', tokens.refresh_token, { ... });
}

export async function withAutoRefresh(client, cookies) {
  // 401エラー時に自動でrefreshToken呼び出し
}
```

**権限チェックの分岐**

| frontend | 権限要件 | 実装箇所 |
|----------|---------|---------|
| **frontend-admin** | admin または manager ロール必須 | `+layout.server.ts` |
| **frontend-user** | 認証済みであればOK（role不問） | `+layout.server.ts` |

```typescript
// frontend-admin/src/routes/(app)/+layout.server.ts
export const load = async ({ cookies }) => {
  const profile = await client.app.get_user_profile();

  // 管理者権限チェック
  if (!profile.roles.includes('admin') && !profile.roles.includes('manager')) {
    throw redirect(303, USER_APP_URL);  // ユーザー画面へリダイレクト
  }
  return { user: profile };
};

// frontend-user/src/routes/(app)/+layout.server.ts
export const load = async ({ cookies }) => {
  const profile = await client.app.get_user_profile();
  // 認証済みならOK（ロール不問）
  return { user: profile };
};
```

**話すポイント**

* **同一Backend API、異なる権限チェック**: authサービスは共通、権限判定はFrontend側
* 管理者アカウントでユーザー画面にもアクセス可能（逆は不可）
* Cookie共有により、同一ドメインならシームレスなSSO体験
* JWTにroles情報を含めることで、APIレベルでも権限チェック可能

---

# **11. アーキテクチャ（実装済み構成）**

```text
dat-attendance/
├── backend/                    # Encore.dev TypeScript バックエンド
│   └── services/
│       ├── auth/              # 認証サービス（JWT + Session）
│       ├── app/               # 業務サービス
│       │   └── modules/
│       │       └── attendance/  # 打刻機能（QR・顔認証・ボタン）
│       ├── notification/      # 通知サービス（SSE）
│       └── dev_tools/         # 開発ツール
│
├── frontend-admin/            # 管理者向け SvelteKit アプリ
│   └── src/routes/(app)/
│       ├── dashboard/         # ダッシュボード
│       ├── users/             # ユーザー管理
│       └── dev_tools/         # 開発ツール
│
├── frontend-user/             # ユーザー向け SvelteKit アプリ
│   └── src/routes/(app)/
│       ├── dashboard/         # 打刻画面（QR・顔認証・ボタン）
│       ├── history/           # 打刻履歴
│       └── settings/          # ユーザー設定
│
└── packages/shared/           # 共通パッケージ（pnpm workspace）
    ├── errors/                # エラー型・変換・コード
    ├── stores/                # Svelte stores
    └── types/                 # 共通型定義
```

**話すポイント**

* **Frontend分離**: 管理者向け（frontend-admin）とユーザー向け（frontend-user）を明確に分離
* **pnpm workspace**: 共通コードを packages/shared で管理し、重複を排除
* **マイクロサービス**: Encore.dev でサービスごとにDB分離（auth/app/notification）
* Svelte 5 + DaisyUI + Tailwind CSS v4 で最新技術スタックを採用

---

# **12. 実装した打刻方式（デモ構成）**

**内容：3つの打刻方式**

| 方式 | ユーザー操作 | 管理者操作 | 用途 |
|------|-------------|-----------|------|
| **ボタン打刻** | 出勤/退勤ボタンをタップ | - | シンプルな打刻 |
| **QRコード打刻** | QRコードを表示 | カメラでスキャン | 対面確認が必要な場合 |
| **顔認証打刻** | カメラに顔を向ける | - | 本人確認を自動化 |

**顔認証の実装詳細**

* face-api.js を使用したブラウザ内顔認識
* 128次元の顔特徴量ベクトルをPostgreSQLに保存
* ユークリッド距離で照合（閾値: 0.6）
* 登録・照合ともにクライアントサイドで処理（プライバシー配慮）

**話すポイント**

* 現場の運用形態に合わせて柔軟に選択可能
* 顔認証はサーバーに画像を送らず、特徴量のみ保存

---

# **13. デモシナリオ**

**デモ手順**

1. **ユーザー向け画面（frontend-user: port 5174）**
   * ログイン → ダッシュボード表示
   * ボタン打刻で出勤
   * QRコードタブでQR表示
   * 顔認証タブで顔データ登録・打刻
   * 履歴画面で打刻履歴確認
   * 設定画面でプロフィール編集・顔データ管理

2. **管理者向け画面（frontend-admin: port 5173）**
   * ログイン → ダッシュボード表示（直近打刻履歴）
   * QRスキャンでユーザーの打刻を記録
   * ユーザー管理画面で全ユーザー一覧

**話すポイント**

* 「AI駆動開発らしさ」を入れることでテンプレの価値が一段上がる。
* E2Eテスト（Playwright）も整備済みで品質担保。

---

# **14. 技術スタックと品質管理**

**技術スタック**

| レイヤー | 技術 | バージョン |
|---------|------|-----------|
| Backend | Encore.dev (TypeScript) | v1.51.4 |
| Frontend | SvelteKit + Svelte 5 | v2.47.1 / v5.41.0 |
| UI | DaisyUI + Tailwind CSS | v5.4.3 / v4.1.14 |
| DB | PostgreSQL | 14+ |
| 監視 | Sentry | v8.55.0 |
| 顔認識 | face-api.js | v0.22.2 |

**品質管理**

* **ESLint**: コード品質チェック（厳格モード）
* **svelte-check**: TypeScript型チェック
* **Husky**: pre-commit / pre-push フック
* **lint-staged**: 変更ファイルのみLint
* **Playwright**: E2Eテスト

**話すポイント**

* 最新の Svelte 5 Runes 構文を採用（$state, $derived, $effect）
* AI駆動開発でも品質を担保する仕組みを整備

---

# **15. まとめ & 今後の発展**

**内容**

* 出退勤テンプレは「共通ログ基盤」として流用しやすい
* 人事・給与・シフトなど会社固有ロジックとは責務分離
* **実装完了した機能**
  * 3種類の打刻方式（ボタン・QR・顔認証）
  * ユーザー/管理者の画面分離
  * 打刻履歴・ユーザー設定
  * E2Eテスト基盤
* 今後は以下へ横展開可能
  * 予約管理
  * 進捗管理
  * 申し込みステータス管理
  * 在庫ログ管理
* 「状態の変化を記録しAIで分析する」というパターンを全サービスで活用可能

**話すポイント**

* 「テンプレとして他プロジェクトが真似できる形」をつくるのが今回の目的。
* AI駆動開発の実践例として、短期間で機能的なプロトタイプを構築できた。
