---
name: foundation-api
description: |
  API通信システム全般。serverClient/browserClient、自動リフレッシュ、統一エラーハンドリングを提供。

  【WHEN to use】
  - Backend API通信実装時
  - 認証付きAPIリクエスト実装時
  - エラーハンドリング統合時

  【TRIGGER keywords】
  API通信、fetch、client、serverClient、browserClient、エラーハンドリング
allowed-tools: Read, Grep
---

# Template API: API通信システム

## Overview

**実装パス**: `frontend/src/lib/api/client.ts`

### Provided Features

- **serverClient()**: SSR用APIクライアント（Cookie自動付与）
- **browserClient()**: ブラウザ用APIクライアント
- **serverClientWithForwardedHeaders()**: IP/UAヘッダー転送
- **withAutoRefresh()**: 401エラー時の自動トークンリフレッシュ
- **withErrorHandling()**: 統一エラーハンドリング
- **HttpOnly Cookie管理**: ACCESS_COOKIE / REFRESH_COOKIE

---

## Quick Reference

### 1. Client使い分け

**詳細**: `references/client-pattern.md`

```typescript
// SSR (load関数内)
import { serverClient } from '$lib/api/client';
const client = serverClient();

// Browser (onMount, イベントハンドラ)
import { browserClient } from '$lib/api/client';
const client = browserClient();
```

### 2. 自動リフレッシュ

401エラー時、自動的にRefresh Tokenで更新してリトライ（実装済み）

### 3. エラーハンドリング

システムエラー自動Sentry送信、ユーザーエラー自動トースト表示（実装済み）

---

## 制約

- ❌ 直接 `fetch()` 禁止
- ✅ 必ず `generated/client` 経由
- ✅ Cookie は HttpOnly のみ

---

## Related Skills

- **foundation-auth**: JWT認証（Cookie管理）
- **foundation-error-handling**: エラー処理統合
