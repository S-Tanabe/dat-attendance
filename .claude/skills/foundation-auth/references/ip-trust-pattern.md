# IP Trust評価パターン

## 実装場所

- `backend/services/auth/iptrust/`
  - `evaluate.ts`: IP信頼度評価
  - `settings.ts`: 信頼設定管理
  - `api.ts`: 公開API

---

## IP Trust評価の仕組み

### 信頼度スコア（0-100）

- **100**: 完全に信頼されたIP（ホワイトリスト）
- **80-99**: 高信頼（過去の成功ログイン多数）
- **50-79**: 中信頼（いくつかの成功ログイン）
- **20-49**: 低信頼（初回または失敗多数）
- **0-19**: 疑わしい（異常パターン検知）

### 評価ロジック

```typescript
async function evaluateIPTrust(ipAddress: string, userId: string): Promise<number> {
  // 過去のログイン履歴取得
  const loginHistory = await db.query(`
    SELECT success, timestamp
    FROM login_attempts
    WHERE ip_address = $1 AND user_id = $2
    ORDER BY timestamp DESC
    LIMIT 100
  `, [ipAddress, userId]);

  let score = 50; // 初期スコア

  // 成功率による加算
  const successRate = loginHistory.filter(l => l.success).length / loginHistory.length;
  score += successRate * 30;

  // 利用期間による加算
  const daysSinceFirst = (Date.now() - loginHistory[0]?.timestamp) / (1000 * 60 * 60 * 24);
  if (daysSinceFirst > 30) score += 20;

  // 異常検知による減算
  if (await detectAnomalies(ipAddress)) {
    score -= 40;
  }

  return Math.max(0, Math.min(100, score));
}
```

---

## 使用例

### ログイン時のリスク評価

```typescript
export const login = api(
  { method: "POST", path: "/auth/login" },
  async ({ email, password, ipAddress }: LoginRequest): Promise<LoginResponse> => {
    const user = await getUserByEmail(email);
    const isValidPassword = await verifyPassword(password, user.passwordHash);

    if (!isValidPassword) {
      throw APIError.unauthenticated();
    }

    // IP Trust評価
    const trustScore = await evaluateIPTrust(ipAddress, user.id);

    if (trustScore < 20) {
      // 2FA要求
      return { requiresTwoFactor: true };
    }

    // 通常ログイン
    const tokens = await generateTokens(user.id);
    return { tokens };
  }
);
```

---

## Related Patterns

- **jwt-pattern.md**: ログインフロー
- **session-pattern.md**: セッション作成時のIP記録
