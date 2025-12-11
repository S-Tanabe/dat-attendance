# セッション管理パターン

## 実装場所

- `backend/services/auth/session_management.ts`
- `backend/services/auth/realtime_monitoring.ts`

---

## セッション構造

### セッションテーブル

```sql
-- auth物理データベース内のテーブル
CREATE TABLE auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  refresh_token_family UUID,  -- セッションファミリーID（ローテーション管理用）
  user_agent TEXT,
  ip_address TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  device_id UUID,
  device_name TEXT,
  last_activity_at TIMESTAMPTZ DEFAULT now(),
  session_type TEXT DEFAULT 'web',
  is_suspicious BOOLEAN DEFAULT false,
  geo_country TEXT,
  geo_city TEXT,
  geo_region TEXT,
  geo_latitude DOUBLE PRECISION,
  geo_longitude DOUBLE PRECISION,
  geo_timezone TEXT,
  risk_score INTEGER DEFAULT 0,
  risk_factors JSONB DEFAULT '{}'
);

-- セッション監査ログ
CREATE TABLE auth_session_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID,
  user_id UUID,
  action TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  device_id UUID,
  device_name TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ユーザーデバイス
CREATE TABLE auth_user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  device_id UUID NOT NULL UNIQUE,
  device_name TEXT NOT NULL,
  device_fingerprint TEXT,
  trusted BOOLEAN DEFAULT false,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trust_score INTEGER DEFAULT 50,
  successful_logins INTEGER DEFAULT 0,
  failed_attempts INTEGER DEFAULT 0,
  risk_events JSONB DEFAULT '[]',
  geo_locations JSONB DEFAULT '[]',
  usual_time_pattern JSONB DEFAULT '{}'
);
```

### 制約

- **同時アクティブセッション上限**: 5セッション（`auth.ts` の `MAX_SESSIONS_PER_USER` で定義）
  - 上限を超えると最も古いセッションから自動的に失効（`created_at ASC` でソート）
- **セッション有効期限**: Refresh Tokenの有効期限に依存
- **失効方式**: 論理削除（`revoked_at`）、物理削除はCronで実行

### 重要な実装詳細

**注意**: 実装では、リフレッシュトークンは別テーブルではなく`auth_sessions`テーブルに統合されています。
- `refresh_token_hash`: ハッシュ化されたトークン文字列
- `refresh_token_family`: ローテーション管理用のファミリーID
- `revoked_at`: 失効時刻（論理削除）

---

## セッションライフサイクル

### 1. セッション作成（ログイン時）

実装では、リフレッシュトークン情報も含めて`auth_sessions`に保存されます。

```typescript
// 実装例（簡略化）
async function createSession(
  userId: string,
  refreshTokenHash: string,
  familyId: UUID,
  ipAddress: string,
  userAgent: string,
  deviceId: UUID | null,
  deviceName: string | null
): Promise<Session> {
  const session = await db.query(`
    INSERT INTO auth_sessions (
      user_id,
      refresh_token_hash,
      refresh_token_family,
      ip_address,
      user_agent,
      device_id,
      device_name,
      expires_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '30 days')
    RETURNING *
  `, [userId, refreshTokenHash, familyId, ipAddress, userAgent, deviceId, deviceName]);

  return session;
}
```

### 2. セッションリフレッシュ

実装では、リフレッシュトークンの「インプレースローテーション」を採用しています。
同一セッション行を保持しつつ、トークンハッシュと有効期限のみを更新します。

```typescript
// 実装例（backend/services/auth/auth.ts より簡略化）
async function refreshSession(refreshToken: string, req: Request): Promise<TokenResponse> {
  // 1. トークンハッシュを計算
  const hash = createHash('sha256').update(refreshToken).digest('hex');

  // 2. auth_sessions からトークンを検索
  const session = await db.queryRow(`
    SELECT s.id, s.user_id, u.email, s.expires_at, s.refresh_token_family, s.device_id
    FROM auth_sessions s
    JOIN auth_users u ON u.id = s.user_id
    WHERE s.refresh_token_hash = $1 AND s.revoked_at IS NULL
  `, [hash]);

  if (!session) {
    // トークンが見つからない場合、同一ファミリーを全て無効化（盗用対策）
    const familyCheck = await db.queryRow(`
      SELECT refresh_token_family FROM auth_sessions
      WHERE refresh_token_hash = $1 AND refresh_token_family IS NOT NULL
    `, [hash]);

    if (familyCheck?.refresh_token_family) {
      await db.execute(`
        UPDATE auth_sessions
        SET revoked_at = NOW(), is_suspicious = true
        WHERE refresh_token_family = $1
      `, [familyCheck.refresh_token_family]);
    }

    throw new Error('Invalid refresh token');
  }

  // 3. 有効期限チェック
  if (session.expires_at < new Date()) {
    throw new Error('Session expired');
  }

  // 4. 新しいトークン生成
  const newAccessToken = await createAccessToken(session.user_id, session.email);
  const { raw: newRefreshToken, hash: newHash } = generateRefreshToken();
  const newExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30日

  // 5. 同一セッション行を更新（インプレースローテーション）
  await db.execute(`
    UPDATE auth_sessions
    SET refresh_token_hash = $1,
        expires_at = $2,
        last_activity_at = NOW()
    WHERE id = $3
  `, [newHash, newExpires, session.id]);

  return {
    access_token: newAccessToken.token,
    refresh_token: newRefreshToken,
    expires_in: newAccessToken.exp - Math.floor(Date.now() / 1000),
    token_type: 'Bearer',
  };
}
```

