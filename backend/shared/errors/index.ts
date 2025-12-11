/**
 * エラーハンドリングシステム
 *
 * このモジュールは、バックエンド全体で統一されたエラー処理を提供します。
 *
 * 使用例:
 * ```typescript
 * import { createBusinessError, AuthErrorCode } from "../../shared/errors";
 *
 * throw createBusinessError(
 *   AuthErrorCode.TOKEN_EXPIRED,
 *   "JWT token has expired",
 *   { retryable: true, suggestedAction: "relogin" }
 * );
 * ```
 */

export * from "./error-codes";
export * from "./types";
export * from "./helpers";
