import { APIError, ErrCode } from "encore.dev/api";
import type { BusinessErrorDetails } from "./types";

/**
 * ビジネスロジックエラーを生成
 *
 * 使用例:
 * throw createBusinessError(
 *   AuthErrorCode.TOKEN_EXPIRED,
 *   "JWT token has expired",
 *   { retryable: true, suggestedAction: "relogin" }
 * );
 */
export function createBusinessError(
  errorCode: string,
  reason: string,
  options: {
    retryable: boolean;
    suggestedAction?: string;
    metadata?: Record<string, any>;
  }
): APIError {
  const details: BusinessErrorDetails = {
    errorCode,
    reason,
    retryable: options.retryable,
    suggestedAction: options.suggestedAction,
    metadata: options.metadata,
  };

  // ユーザー向けメッセージはフロントエンドで errorCode から生成
  // バックエンドは最小限の情報のみ
  return new APIError(ErrCode.FailedPrecondition, reason, undefined, details);
}

/**
 * バリデーションエラーを生成
 *
 * 使用例:
 * throw createValidationError("email", "Invalid email format");
 */
export function createValidationError(
  field: string,
  reason: string,
  metadata?: Record<string, any>
): APIError {
  const details: BusinessErrorDetails = {
    errorCode: "VALIDATION_ERROR",
    reason: `Validation failed for field: ${field}`,
    retryable: true,
    metadata: { field, ...metadata },
  };

  return new APIError(
    ErrCode.InvalidArgument,
    `Invalid ${field}: ${reason}`,
    undefined,
    details
  );
}

/**
 * リソース不在エラーを生成
 *
 * 使用例:
 * throw createNotFoundError("User", userId);
 */
export function createNotFoundError(
  resourceType: string,
  resourceId: string
): APIError {
  return new APIError(
    ErrCode.NotFound,
    `${resourceType} not found`,
    undefined,
    {
      errorCode: "RESOURCE_NOT_FOUND",
      reason: `${resourceType} with ID ${resourceId} does not exist`,
      retryable: false,
      metadata: { resourceType, resourceId },
    } as BusinessErrorDetails
  );
}

/**
 * 権限エラーを生成
 *
 * 使用例:
 * throw createPermissionError("delete", "User");
 */
export function createPermissionError(
  action: string,
  resourceType: string
): APIError {
  return new APIError(
    ErrCode.PermissionDenied,
    `Permission denied for ${action} on ${resourceType}`,
    undefined,
    {
      errorCode: "PERMISSION_DENIED",
      reason: `User lacks permission to ${action} ${resourceType}`,
      retryable: false,
      metadata: { action, resourceType },
    } as BusinessErrorDetails
  );
}

/**
 * 認証エラーを生成
 *
 * 使用例:
 * throw createAuthenticationError("Token expired");
 */
export function createAuthenticationError(
  errorCode: string,
  reason: string,
  metadata?: Record<string, any>
): APIError {
  return new APIError(
    ErrCode.Unauthenticated,
    reason,
    undefined,
    {
      errorCode,
      reason,
      retryable: true,
      suggestedAction: "relogin",
      metadata,
    } as BusinessErrorDetails
  );
}

/**
 * 外部サービスエラーを生成
 *
 * 使用例:
 * throw createExternalServiceError("EmailService", originalError);
 */
export function createExternalServiceError(
  serviceName: string,
  originalError: Error
): APIError {
  return new APIError(
    ErrCode.Unavailable,
    `${serviceName} is temporarily unavailable`,
    undefined,
    {
      errorCode: "EXTERNAL_SERVICE_ERROR",
      reason: originalError.message,
      retryable: true,
      suggestedAction: "retry_later",
      metadata: { serviceName },
    } as BusinessErrorDetails
  );
}

/**
 * システムエラーを生成（予期しないエラー用）
 *
 * 使用例:
 * throw createInternalError("Database connection failed", originalError);
 */
export function createInternalError(
  reason: string,
  originalError?: Error
): APIError {
  return new APIError(
    ErrCode.Internal,
    "Internal server error",
    undefined,
    {
      errorCode: "INTERNAL_ERROR",
      reason,
      retryable: false,
      suggestedAction: "contact_support",
      metadata: originalError ? { originalError: originalError.message } : undefined,
    } as BusinessErrorDetails
  );
}
