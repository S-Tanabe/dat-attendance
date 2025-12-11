# Template Feature Index（機能一覧表）

dashboard-acceleratorテンプレートが提供する全機能の詳細一覧。

---

## 🔐 認証・認可システム

| 機能 | 実装パス | 詳細スキル | 概要 |
|------|---------|-----------|------|
| **JWT認証** | `backend/services/auth/auth.ts` | foundation-auth | Access Token (15分) + Refresh Token (30日)、HS256アルゴリズム |
| **パスワードハッシュ** | 同上 | foundation-auth | scrypt (N=16384) による安全なハッシュ化 |
| **セッション管理** | `backend/services/auth/session_management.ts` | foundation-auth | 同時5セッション上限、セッションファミリー管理 |
| **リフレッシュトークンローテーション** | 同上 | foundation-auth | セキュアなトークン更新フロー |
| **IP Trust評価** | `backend/services/auth/iptrust/` | foundation-auth | IP信頼度評価・学習システム |
| **Trust Scoring** | `backend/services/auth/trust_scoring.ts` | foundation-auth | ユーザー行動パターン学習 |
| **異常検知** | `backend/services/auth/anomaly_detection.ts` | foundation-auth | ログイン異常検知（実装中） |
| **地理情報取得** | `backend/services/auth/geo_location.ts` | foundation-auth | IPアドレスからの地理情報取得 |
| **リアルタイム監視** | `backend/services/auth/realtime_monitoring.ts` | foundation-auth | セッション活動記録・通知 |
| **権限管理（RBAC）** | `backend/services/app/modules/users/permissions.ts` | foundation-auth | Role-Based Access Control |

---

## 👥 ユーザー管理

| 機能 | 実装パス | 詳細スキル | 概要 |
|------|---------|-----------|------|
| **app-user設定** | `backend/services/app/modules/users/user_settings.ts` | foundation-auth | ログインユーザー自身の情報編集 |
| **users管理** | `backend/services/app/modules/users/user_management.ts` | foundation-auth | システムユーザーの追加・管理 |
| **ストレージ管理** | `backend/services/app/modules/users/storage.ts` | foundation-auth | ユーザーファイル管理（将来） |

---

## 🌐 API通信システム

| 機能 | 実装パス | 詳細スキル | 概要 |
|------|---------|-----------|------|
| **serverClient()** | `frontend/src/lib/api/client.ts` | foundation-api | SSR用APIクライアント（Cookie自動付与） |
| **browserClient()** | 同上 | foundation-api | ブラウザ用APIクライアント |
| **serverClientWithForwardedHeaders()** | 同上 | foundation-api | IP/UAヘッダー転送クライアント |
| **withAutoRefresh()** | 同上 | foundation-api | 401エラー時の自動トークンリフレッシュ |
| **withErrorHandling()** | 同上 | foundation-api | 統一エラーハンドリング |
| **HttpOnly Cookie管理** | 同上 | foundation-api | ACCESS_COOKIE / REFRESH_COOKIE 管理 |
| **setTokensToCookies()** | 同上 | foundation-api | トークンをCookieに設定 |
| **clearTokens()** | 同上 | foundation-api | トークンをCookieからクリア |

---

## 🔔 通知システム

| 機能 | 実装パス | 詳細スキル | 概要 |
|------|---------|-----------|------|
| **通知生成API** | `backend/services/notification/notification.ts` | foundation-notification | POST /notifications で通知生成 |
| **SSEストリーム** | `backend/services/notification/web_delivery.ts` | foundation-notification | リアルタイム通知配信（SSE） |
| **Pub/Sub統合** | 同上 | foundation-notification | Encoreイベントシステム統合 |
| **通知プロセッサ** | `backend/services/notification/processor.ts` | foundation-notification | 通知処理・配信ロジック |
| **テンプレート管理** | `backend/services/notification/templates/` | foundation-notification | 通知メッセージテンプレート |
| **ユーザー通知設定** | `backend/services/notification/preferences.ts` | foundation-notification | 通知受信設定 |
| **管理者設定** | `backend/services/notification/admin_preferences.ts` | foundation-notification | 管理者通知プロファイル |
| **NotificationStream（FE）** | `frontend/src/lib/notifications/client.ts` | foundation-notification | SSE接続管理 |
| **notificationCenter（FE）** | `frontend/src/lib/notifications/store.ts` | foundation-notification | 通知状態管理（Svelte store） |
| **SSEプロキシ（FE）** | `frontend/src/lib/notifications/proxy.ts` | foundation-notification | SSEプロキシサーバー |

---

## ⚠️ エラーハンドリングシステム

### Backend（独自エラー）

| 機能 | 実装パス | 詳細スキル | 概要 |
|------|---------|-----------|------|
| **エラーコード定義** | `backend/shared/errors/error-codes.ts` | foundation-error-handling | ビジネス固有エラーコード |
| **エラー型定義** | `backend/shared/errors/types.ts` | foundation-error-handling | TypeScript型定義 |
| **createValidationError()** | `backend/shared/errors/helpers.ts` | foundation-error-handling | バリデーションエラー生成 |
| **createBusinessError()** | 同上 | foundation-error-handling | ビジネスエラー生成 |
| **createNotFoundError()** | 同上 | foundation-error-handling | NotFoundエラー生成 |
| **createPermissionError()** | 同上 | foundation-error-handling | 権限エラー生成 |

### Frontend（統一エラーハンドリング）

