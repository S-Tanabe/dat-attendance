/**
 * Error Testing APIs
 *
 * エラーハンドリングシステムのテスト用エンドポイント
 * 各種エラーを意図的に発生させて、フロントエンドのエラー処理を確認できます
 */

import { api } from "encore.dev/api";
import {
  createBusinessError,
  createValidationError,
  createNotFoundError,
  createPermissionError,
  createAuthenticationError,
  AuthErrorCode,
  UserErrorCode,
  ValidationErrorCode,
} from "../../shared/errors";
import { setSentryServiceContext, setSentryUser } from "../../config/sentry.config";

/**
 * バリデーションエラーのテスト
 */
export const testValidationError = api(
  { method: "GET", path: "/dev_tools/error-test/validation", expose: true },
  async (): Promise<{ message: string }> => {
    // ✅ Sentryサービスコンテキストを設定
    setSentryServiceContext("dev_tools", "testValidationError");

    throw createValidationError(
      "email",
      "Email format is invalid",
      { providedValue: "invalid-email" }
    );
  }
);

/**
 * 認証エラーのテスト
 */
export const testAuthenticationError = api(
  { method: "GET", path: "/dev_tools/error-test/auth", expose: true },
  async (): Promise<{ message: string }> => {
    // ✅ Sentryサービスコンテキストを設定
    setSentryServiceContext("dev_tools", "testAuthenticationError");

    throw createAuthenticationError(
      AuthErrorCode.TOKEN_EXPIRED,
      "Access token has expired",
      { expiredAt: new Date().toISOString() }
    );
  }
);

/**
 * 権限エラーのテスト
 */
export const testPermissionError = api(
  { method: "GET", path: "/dev_tools/error-test/permission", expose: true },
  async (): Promise<{ message: string }> => {
    throw createPermissionError("delete", "User");
  }
);

/**
 * リソース不在エラーのテスト
 */
export const testNotFoundError = api(
  { method: "GET", path: "/dev_tools/error-test/notfound", expose: true },
  async (): Promise<{ message: string }> => {
    throw createNotFoundError("User", "test-user-id-123");
  }
);

/**
 * ビジネスロジックエラーのテスト（再試行可能）
 */
export const testRetryableBusinessError = api(
  { method: "GET", path: "/dev_tools/error-test/business-retryable", expose: true },
  async (): Promise<{ message: string }> => {
    throw createBusinessError(
      UserErrorCode.ACCOUNT_SUSPENDED,
      "User account is temporarily suspended",
      {
        retryable: true,
        suggestedAction: "contact_support",
        metadata: {
          suspendedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
      }
    );
  }
);

/**
 * ビジネスロジックエラーのテスト（再試行不可）
 */
export const testNonRetryableBusinessError = api(
  { method: "GET", path: "/dev_tools/error-test/business-non-retryable", expose: true },
  async (): Promise<{ message: string }> => {
    throw createBusinessError(
      UserErrorCode.EMAIL_ALREADY_EXISTS,
      "Email address is already registered",
      {
        retryable: false,
        metadata: { email: "test@example.com" },
      }
    );
  }
);

/**
 * システムエラーのテスト（500）
 */
export const testInternalError = api(
  { method: "GET", path: "/dev_tools/error-test/internal", expose: true },
  async (): Promise<{ message: string }> => {
    // ✅ テスト用ユーザーコンテキスト設定
    setSentryUser("test-user-123", "test@example.com", "test-user");

    // ✅ Sentryサービスコンテキストを設定
    setSentryServiceContext("dev_tools", "testInternalError");

    // 予期しないエラーをスロー（自動的に500になる）
    throw new Error("Unexpected internal server error for testing");
  }
);

/**
 * 正常レスポンスのテスト
 */
export const testSuccess = api(
  { method: "GET", path: "/dev_tools/error-test/success", expose: true },
  async (): Promise<{ message: string }> => {
    return {
      message: "Success! No errors occurred.",
    };
  }
);
