# 権限管理パターン（ロールレベルベース）

## 実装場所

- `backend/services/app/modules/users/permissions.ts`

---

## 権限モデル

### ロールレベル定義

実装では、数値レベルに基づくシンプルなロール階層を使用しています:

```typescript
export const RoleLevel = {
  SUPER_ADMIN: 1,  // スーパー管理者（開発者用）
  ADMIN: 2,        // 管理者（クライアント用）
  USER: 3,         // 一般ユーザー
} as const;
```

**ロール階層**:
```
SUPER_ADMIN (level=1, 最上位)
  └─ すべての権限
     ↓
ADMIN (level=2)
  └─ 管理者権限
     ↓
USER (level=3, デフォルト)
  └─ 一般ユーザー権限
```

**権限チェックロジック**: `userLevel <= requiredLevel` の場合に権限あり

### データベーススキーマ

```sql
-- roles テーブル
CREATE TABLE roles (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  level INTEGER NOT NULL,
  description TEXT
);

-- app_users テーブル（role_id で roles を参照）
CREATE TABLE app_users (
  id UUID PRIMARY KEY,
  role_id UUID REFERENCES roles(id),
  -- ... その他のカラム
);
```

### 権限チェックパターン

**Backend: checkPermission()**
```typescript
import { checkPermission, RoleLevel, requirePermission } from './modules/users/permissions';

// パターン1: 権限チェックしてboolean取得
export const deleteCustomer = api(
  { auth: true, method: "DELETE", path: "/customers/:id" },
  async ({ id }: { id: string }): Promise<void> => {
    // ADMIN以上（level <= 2）の権限が必要
    const hasPermission = await checkPermission(RoleLevel.ADMIN);
    if (!hasPermission) {
      throw APIError.permissionDenied('管理者権限が必要です');
    }

    await deleteCustomerById(id);
  }
);

// パターン2: requirePermission()で強制チェック
export const deleteCustomer = api(
  { auth: true, method: "DELETE", path: "/customers/:id" },
  async ({ id }: { id: string }): Promise<void> => {
    // ADMIN以上でない場合、自動的に permissionDenied エラー
    await requirePermission(RoleLevel.ADMIN);

    await deleteCustomerById(id);
  }
);
```

**Backend: 特定ロール名でのチェック**
```typescript
import { hasRole, isSuperAdmin, isAdmin } from './modules/users/permissions';

export const dangerousOperation = api(
  { auth: true, method: "POST", path: "/admin/dangerous" },
  async (): Promise<void> => {
    // ロール名での直接チェック
    if (await hasRole('SUPER_ADMIN')) {
      // スーパー管理者のみ実行可能
      await performDangerousOperation();
    }

    // または便利関数を使用
    if (await isSuperAdmin()) {
      await performDangerousOperation();
    }
  }
);
```

**Frontend: ロールレベルに基づくUI制御**

**注意**: テンプレートには専用のuserストアは実装されていません。ユーザー情報はAPIから取得してページごとに管理してください。

```svelte
<script lang="ts">
  // +page.server.ts から受け取ったユーザー情報を使用
  let { data } = $props();
  let userRoleLevel = $state(data.user?.roleLevel); // 例: 2 (ADMIN)
</script>

{#if userRoleLevel <= 2}
  <!-- ADMIN以上のみ表示 -->
  <button onclick={deleteCustomer}>削除</button>
{/if}

{#if userRoleLevel === 1}
  <!-- SUPER_ADMIN のみ表示 -->
  <button onclick={dangerousOperation}>危険な操作</button>
{/if}
```

---

## 実装詳細

### ロールレベル取得（キャッシュ付き）

```typescript
// backend/services/app/modules/users/permissions.ts より

export async function getRoleLevel(userId: string): Promise<number> {
  // 1. キャッシュチェック（デフォルト60秒TTL）
  const cached = roleCache.get(userId);
  const now = Date.now();
  if (cached && now - cached.ts < ttl) {
    return cached.level;
  }

  // 2. DB から取得
  const row = await db.queryRow(`
    SELECT COALESCE(r.level, 3) as level
    FROM app_users a
    LEFT JOIN roles r ON r.id = a.role_id
    WHERE a.id = $1
  `, [userId]);

  const level = row?.level ?? RoleLevel.USER; // デフォルト: USER (3)

  // 3. キャッシュに保存
  roleCache.set(userId, { level, ts: now });

  return level;
}
```

### キャッシュ無効化

```typescript
import { invalidateRoleCache } from './modules/users/permissions';

// ユーザーのロール変更後にキャッシュをクリア
export const updateUserRole = api(
  { auth: true, method: "PUT", path: "/users/:id/role" },
  async ({ id, roleId }: { id: string; roleId: string }): Promise<void> => {
    await db.execute(`
      UPDATE app_users SET role_id = $1 WHERE id = $2
    `, [roleId, id]);

    // キャッシュ無効化
    invalidateRoleCache(id);
  }
);
```

---

## キャッシュ設定

ロールレベルのキャッシュTTLは環境変数で設定可能です:

```bash
# デフォルト: 60000ms (60秒)
export USERS_ROLE_CACHE_TTL_MS=60000
```

---

## 制約

### ❌ 禁止事項

- ロールレベル番号を直接ハードコードしない
  - ❌ `if (level <= 2)`
  - ✅ `if (level <= RoleLevel.ADMIN)`

- リソースベースの細かい権限制御は未実装
  - 実装されているのはロールレベルベースの権限チェックのみ
  - リソース単位（customers, orders等）の権限制御は未サポート

### ✅ 推奨事項

- `RoleLevel` 定数を使用する
- `requirePermission()` を使用して簡潔に書く
- ロール変更時は必ず `invalidateRoleCache()` を呼ぶ
- フロントエンドでもバックエンドでも権限チェックを行う（防御的プログラミング）

---

## Related Patterns

- **jwt-pattern.md**: authData()からのuserID取得
- **session-pattern.md**: セッション内のユーザー情報
