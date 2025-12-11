# 自動リフレッシュ・リトライパターン

## 実装パス

`frontend/src/lib/api/client.ts`

---

## withAutoRefresh() の仕組み

### アーキテクチャ

```
API Call (with Access Token)
  ↓
401 Unauthorized
  ↓
withAutoRefresh() が捕捉
  ↓
├─ refresh() でトークンをリフレッシュ
├─ onRefreshed() で新しいトークンを保存
├─ exec() を新しいトークンで再実行（1回のみ）
└─ 成功 → レスポンス返却

失敗時:
  ↓
Refresh Token も無効
  ↓
401エラーを再スロー → withErrorHandling() が /login リダイレクト
```

---

## 基本的な使い方

### シンプルな例

```typescript
import { withAutoRefresh, setTokensToCookies, getTokensFromCookies } from '$lib/api/client';
import { serverClient } from '$lib/api/client';

// SSRでの使用例
export const load: PageServerLoad = async (event) => {
  const client = serverClient(event);
  const { refresh_token } = getTokensFromCookies(event.cookies);

  const customers = await withAutoRefresh({
    exec: () => client.app.listCustomers(),
    refresh: () => client.auth.refresh({ refresh_token }),
    onRefreshed: (tokens) => {
      setTokensToCookies(event.cookies, tokens);
    }
  });

  return { customers };
};
```

---

## 実装詳細

### withAutoRefresh() 実装

```typescript
// frontend/src/lib/api/client.ts

export async function withAutoRefresh<T>(params: {
  exec: () => Promise<T>
  refresh: () => Promise<{ access_token: string, refresh_token: string, expires_in: number }>
  onRefreshed: (tokens: { access_token: string, refresh_token: string, expires_in: number }) => void
}): Promise<T> {
  try {
    return await params.exec()
  } catch (e: unknown) {
    // EncoreのAPIErrorを文字列/ステータスベースで判別
    const status = typeof e === 'object' && e !== null && 'status' in e && typeof e.status === 'number'
      ? e.status
      : (typeof e === 'object' && e !== null && 'message' in e && typeof e.message === 'string' && e.message.includes('status 401') ? 401 : undefined)

    if (status !== 401)
      throw e

    // 401エラー → リフレッシュを試行
    const t = await params.refresh()
    params.onRefreshed(t)
    return params.exec()
  }
}
```

**重要な特徴**:
- シンプルな関数ベース実装（Proxyなし）
- 401エラー時に1回だけリフレッシュ
- キューイング機構なし（複雑さを避ける）
- リフレッシュ後、即座に元のリクエストを再実行

---

## Cookie管理ヘルパー

### setTokensToCookies()

```typescript
export function setTokensToCookies(
  cookies: Cookies,
  tokens: { access_token: string, refresh_token: string, expires_in?: number }
) {
  const isProd = processEnv.NODE_ENV === 'production';
  const maxAge = tokens.expires_in ?? 60 * 15; // fallback 15min
  const common = { path: '/', httpOnly: true as const, sameSite: 'lax' as const, secure: isProd };

  cookies.set(ACCESS_COOKIE, tokens.access_token, { ...common, maxAge });
  // refreshは長め（30日相当）
  cookies.set(REFRESH_COOKIE, tokens.refresh_token, { ...common, maxAge: 60 * 60 * 24 * 30 });
}
```

**自動設定内容**:
- `httpOnly: true` - XSS攻撃対策
- `sameSite: 'lax'` - CSRF攻撃対策
- `secure: true` - 本番環境のみHTTPS必須
- `path: '/'` - 全パスで有効
- Access Token: `maxAge = expires_in` (デフォルト: 15分)
- Refresh Token: `maxAge = 30日` (固定)

### getTokensFromCookies()

```typescript
export function getTokensFromCookies(cookies: Cookies): TokenSet {
  return {
    access_token: cookies.get(ACCESS_COOKIE) ?? null,
    refresh_token: cookies.get(REFRESH_COOKIE) ?? null,
  };
}
```

### clearTokens()

```typescript
export function clearTokens(cookies: Cookies) {
  const common = { path: '/' } as const;
  cookies.delete(ACCESS_COOKIE, common);
  cookies.delete(REFRESH_COOKIE, common);
}
```

---

## withErrorHandlingAndRefresh() 統合版

自動リフレッシュとエラーハンドリングを組み合わせた便利関数:

```typescript
export async function withErrorHandlingAndRefresh<T>(params: {
  exec: () => Promise<T>
  refresh: () => Promise<{ access_token: string, refresh_token: string, expires_in: number }>
  onRefreshed: (tokens: { access_token: string, refresh_token: string, expires_in: number }) => void
  errorHandling?: {
    showGlobalError?: boolean
    redirectOnAuthError?: boolean
    autoCloseMs?: number
    onError?: (error: UIError) => void
    reportToSentry?: boolean
  }
}): Promise<T> {
  return withErrorHandling(
    async () => withAutoRefresh({
      exec: params.exec,
      refresh: params.refresh,
      onRefreshed: params.onRefreshed,
    }),
    params.errorHandling,
  );
}
```

### 使用例

```typescript
// SSR
export const load: PageServerLoad = async (event) => {
  const client = serverClient(event);
  const { refresh_token } = getTokensFromCookies(event.cookies);

  const profile = await withErrorHandlingAndRefresh({
    exec: () => client.app.getProfile(),
    refresh: () => client.auth.refresh({ refresh_token }),
    onRefreshed: (tokens) => {
      setTokensToCookies(event.cookies, tokens);
    },
    errorHandling: {
      showGlobalError: false, // SSRではグローバルエラー不要
      reportToSentry: true,
    }
  });

  return { profile };
};
```