### 3. セッション削除（ログアウト時）

実装では、物理削除ではなく論理削除（`revoked_at`フィールドを更新）を使用します。

```typescript
// backend/services/auth/auth.ts より簡略化
async function logout(refreshToken: string): Promise<{ ok: boolean }> {
  // 1. トークンハッシュを計算
  const hash = createHash('sha256').update(refreshToken).digest('hex');

  // 2. 該当セッションを論理削除
  await db.execute(`
    UPDATE auth_sessions
    SET revoked_at = NOW()
    WHERE refresh_token_hash = $1 AND revoked_at IS NULL
  `, [hash]);

  return { ok: true };
}

// 特定セッションIDでの無効化（session_management.ts）
async function revokeSession(sessionId: string, userId: string): Promise<void> {
  // セッションが現在のユーザーのものか確認
  const session = await db.queryRow(`
    SELECT user_id FROM auth_sessions
    WHERE id = $1 AND revoked_at IS NULL
  `, [sessionId]);

  if (!session || session.user_id !== userId) {
    throw new Error('Session not found or access denied');
  }

  // セッションを論理削除
  await db.execute(`
    UPDATE auth_sessions
    SET revoked_at = NOW()
    WHERE id = $1
  `, [sessionId]);
}
```

### 4. セッション一覧取得

```typescript
// backend/services/auth/session_management.ts より簡略化
async function getUserSessions(userId: string): Promise<SessionInfo[]> {
  const sessions = await db.query(`
    SELECT
      id,
      user_agent,
      ip_address,
      device_id,
      device_name,
      session_type,
      last_activity_at,
      created_at,
      expires_at,
      revoked_at,
      geo_country,
      geo_city,
      is_suspicious,
      risk_score
    FROM auth_sessions
    WHERE user_id = $1
      AND revoked_at IS NULL
      AND expires_at > NOW()
    ORDER BY COALESCE(last_activity_at, created_at) DESC
  `, [userId]);

  return sessions.map(session => ({
    ...session,
    is_active: !session.revoked_at && session.expires_at > new Date(),
    location: session.geo_city && session.geo_country
      ? `${session.geo_city}, ${session.geo_country}`
      : session.geo_country,
    is_suspicious: session.is_suspicious || false,
    risk_score: session.risk_score || 0,
  }));
}
```

---

## セッションファミリー管理

### 概念

**セッションファミリー（Session Family）**:
- リフレッシュトークンローテーション時の盗用検知に使用
- ファミリーIDは`auth_sessions.refresh_token_family`カラムに保存
- **重要**: ファミリーIDは変更されません（インプレースローテーション）
- 盗用検知時に同一ファミリーの全セッションを無効化

### インプレースローテーションフロー

実装では、新しいファミリーIDを作成せず、同一セッション行でトークンハッシュのみを更新します:

```
初回ログイン
↓
Session 123, Family A 作成, Refresh Token Hash AAA
↓
リフレッシュ1回目
↓
Session 123 (同じID), Family A (変更なし), Refresh Token Hash BBB に更新
↓
リフレッシュ2回目
↓
Session 123 (同じID), Family A (変更なし), Refresh Token Hash CCC に更新
```

### リプレイ攻撃防止

**シナリオ**: 攻撃者が古い Refresh Token を取得

```
正規ユーザー: Token AAA でリフレッシュ → Hash BBB に更新
攻撃者: Token AAA を使用 → ハッシュ不一致、Family A の全セッションを無効化
```

