---
name: foundation-auth
description: |
  認証・認可システム全般。JWT認証、セッション管理、権限チェック、IP Trust評価を提供。

  【WHEN to use】
  - 認証機能の実装・拡張時
  - 権限チェックの実装時
  - ログイン/ログアウトフロー修正時
  - セキュリティ強化時

  【WHEN NOT to use】
  - 認証以外の機能開発
  - 単なるコンポーネント確認（foundation-components使用）

  【TRIGGER keywords】
  認証、ログイン、JWT、セッション、権限、パーミッション、OAuth、RBAC
allowed-tools: Read, Grep, Serena
---

# Template Auth: 認証・認可システム

## Overview

dashboard-acceleratorが提供する認証・認可システムの全体像と詳細パターンへのナビゲーション。

### Provided Features

- **JWT認証**: Access Token (15分) + Refresh Token (30日)
- **セッション管理**: 同時5セッション上限、セッションファミリー管理
- **権限管理**: Role-Based Access Control (RBAC)
- **IP Trust評価**: IP信頼度評価・学習システム
- **Trust Scoring**: ユーザー行動パターン学習
- **異常検知**: ログイン異常検知（実装中）
- **地理情報取得**: IPアドレスからの地理情報
- **リアルタイム監視**: セッション活動記録・通知

### Architecture（簡易図）

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ Login (email + password)
       ↓
┌──────────────────────────────────┐
│  JWT Authentication              │
│  - scrypt(N=16384) hash verify   │
│  - HS256 JWT signing             │
└──────┬───────────────────────────┘
       │ Access Token (15min) + Refresh Token (7day)
       ↓
┌──────────────────────────────────┐
│  Session Management              │
│  - Session family tracking       │
│  - Max 5 concurrent sessions     │
│  - IP Trust evaluation           │
│  - Trust Scoring                 │
└──────┬───────────────────────────┘
       │ authData()
       ↓
┌──────────────────────────────────┐
│  Permission Checker (RBAC)       │
│  - Role-based access control     │
└──────────────────────────────────┘
```

---

## Quick Reference（詳細への参照）

### 1. JWT認証パターン

**詳細**: `references/jwt-pattern.md`

**実装パス**:
- Backend: `backend/services/auth/auth.ts`
- Frontend: `frontend/src/lib/api/client.ts`

**概要**:
- Access Token: 15分有効期限（HS256）
- Refresh Token: 30日有効期限（SHA-256でDB保存）
- 自動リフレッシュ機能（Frontend統合）

**使用場面**:
- 新しいAPIエンドポイントに認証追加
- JWT検証ロジック確認
- トークンライフサイクル管理

**パターン例**:
```typescript
// Backend: 認証必須API
export const getProfile = api(
  { auth: true, expose: true, method: "GET", path: "/profile" },
  async (): Promise<UserProfile> => {
    const userId = authData()?.userID;
    // ...
  }
);
```

---

### 2. セッション管理パターン

**詳細**: `references/session-pattern.md`

**実装パス**: `backend/services/auth/session_management.ts`

**概要**:
- 同時アクティブセッション上限: 5
- セッションファミリー管理（リフレッシュトークンローテーション）
- 自動クリーンアップ（期限切れセッション削除）

**使用場面**:
- セッション一覧表示
- セッション強制ログアウト
- セッションアクティビティ監視

**パターン例**:
```typescript
// セッション一覧取得
const sessions = await SessionManagement.listUserSessions({ userId });

// セッション削除
await SessionManagement.revokeSession({ sessionId });
```

---

### 3. 権限管理パターン（RBAC）

**詳細**: `references/permission-pattern.md`

**実装パス**: `backend/services/app/modules/users/permissions.ts`

**概要**:
- Role-Based Access Control
- 階層的権限モデル（admin > manager > user > viewer）
- 動的権限チェック

**使用場面**:
- ロール別画面表示制御
- APIエンドポイントのアクセス制御
- 機能単位の権限チェック

**パターン例**:
```typescript
// Backend: 権限チェック
const hasPermission = await Permissions.checkPermission({
  userId,
  resource: 'customers',
  action: 'delete'
});

// Frontend: ロール別表示
{#if $user.role === 'admin'}
  <AdminPanel />
{/if}
```

---

### 4. IP Trust評価パターン

**詳細**: `references/ip-trust-pattern.md`

**実装パス**: `backend/services/auth/iptrust/`

**概要**:
- IP信頼度評価（0-100スコア）
- 学習ベースの信頼度向上
- 異常IP検知

**使用場面**:
- ログイン時のリスク評価
- 新規IPからのアクセス検知
- セキュリティアラート生成

---

## Important Constraints（制約）

### セキュリティ制約

- ❌ **Access Token を localStorage に保存禁止**
  - ✅ HttpOnly Cookie のみ使用

- ❌ **Refresh Token をフロントエンドに露出禁止**
  - ✅ Backend でのみ管理

- ❌ **パスワードを平文で保存禁止**
  - ✅ scrypt (N=16384) でハッシュ化

### セッション制約

- ✅ 同時アクティブセッション上限: **5**
  - 6個目のログイン時、最も古いセッションを自動削除

- ✅ セッションファミリー管理
  - Refresh Token使用時、新しいファミリーID発行
  - 古いファミリーは無効化

### 権限制約

- ✅ ロールは階層構造
  - `admin` > `manager` > `user` > `viewer`
  - 上位ロールは下位権限を包含

---

## Troubleshooting（よくある問題）

### 問題1: 401エラーが連続発生

**原因**: Refresh Token も期限切れ

**対処**:
1. Frontend は自動的に `/login` にリダイレクト（実装済み）
2. ユーザーに再ログインを促す

### 問題2: セッションが勝手に切れる

**原因**: 同時セッション数が5を超えた

**対処**:
1. `SessionManagement.listUserSessions()` で確認
2. 不要なセッションを手動削除
3. または上限を変更（`MAX_ACTIVE_SESSIONS`）

### 問題3: 新規IPからのログインがブロックされる

**原因**: IP Trust評価が低い

**対処**:
1. `IPTrust.evaluate()` で信頼度確認
2. ホワイトリスト登録（管理者操作）
3. または信頼度閾値を調整

---

## OpenSpec Integration

OpenSpecの変更提案内で以下のように参照：

```markdown
## Design

### Template Features Used

Uses: foundation-auth JWT pattern
Uses: foundation-auth Session management

Reference:
- .claude/skills/foundation-auth/references/jwt-pattern.md
- .claude/skills/foundation-auth/references/session-pattern.md

### Implementation Notes

- JWT認証をAPIエンドポイントに追加（`auth: true`）
- セッション管理はテンプレート提供のまま使用
- 新規権限は RBAC パターンに従って追加
```

---

## Related Skills

- **foundation-api**: APIクライアント（認証トークン自動付与）
- **foundation-error-handling**: 認証エラー処理（401自動リダイレクト）
- **foundation-monitoring**: Sentry統合（ユーザーコンテキスト設定）

---

このスキルを起点に、認証・認可の詳細パターンを references/ から参照してください。