| 機能 | 実装パス | 詳細スキル | 概要 |
|------|---------|-----------|------|
| **UIError型** | `frontend/src/lib/errors/types.ts` | foundation-error-handling | UIエラー型定義 |
| **エラーメッセージマッピング** | `frontend/src/lib/errors/error-messages.ts` | foundation-error-handling | 日本語メッセージ変換 |
| **APIError→UIError変換** | `frontend/src/lib/errors/transformer.ts` | foundation-error-handling | エラー変換ロジック |
| **エラーコード定義（FE）** | `frontend/src/lib/errors/error-codes.ts` | foundation-error-handling | フロントエンド用コード |
| **グローバルエラー状態** | `frontend/src/lib/stores/error.ts` | foundation-error-handling | setError() / clearError() |
| **401自動リダイレクト** | `frontend/src/lib/api/client.ts` | foundation-error-handling | /login への自動遷移 |
| **Sentry自動レポート** | 同上 | foundation-error-handling | システムエラー自動送信 |

---

## 🗄️ データベース設計パターン

### スキーマ構造

| スキーマ | 用途 | 詳細スキル | 制約 |
|---------|------|-----------|------|
| **auth** | 認証関連 | foundation-database | 変更不可（テンプレート提供） |
| **dev_tools** | 開発ツール | foundation-database | 変更不可（テンプレート提供） |
| **notification** | 通知システム | foundation-database | 変更不可（テンプレート提供） |
| **app** | 業務ロジック統合 | foundation-database | **ここに schema.table 作成** |

### PostgreSQL拡張機能

| 拡張機能 | 用途 | 詳細スキル |
|---------|------|-----------|
| **pg_trgm** | トライグラム類似検索 | foundation-database |
| **fuzzystrmatch** | 編集距離・あいまい検索 | foundation-database |
| **tcn** | テーブル変更通知 | foundation-database |

### 高度検索パターン

| 機能 | 実装パス | 詳細スキル | 概要 |
|------|---------|-----------|------|
| **3段階検索** | Migration 0004 | foundation-database | 完全一致 → 全文検索 → 類似検索 |
| **search_vector** | 同上 | foundation-database | 全文検索用カラム（tsvector） |
| **search_text** | 同上 | foundation-database | 類似検索用カラム（text） |
| **GINインデックス** | 同上 | foundation-database | 全文検索用インデックス |
| **GiSTインデックス** | 同上 | foundation-database | 類似検索用インデックス |
| **update_search_fields()** | Migration 0005 | foundation-database | 検索フィールド自動更新トリガー |

---

## 📊 監視・ロギング

### Sentry統合（Backend）

| 機能 | 実装パス | 詳細スキル | 概要 |
|------|---------|-----------|------|
| **環境別サンプリング** | `backend/config/sentry.config.ts` | foundation-monitoring | local: 30%, prod: 20%, dev: 100%, ephemeral: 50% |
| **リリース自動取得** | 同上 | foundation-monitoring | Gitコミットハッシュベース |
| **機密情報マスキング** | 同上 | foundation-monitoring | パスワード等の自動マスキング |
| **サービスタグ** | 同上 | foundation-monitoring | サービス名の自動設定 |
| **ユーザーコンテキスト** | 同上 | foundation-monitoring | setSentryUser() / clearSentryUser() |

### Sentry統合（Frontend）

| 機能 | 実装パス | 詳細スキル | 概要 |
|------|---------|-----------|------|
| **Session Replay** | `frontend/src/lib/monitoring/sentry.ts` | foundation-monitoring | ユーザーセッション記録 |
| **Feedback Widget** | 同上 | foundation-monitoring | 日本語フィードバックウィジェット |
| **分散トレーシング** | 同上 | foundation-monitoring | Backend連携トレーシング |
| **エラーフィンガープリント** | 同上 | foundation-monitoring | エラーコードベースのグループ化 |
| **環境別サンプリング** | 同上 | foundation-monitoring | Session Replay サンプリング |

---

## ✅ 品質チェック機構

| 機能 | 実装パス | 詳細スキル | 概要 |
|------|---------|-----------|------|
| **ESLint設定** | `frontend/eslint.config.js` | foundation-testing | @antfu/eslint-config ベース |
| **TypeScript strict** | 同上 | foundation-testing | type-aware ルール |
| **Svelte 5対応** | 同上 | foundation-testing | Runes構文チェック |
| **any型禁止** | 同上 | foundation-testing | 型安全性強制 |
| **未使用変数エラー** | 同上 | foundation-testing | 未使用変数検出 |
| **SvelteCheck** | `package.json` | foundation-testing | 型チェック専任 |
| **Husky hooks** | `.lintstagedrc.json` | foundation-testing | pre-commit自動実行 |

---

## 🎨 UIコンポーネント

詳細は `component-index.md` 参照。

**基本レイアウト**:
- Header, Sidebar, SidebarItem, SidebarToggle

**通知・フィードバック**:
- ToastHost, ErrorToast, ErrorBoundary

**UI要素**:
- ThemeSelector, RoleSelect

---

## 使用方法

1. **実装開始前**: このインデックスで既存機能を確認
2. **詳細確認**: 該当する **foundation-*** スキルを参照
3. **実装**: テンプレート提供機能を最大限活用

---

## 関連ドキュメント

- **コンポーネント一覧**: `component-index.md`
- **foundation-catalog SKILL**: `../SKILL.md`
- **OpenSpec プロジェクトコンテキスト**: `../../../openspec/project.md`