実装コード（auth.ts より）:
```typescript
// トークンが見つからない場合、ファミリー全体を無効化
const familyCheck = await db.queryRow(`
  SELECT refresh_token_family FROM auth_sessions
  WHERE refresh_token_hash = $1 AND refresh_token_family IS NOT NULL
`, [hash]);

if (familyCheck?.refresh_token_family) {
  await db.execute(`
    UPDATE auth_sessions
    SET revoked_at = NOW(), is_suspicious = true
    WHERE refresh_token_family = $1
  `, [familyCheck.refresh_token_family]);
}
```

---

## セッションクリーンアップ

### 自動クリーンアップ（Cron）

実装では、期限切れおよび7日以上前に無効化されたセッションを物理削除します。

```typescript
// backend/services/auth/session_cleanup.ts

import { CronJob } from "encore.dev/cron";
import { db } from "./database";

// 毎日深夜2時に実行
export const cleanupExpiredSessions = new CronJob("cleanup-expired-sessions", {
  title: "期限切れセッションクリーンアップ",
  schedule: "0 2 * * *",
  endpoint: cleanupSessions,
});

async function cleanupSessions(): Promise<void> {
  // 1. 期限切れセッション（未無効化）を削除
  const expiredResult = await db.execute(`
    DELETE FROM auth_sessions
    WHERE expires_at < NOW()
      AND revoked_at IS NULL
  `);

  // 2. 無効化済みで7日以上経過したセッションを削除
  const revokedResult = await db.execute(`
    DELETE FROM auth_sessions
    WHERE revoked_at IS NOT NULL
      AND revoked_at < NOW() - INTERVAL '7 days'
  `);

  console.log('セッションクリーンアップ完了', {
    expired: expiredResult.rowCount || 0,
    revoked: revokedResult.rowCount || 0,
  });
}
```

### 手動クリーンアップ（管理者用）

```typescript
// backend/services/auth/session_management.ts

// 統計情報を取得し、クリーンアップ推奨件数を返す
export const get_session_stats = api(
  { method: "GET", path: "/auth/sessions/stats", expose: false, auth: true },
  async () => {
    const stats = await db.queryRow(`
      SELECT
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN revoked_at IS NULL AND expires_at > NOW() THEN 1 END) as active_sessions,
        COUNT(CASE WHEN expires_at < NOW() AND revoked_at IS NULL THEN 1 END) as expired_sessions,
        COUNT(CASE WHEN revoked_at IS NOT NULL THEN 1 END) as revoked_sessions
      FROM auth_sessions
    `);

    const oldRevokedCount = await db.queryRow(`
      SELECT COUNT(*) as count
      FROM auth_sessions
      WHERE revoked_at IS NOT NULL
        AND revoked_at < NOW() - INTERVAL '7 days'
    `);

    return {
      summary: stats,
      cleanup_recommendation: {
        expired_to_clean: stats.expired_sessions,
        revoked_to_clean: oldRevokedCount.count,
      },
    };
  }
);
```

---

## リアルタイム監視

### セッションアクティビティ記録

実装では、リアルタイム活動記録と監査ログの両方を記録します。

