# Auth Service 仕様書（最新）

最終更新: 2025-09-08

この文書は Auth サービスの実装仕様の単一の信頼できる情報源（SSOT）です。別セッションのAI/開発者が拡張・改修する際に必要な情報を厳密かつ簡潔に記載します。

## 1. 概要

**責務:**
- ログイン/リフレッシュ/ログアウト/自身の取得（/auth/*）
- セッション作成・更新・失効、アクティブ上限管理（=5）
- デバイス登録・信頼度管理（auth_user_devices）
- 監査ログ（auth_session_audit_logs）
- 異常検知・地理解析・リアルタイム活動記録

**設計原則:**
- JWT(HS256) + Refresh(ハッシュ保存) の二段構成
- ステートレスAPI＋セッションはDBで追跡（revoked_at で論理失効）
- 外部依存はEncore標準＋Node標準のみ（最小依存）
- 内部APIは dev_tools/users から利用することを前提に安定インターフェース提供

**構成位置:** Frontend(SvelteKit) → Generated SDK → Auth(Encore) → 他サービス(Users/DevTools)

## 2. 配置と主要ファイル

```
backend/services/auth/
├── auth.ts                 # 中核API: login/refresh/logout/me + 内部補助
├── session_management.ts   # セッション/デバイス/統計/一括操作(API)
├── trust_scoring.ts        # 信頼度・管理者trust設定API
├── anomaly_detection.ts    # 異常検知（login/refresh で実行）
├── geo_location.ts         # IP→地理/リスク, リクエスト抽出
├── realtime_monitoring.ts  # 活動記録・SSE連携
├── alert_system.ts         # 異常アラート
├── session_cleanup.ts      # クリーンアップCron
├── database.ts, encore.service.ts
└── migrations/
    └── 0001_create_auth_tables.up.sql  # 統合スキーマ（ユーザー/セッション/デバイス/監査等）
```

## 3. データモデル（抜粋）

本リポジトリでは 0001 の単一マイグレーションに統合済みです（拡張テーブル含む）。主要テーブルのみ要点を列挙します。完全定義は migrations/0001_create_auth_tables.up.sql を参照してください。

- `auth_users`(id, email, password_hash, email_verified, is_active, created_at, updated_at)
- `auth_sessions`(id, user_id, refresh_token_hash UNIQUE, refresh_token_family, user_agent, ip_address, expires_at, revoked_at, created_at, device_id, device_name, last_activity_at, session_type, is_suspicious, geo_country, geo_city, geo_region, geo_latitude, geo_longitude, geo_timezone, risk_score, risk_factors)
- `auth_user_devices`(id, user_id, device_id UNIQUE, device_name, device_fingerprint, trusted, trust_score, last_seen_at, created_at, successful_logins, failed_attempts, risk_events, geo_locations, usual_time_pattern)
- `auth_session_audit_logs`(id, session_id, user_id, action, ip_address, user_agent, device_id, device_name, metadata, created_at)
- `auth_anomaly_logs`(...), `auth_realtime_activities`(...), `auth_ip_reputation`(...), `auth_alert_settings`(...), `auth_alert_notifications`(...), `auth_cleanup_stats`(...)

設計上の要点:
- セッションの失効は revoked_at に時刻を打つ論理削除。Cronで後日物理削除。
- デバイスは device_id(UUID) を主キーとしてセッションと疎結合。device_fingerprint は同一端末再識別の参考キー。
- 地理/リスク/パターン情報は軽量JSONB列に累積。

## 4. 公開API

型は実装(auth.ts)の定義と一致させています。全APIは TypeScript SDK から呼び出されます。

### POST /auth/login

```ts
interface LoginParams {
  email: string;
  password: string;
  device_name?: string;              // 任意（UI表示用）
  device_fingerprint?: string;       // 任意（同一端末再識別）
  remember_device?: boolean;         // true でデバイス登録/更新
  // 開発/デバッグ用（指定あれば優先、なければRawRequestから抽出）
  client_ip?: string;
  client_user_agent?: string;
  client_ua_brands?: Array<{ brand: string; version?: string }>; // UA-CH
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  token_type: 'Bearer';
}
```

動作要点:
- 認証成功後、アクティブセッション上限=5を維持（超過分は最古から自動 revoke）。
- `device_fingerprint` + `remember_device=true` の場合、`auth_user_devices` を登録/更新。
- 既存デバイスのアクティブセッションがある場合は「行再利用（UPDATE）」で同一セッションを更新。
- IP/UA は RawRequest から抽出（`extractRequestInfo`）。UA-CH からブラウザ名を優先抽出し `device_name` を「OS / Brand Major」に整形。
- 地理情報を解決してセッションに保存。異常検知 `detectAnomalies` を実行し、critical は即時ブロック（セッション revoke + 403）。
- 監査ログ(`auth_session_audit_logs`)とリアルタイム活動ログ(realtime)を記録。

### POST /auth/refresh

```ts
interface RefreshParams { refresh_token: string }
// returns TokenResponse
```

動作要点:
- `refresh_token` を照合し、同一セッション行を UPDATE してローテーション（新hash, expires 延長, last_activity_at 更新）。
- 新規行を追加しない（in-place rotation）。
- 監査ログ action='refreshed_inplace' を記録、realtime に publish。

### POST /auth/logout

```ts
interface LogoutParams { refresh_token: string }
```

動作要点:
- 対象セッションを `revoked_at=NOW()` で論理失効。
- realtime に logout 活動を記録。

### GET /auth/me

```ts
interface MeResponse { user: { id: string; email: string } }
```

備考: プロファイル/ロールは Users サービスで管理し、フロントは `auth.me` と `users.get_profile` を合成して表示します。

### 4.2 内部API（dev_tools/users から使用）

ユーザー管理系:
- POST /auth/internal/create-user-admin → create_auth_user
- POST /auth/internal/update-status → update_user_status
- POST /auth/internal/update-password → update_password
- GET  /auth/internal/user-by-email → get_user_by_email
- POST /auth/internal/users-batch → get_users_batch

セッション/デバイス系:
- GET    /auth/sessions                           → get_sessions（自分のアクティブ一覧, expose:true, auth:true）
- GET    /auth/sessions/stats                     → get_session_stats（内部, expose:false, auth:true）
- DELETE /auth/sessions/:sessionId                → revoke_session（本人のみ）
- POST   /auth/sessions/revoke-all                → revoke_all_sessions（本人のみ）
- POST   /auth/sessions/expire_all_except         → expire_all_sessions_except（内部, except_user_id 指定）
- GET    /auth/internal/admin/user/:userId/devices → admin_get_user_devices（管理者）
- POST   /auth/internal/admin/device/:device_id/revoke-sessions → admin_revoke_device_sessions
- DELETE /auth/internal/admin/device/:device_id    → admin_remove_device
- POST   /auth/internal/admin/device-trust         → admin_set_device_trust

返却の共通事項:
- セッションは `is_active = (revoked_at IS NULL AND expires_at > NOW())` を意味します。
- `admin_get_user_devices` は各デバイスの `active_sessions` を is_active のみで集計します。

## 5. セキュリティ実装（実装準拠）

異常検知(`anomaly_detection.ts`):
- 種別: `impossible_travel` / `new_location` / `suspicious_time` / `brute_force` / `concurrent_sessions` / `device_anomaly`
- 検知時は `auth_anomaly_logs` に保存し、`alert_system` と `realtime` に連携。
- `critical` は login 内で即座に revoke + APIError.permissionDenied。

地理解析(`geo_location.ts`):
- `extractRequestInfo(req)` で X-Forwarded-For, x-real-ip 等から IP を抽出。UA も取得。
- `getGeoLocationFromIP` は開発用モックを内蔵。IPレピュテーション(`auth_ip_reputation`)と連携しリスク加点。
- `isPossibleTravel(distanceKm, minutes)` で移動妥当性を判定（~1000km/h 上限モデル）。

信頼度(`trust_scoring.ts`):
- `admin_set_device_trust` により trusted, trust_score を直接更新可能（dev_tools用）。
- login/`learnUserPattern` で `usual_time_pattern` / `geo_locations` を更新。

リアルタイム(`realtime_monitoring.ts`):
- `recordActivity` で LOGIN/REFRESH/LOGOUT/FAILED_ATTEMPT を記録。dev_tools 側SSEで可視化可能。

## 6. 連携・フロントエンド前提

- Users サービス: dev_tools/管理UIは `users.list_users`, `users.get_user_profile` を用いてロール確認し、auth の内部APIを呼びます。
- フロントSSRガード: `users.get_user_sessions` の結果で `is_active=0`（=全セッション失効）なら即 `/login` へリダイレクトする前提。auth 側の is_active 判定は「`revoked_at IS NULL AND expires_at > NOW()`」。
- ログインフォームは `device_fingerprint` と UA-CH(brands) を hidden 送信する実装（既存UI準拠）。

## 7. 設定（Secrets）と定数

Secrets（encore.dev/config → `secret`）:
- `JWT_SECRET`: HS256 署名鍵（必須）
- `AUTH_ACCESS_TTL_MINUTES`: アクセストークン有効期間（分, 既定=15）
- `AUTH_REFRESH_TTL_DAYS`: リフレッシュ有効期間（日, 既定=30）

コード定数（auth.ts ほか）:
- `MAX_SESSIONS_PER_USER = 5`（ログイン時の自動revokeで維持）

運用ベストプラクティス:
- 本番では `ENABLE_SIGNUP=false`（管理作成）
- 逆プロキシ越しの IP 抽出時は X-Forwarded-For を信頼できる経路で供給
- ログレベルは INFO 本番、DEBUG は開発のみ

## 8. トラブルシューティング

よくある事象:
- `JWT_SECRET` 未設定 → secret を設定（.secrets.local.cue / Encore管理）
- refresh で 401 → セッション失効/期限切れ。revoke/all で整合を取り直す。
- IP/UA が null → 逆プロキシ経路のヘッダー設定を確認（X-Forwarded-For / User-Agent）。

運用コマンド（例）:
```bash
encore logs --env=local
encore db shell auth
```

## 9. カスタマイズ・拡張の要点

感度/しきい値:
- `anomaly_detection.ts` の各種しきい値（例: ブルートフォース回数）を適宜調整。
- `trust_scoring.ts` の基準/減衰/加点ロジックはビジネス要件に合わせ変更可能。

セッション設定:
- 期間は Secrets(`AUTH_ACCESS_TTL_MINUTES`/`AUTH_REFRESH_TTL_DAYS`) で外出し。`MAX_SESSIONS_PER_USER` は定数。

dev_tools 連携:
- デバイス一覧は `admin_get_user_devices` + `get_user_sessions` を組み合わせ、表示用に `active_sessions` を is_active 判定のみで集計。
- 一括操作は `admin_*` 系 API を利用（所有者チェックを回避しつつ監査ログで追跡）。

備考:
- 0001 マイグレーションに全テーブルを統合済み。旧版の 0002/0003 は存在しません。