---

## 実装例

### SSR: Load関数

```typescript
// frontend/src/routes/(app)/dashboard/+page.server.ts

import {
  serverClient,
  withAutoRefresh,
  setTokensToCookies,
  getTokensFromCookies
} from '$lib/api/client';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const client = serverClient(event);
  const { refresh_token } = getTokensFromCookies(event.cookies);

  if (!refresh_token) {
    throw error(401, '認証が必要です');
  }

  try {
    const stats = await withAutoRefresh({
      exec: () => client.app.getDashboardStats(),
      refresh: () => client.auth.refresh({ refresh_token }),
      onRefreshed: (tokens) => {
        setTokensToCookies(event.cookies, tokens);
      }
    });

    return { stats };
  } catch (err: any) {
    // リフレッシュも失敗 → ログインページへ
    throw error(401, 'セッションの有効期限が切れました');
  }
};
```

---

## リトライ戦略

### 現在の実装: 1回のみリトライ

```typescript
try {
  return await params.exec();
} catch (e: unknown) {
  if (status !== 401) throw e;

  // 1回だけリフレッシュ＆リトライ
  const t = await params.refresh();
  params.onRefreshed(t);
  return params.exec();
}
```

**理由**:
- Refresh Token が有効 → 1回のリフレッシュで成功
- Refresh Token が無効 → リトライしても失敗（ログアウト）
- 2回以上リトライする必要性がない

---

## Token のライフサイクル

### トークン有効期限

```
Access Token:  15分 (backend/services/auth/auth.ts で定義)
Refresh Token: 30日 (Cookieの maxAge で制御)
```

### リフレッシュタイミング

**現在の実装**: Reactive（401エラー発生時）

```
t=0:     ログイン → Access Token A 発行
t=15分:  Access Token A 期限切れ
t=15分1秒: API Call → 401 → リフレッシュ → Access Token B 発行 → リトライ成功
t=30分:  Access Token B 期限切れ
t=30分1秒: API Call → 401 → リフレッシュ → Access Token C 発行 → リトライ成功
```

**推奨**: 現在の Reactive 方式で十分
- シンプルな実装
- 必要な時だけリフレッシュ
- 不要なネットワークトラフィックなし

---

## serverClient() の自動トークン参照

### 常に最新のCookieを参照

```typescript
export function serverClient(event: RequestEvent) {
  return new Client(BASE_URL, {
    // 常に最新のCookieからAuthorizationを生成する（トークン更新直後でも即反映）
    auth: () => {
      const at = event.cookies.get(ACCESS_COOKIE);
      return at ? ({ authorization: `Bearer ${at}` } as AuthNS.AuthParams) : {};
    },
  });
}
```

**重要**: `auth` を関数として定義することで、リフレッシュ後の新しいトークンが即座に反映されます。

---

## Troubleshooting

### 問題1: リフレッシュ後も401エラー

**原因**: 新しい Access Token が Cookie に保存されていない

**確認**:
```typescript
// onRefreshed コールバックが正しく実装されているか確認
withAutoRefresh({
  exec: () => client.app.getProfile(),
  refresh: () => client.auth.refresh({ refresh_token }),
  onRefreshed: (tokens) => {
    // ✅ これが必須
    setTokensToCookies(event.cookies, tokens);
  }
});
```

---

### 問題2: Refresh Token が見つからない

**原因**: Cookieが正しく設定されていない、または有効期限切れ

**確認**:
```typescript
const { access_token, refresh_token } = getTokensFromCookies(event.cookies);

if (!refresh_token) {
  // Refresh Token がない → ログインページへ
  throw error(401, '認証が必要です');
}
```

---

### 問題3: 無限リフレッシュループ

**原因**: `refresh()` 関数自体が401を返している可能性

**対処**: `refresh()` エンドポイントは認証不要にする

```typescript
// backend/services/auth/auth.ts

export const refresh = api(
  {
    expose: true,
    auth: false, // ✅ 認証不要
    method: "POST",
    path: "/auth/refresh"
  },
  async (params: { refresh_token: string }): Promise<TokenResponse> => {
    // refresh_token を検証してトークンを再発行
  }
);
```

---

### 問題4: serverClient() が古いトークンを使う

**原因**: `auth` をオブジェクトとして定義している

**確認**:
```typescript
// ❌ 悪い例（トークン更新が反映されない）
export function serverClient(event: RequestEvent) {
  const at = event.cookies.get(ACCESS_COOKIE);
  return new Client(BASE_URL, {
    auth: at ? { authorization: `Bearer ${at}` } : {}
  });
}

// ✅ 良い例（常に最新のトークンを参照）
export function serverClient(event: RequestEvent) {
  return new Client(BASE_URL, {
    auth: () => {
      const at = event.cookies.get(ACCESS_COOKIE);
      return at ? { authorization: `Bearer ${at}` } : {};
    }
  });
}
```

---

## Related Patterns

- **client-pattern.md**: serverClient/browserClient の使い分け
- **error-handling.md**: withErrorHandling() との連携
- **foundation-auth jwt-pattern.md**: JWT発行・検証ロジック
- **foundation-auth session-pattern.md**: セッション管理