```typescript
// backend/services/auth/realtime_monitoring.ts より簡略化

async function recordActivity(
  userId: string,
  sessionId: string | null,
  deviceId: string | null,
  action: string,
  metadata?: {
    endpoint?: string;
    ip_address?: string | null;
    user_agent?: string | null;
    response_time_ms?: number;
    additional_data?: any;
  }
): Promise<void> {
  // 1. リアルタイム活動ログ記録
  await db.execute(`
    INSERT INTO auth_realtime_activity_logs (
      user_id, session_id, device_id, action, endpoint,
      ip_address, user_agent, response_time_ms, additional_data
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `, [
    userId, sessionId, deviceId, action,
    metadata?.endpoint, metadata?.ip_address, metadata?.user_agent,
    metadata?.response_time_ms, JSON.stringify(metadata?.additional_data || {})
  ]);

  // 2. セッションの最終活動時刻を更新
  if (sessionId) {
    await db.execute(`
      UPDATE auth_sessions
      SET last_activity_at = NOW()
      WHERE id = $1
    `, [sessionId]);
  }
}
```

### 異常検知

実装では、デバイス信頼スコアとリスクスコアを使用して異常を検知します。

```typescript
// backend/services/auth/realtime_monitoring.ts より簡略化

async function detectAnomalies(userId: string): Promise<{
  is_anomalous: boolean;
  risk_factors: string[];
  risk_score: number;
}> {
  const riskFactors: string[] = [];
  let riskScore = 0;

  // 1. 短時間に複数IPからアクセス
  const recentIPs = await db.query(`
    SELECT COUNT(DISTINCT ip_address) as ip_count
    FROM auth_sessions
    WHERE user_id = $1
      AND last_activity_at > NOW() - INTERVAL '1 hour'
      AND revoked_at IS NULL
  `, [userId]);

  if (recentIPs.ip_count > 3) {
    riskFactors.push('multiple_ips_short_time');
    riskScore += 30;
  }

  // 2. 疑わしいセッションの存在
  const suspiciousSessions = await db.query(`
    SELECT COUNT(*) as count
    FROM auth_sessions
    WHERE user_id = $1
      AND is_suspicious = true
      AND revoked_at IS NULL
  `, [userId]);

  if (suspiciousSessions.count > 0) {
    riskFactors.push('suspicious_sessions_detected');
    riskScore += 50;
  }

  // 3. 低信頼デバイスからのアクセス
  const untrustedDevices = await db.query(`
    SELECT COUNT(*) as count
    FROM auth_user_devices
    WHERE user_id = $1
      AND trusted = false
      AND trust_score < 30
  `, [userId]);

  if (untrustedDevices.count > 0) {
    riskFactors.push('untrusted_devices');
    riskScore += 20;
  }

  return {
    is_anomalous: riskScore >= 50,
    risk_factors: riskFactors,
    risk_score: riskScore,
  };
}
```

---

## Frontend統合

### セッション一覧表示

実際の実装例は `frontend/src/routes/(app)/dev_tools/sessions/+page.svelte` を参照してください。

```svelte
<!-- routes/(app)/dev_tools/sessions/+page.svelte （実装済み） -->
<script lang="ts">
  import { browserClient } from '$lib/api/client';

  let sessions = $state<Session[]>([]);

  async function loadSessions() {
    const client = browserClient();
    sessions = await client.auth.listSessions();
  }

  async function revokeSession(sessionId: string) {
    const client = browserClient();
    await client.auth.revokeSession({ sessionId });
    await loadSessions();
  }

  $effect(() => {
    loadSessions();
  });
</script>

<h1>アクティブなセッション</h1>

<ul>
  {#each sessions as session}
    <li>
      <div>
        <strong>{session.user_agent}</strong>
        <span>{session.ip_address}</span>
        <time>{new Date(session.last_activity).toLocaleString()}</time>
      </div>
      <button onclick={() => revokeSession(session.id)}>
        ログアウト
      </button>
    </li>
  {/each}
</ul>
```

---

## Troubleshooting

### 問題1: セッションが勝手に切れる

**原因1**: セッションが無効化または期限切れ

**確認方法**:
```sql
SELECT
  id, user_id, expires_at, revoked_at, is_suspicious, risk_score
FROM auth_sessions
WHERE user_id = 'xxx'
ORDER BY created_at DESC;
```

**対処**:
1. `revoked_at IS NOT NULL` の場合 → 無効化された理由を確認（`auth_session_audit_logs` を参照）
2. `expires_at < NOW()` の場合 → 期限切れ、再ログインが必要
3. `is_suspicious = true` の場合 → セキュリティ上の理由で無効化、ファミリー全体が無効化されている可能性

**原因2**: トークン盗用検知によるファミリー全体の無効化

**確認方法**:
```sql
-- 同一ファミリーの全セッションを確認
SELECT
  id, refresh_token_family, revoked_at, is_suspicious
FROM auth_sessions
WHERE refresh_token_family = (
  SELECT refresh_token_family
  FROM auth_sessions
  WHERE id = 'xxx'
);
```

**対処**:
1. ファミリー全体が無効化されている場合、セキュリティ上の理由のため再ログイン必須
2. `auth_session_audit_logs` で無効化イベントを確認

### 問題2: リフレッシュが失敗する

**原因**: トークンハッシュが一致しない、または既に無効化されている

**確認方法**:
```sql
-- トークンハッシュで検索（実際のハッシュ値を計算して使用）
SELECT
  id, user_id, expires_at, revoked_at, refresh_token_family
FROM auth_sessions
WHERE refresh_token_hash = 'sha256_hash_value';
```

**対処**:
1. `revoked_at IS NOT NULL` → セッションが無効化済み、再ログイン必要
2. 該当なし → トークンが既にローテーション済み、または不正なトークン
3. `expires_at < NOW()` → セッション期限切れ、再ログイン必要

---

## Related Patterns

- **jwt-pattern.md**: JWT発行・検証
- **permission-pattern.md**: 権限チェック
- **foundation-monitoring sentry-backend.md**: セッションイベント監視
