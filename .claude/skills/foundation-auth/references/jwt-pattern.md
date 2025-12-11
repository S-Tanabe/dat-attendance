# JWT認証パターン

## 実装場所

- **Backend**: `backend/services/auth/auth.ts`
- **Frontend**: `frontend/src/lib/api/client.ts`

---

## アーキテクチャ

### Token構造

**Access Token**:
- **有効期限**: 15分
- **アルゴリズム**: HS256
- **ペイロード**:
  ```json
  {
    "userID": "uuid",
    "email": "user@example.com",
    "role": "admin"
  }
  ```
- **保存場所**: HttpOnly Cookie (`ACCESS_COOKIE`)

**Refresh Token**:
- **有効期限**: 30日
- **ハッシュ化**: SHA-256
- **DB保存**: `auth_sessions.refresh_token_hash` カラム
- **保存場所**: HttpOnly Cookie (`REFRESH_COOKIE`)
- **セッションファミリー**: `auth_sessions.refresh_token_family` カラムで管理、インプレースローテーション

### 認証フロー

```
1. ログイン
   ↓ POST /auth/login { email, password }
   ↓
2. Backend: パスワード検証
   ↓ scrypt(N=16384) でハッシュ比較
   ↓
3. Token発行
   ↓ Access Token (15分) + Refresh Token (30日)
   ↓
4. HttpOnly Cookie に保存
   ↓ setTokensToCookies()
   ↓
5. API呼び出し
   ↓ Cookie自動送信
   ↓
6. Access Token 期限切れ → 401エラー
   ↓
7. Frontend が Refresh Token で自動更新
   ↓ POST /auth/refresh
   ↓
8. 新 Access Token 取得 → リトライ
   ↓ withAutoRefresh()
```

---

## 実装パターン

### Backend: 認証必須APIの作成

```typescript
import { api, APIError } from "encore.dev/api";

export const getProfile = api(
  {
    auth: true,        // 認証必須
    expose: true,      // 外部公開
    method: "GET",
    path: "/profile"
  },
  async (): Promise<UserProfile> => {
    const userId = authData()?.userID;
    if (!userId) {
      throw APIError.unauthenticated("Not authenticated");
    }

    // ユーザー情報取得
    const user = await getUser(userId);
    return user;
  }
);
```

### Backend: パスワードハッシュ化

```typescript
import { scrypt } from 'crypto';

// ハッシュ化パラメータ
const SCRYPT_N = 16384;
const SCRYPT_KEYLEN = 32;

async function hashPassword(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      SCRYPT_KEYLEN,
      { N: SCRYPT_N },
      (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      }
    );
  });
}

// ユーザー登録時
const salt = randomBytes(16);
const passwordHash = await hashPassword(password, salt);

// ログイン時
const isValid = await verifyPassword(inputPassword, storedHash, storedSalt);
```

### Backend: JWT発行

```typescript
import { SignJWT } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

async function generateAccessToken(userId: string, email: string, role: string): Promise<string> {
  return new SignJWT({
    userID: userId,
    email: email,
    role: role
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('15m')
    .sign(secret);
}

function generateRefreshToken(): { raw: string; hash: string } {
  // ランダムトークン生成（64文字のhex = 32バイト）
  const raw = randomBytes(32).toString('hex');

  // SHA-256でハッシュ化
  const hash = createHash('sha256').update(raw).digest('hex');

  return { raw, hash };
}

// ログイン時にセッション作成と同時に保存
async function createSessionWithRefreshToken(userId: string, familyId: string): Promise<string> {
  const { raw, hash } = generateRefreshToken();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30日

  // auth_sessions テーブルに保存
  await db.execute(`
    INSERT INTO auth_sessions (
      user_id, refresh_token_hash, refresh_token_family, expires_at
    )
    VALUES ($1, $2, $3, $4)
  `, [userId, hash, familyId, expires]);

  return raw; // 平文トークンをクライアントに返す（HttpOnly Cookieに保存）
}
```

### Frontend: 自動リフレッシュ統合

```typescript
// frontend/src/lib/api/client.ts

import { browserClient as encoreClient } from 'generated/client';

export function browserClient() {
  let client = encoreClient();

  // 401エラー時の自動リフレッシュ
  client = withAutoRefresh(client);

  // 統一エラーハンドリング
  client = withErrorHandling(client);

  return client;
}

function withAutoRefresh(client: any) {
  const originalFetch = client.fetch;

  client.fetch = async (url: string, options: RequestInit) => {
    try {
      return await originalFetch(url, options);
    } catch (error) {
      if (error.code === 'unauthenticated') {
        // Refresh Token で更新試行
        try {
          await refreshAccessToken();
          // リトライ
          return await originalFetch(url, options);
        } catch (refreshError) {
          // Refresh失敗 → ログインページへ
          goto('/login');
          throw error;
        }
      }
      throw error;
    }
  };

  return client;
}

async function refreshAccessToken() {
  const response = await fetch('/auth/refresh', {
    method: 'POST',
    credentials: 'include' // Cookie送信
  });

  if (!response.ok) {
    throw new Error('Refresh failed');
  }

  // 新しいトークンが HttpOnly Cookie に自動設定される
}
```

### Frontend: ログイン処理

```svelte
<!-- routes/login/+page.svelte -->
<script lang="ts">
  import { goto } from '$app/navigation';
  import { browserClient } from '$lib/api/client';

  let email = $state('');
  let password = $state('');
  let error = $state('');

  async function handleLogin() {
    try {
      const client = browserClient();
      const response = await client.auth.login({ email, password });

      // ログイン成功 → トークンが HttpOnly Cookie に自動設定
      goto('/dashboard');
    } catch (err) {
      error = 'ログインに失敗しました';
    }
  }
</script>

<form onsubmit={handleLogin}>
  <input bind:value={email} type="email" placeholder="メールアドレス" />
  <input bind:value={password} type="password" placeholder="パスワード" />
  <button type="submit">ログイン</button>
  {#if error}
    <p class="error">{error}</p>
  {/if}
</form>
```

---

## 制約

### セキュリティ制約

- ❌ **Access Token を localStorage に保存禁止**
  - XSS攻撃のリスク
  - ✅ HttpOnly Cookie のみ使用

- ❌ **Refresh Token をフロントエンドに露出禁止**
  - ✅ Backend でのみ管理
  - ✅ SHA-256 でハッシュ化してDB保存

- ❌ **JWT Secret をハードコード禁止**
  - ✅ 環境変数（`JWT_SECRET`）から取得

### Token管理制約

- ✅ Access Token有効期限: **15分固定**
  - 短い有効期限でセキュリティ向上

- ✅ Refresh Token有効期限: **30日固定**
  - 長期間のログイン維持

- ✅ Refresh Token ローテーション
  - リフレッシュ時に同一セッション行で新トークンハッシュに更新（インプレースローテーション）
  - ファミリーIDは変更されず、トークンハッシュのみローテーション
  - 不正なトークン使用時に同一ファミリーの全セッションを無効化（リプレイ攻撃防止）

---

## Troubleshooting

### 問題1: 401エラーが連続発生

**原因**: Refresh Token も期限切れまたは無効化されている

**確認方法**:
```sql
SELECT
  id, user_id, expires_at, revoked_at, is_suspicious
FROM auth_sessions
WHERE user_id = 'xxx'
  AND revoked_at IS NULL
  AND expires_at > NOW();
```

**対処**:
1. Frontend は自動的に `/login` にリダイレクト（実装済み）
2. ユーザーに再ログインを促す
3. `is_suspicious = true` の場合はセキュリティ上の理由で無効化されている

### 問題2: トークンがCookieに保存されない

**原因**: CORS設定不足

**対処**:
```typescript
// Backend: CORS設定
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true // Cookie許可
}));

// Frontend: fetch時
fetch('/api/endpoint', {
  credentials: 'include' // Cookie送信
});
```

### 問題3: リフレッシュが無限ループ

**原因**: Refresh Token が無効

**対処**:
1. ログアウト処理で Refresh Token を削除
2. `/login` への強制リダイレクト

---

## Testing（動作確認）

### Encore MCP でのテスト

```bash
# ログイン
encore mcp call auth.login --payload '{"email":"test@example.com","password":"password"}'

# プロフィール取得（認証必須）
encore mcp call auth.getProfile --auth-token "..."

# リフレッシュ
encore mcp call auth.refresh --payload '{"refreshToken":"..."}'
```

### Playwright でのテスト

```typescript
test('ログインフロー', async ({ page }) => {
  await page.goto('/login');

  await page.fill('input[type="email"]', 'test@example.com');
  await page.fill('input[type="password"]', 'password');
  await page.click('button[type="submit"]');

  // ダッシュボードにリダイレクトされることを確認
  await expect(page).toHaveURL('/dashboard');

  // Cookie確認
  const cookies = await page.context().cookies();
  const accessCookie = cookies.find(c => c.name === 'ACCESS_COOKIE');
  expect(accessCookie).toBeDefined();
});
```

---

## Related Patterns

- **session-pattern.md**: セッション管理（リフレッシュトークンローテーション）
- **permission-pattern.md**: 権限チェック（authData()の活用）
- **foundation-api client-pattern.md**: APIクライアント統合
