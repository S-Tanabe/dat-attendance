import type { APIError } from '$lib/generated/client'
import type { UIError } from './types'
import {
	AUTH_ERROR_CODES,
	PERMISSION_ERROR_CODES,
	SYSTEM_ERROR_STATUS_CODES,
} from './error-codes'
import { getErrorMessage } from './error-messages'

/**
 * BusinessErrorDetailsの型定義
 */
interface BusinessErrorDetails {
	errorCode?: string
	retryable?: boolean
	suggestedAction?: string
	reason?: string
	metadata?: Record<string, unknown>
}

/**
 * detailsがBusinessErrorDetails型かどうかを判定
 * 各プロパティの型を厳密にチェック
 */
function isBusinessErrorDetails(details: unknown): details is BusinessErrorDetails {
	// オブジェクトかどうかをチェック
	if (typeof details !== 'object' || details === null) {
		return false
	}

	const obj = details as Record<string, unknown>

	// 各プロパティが存在する場合、正しい型かチェック
	if ('errorCode' in obj && typeof obj.errorCode !== 'string') {
		return false
	}
	if ('retryable' in obj && typeof obj.retryable !== 'boolean') {
		return false
	}
	if ('suggestedAction' in obj && typeof obj.suggestedAction !== 'string') {
		return false
	}
	if ('reason' in obj && typeof obj.reason !== 'string') {
		return false
	}
	if ('metadata' in obj && (typeof obj.metadata !== 'object' || obj.metadata === null || Array.isArray(obj.metadata))) {
		return false
	}

	return true
}

/**
 * APIエラーをUIエラーに変換
 *
 * この関数がエラーハンドリングの中心
 * 全てのAPI呼び出しでこの関数を通してエラーを変換する
 */
export function transformApiError(error: unknown): UIError {
	// Encore の APIError の場合
	if (isAPIError(error)) {
		// detailsを安全に取得
		const rawDetails: unknown = error.details
		const details = isBusinessErrorDetails(rawDetails) ? rawDetails : undefined
		const businessCode = details?.errorCode

		// エラーメッセージを取得
		const userMessage = getErrorMessage(error.code, businessCode)

		return {
			code: businessCode || error.code,
			userMessage,
			details: {
				retryable: details?.retryable ?? false,
				suggestedAction: details?.suggestedAction,
				reason: details?.reason,
				metadata: details?.metadata,
			},
			statusCode: getStatusCodeFromErrorCode(error.code),
			originalError: error,
		}
	}

	// 通常の Error オブジェクトの場合
	if (error instanceof Error) {
		return {
			code: 'unknown',
			userMessage: '予期しないエラーが発生しました。',
			statusCode: 500,
			details: {
				retryable: false,
				reason: error.message,
			},
			originalError: error,
		}
	}

	// それ以外
	return {
		code: 'unknown',
		userMessage: 'エラーが発生しました。',
		statusCode: 500,
		details: { retryable: false },
		originalError: error,
	}
}

/**
 * Encore エラーコード → HTTPステータスコード
 */
function getStatusCodeFromErrorCode(code: string): number {
	const mapping: Record<string, number> = {
		invalid_argument: 400,
		not_found: 404,
		already_exists: 409,
		permission_denied: 403,
		unauthenticated: 401,
		failed_precondition: 400,
		internal: 500,
		unavailable: 503,
		deadline_exceeded: 504,
	}
	return mapping[code] ?? 500
}

/**
 * エラーが APIError かどうか判定
 */
export function isAPIError(error: unknown): error is APIError {
	if (typeof error !== 'object' || error === null) {
		return false
	}

	const err = error as Record<string, unknown>
	return 'code' in err
    && 'message' in err
    && typeof err.code === 'string'
}

/**
 * エラーが認証エラーかどうか判定
 * エラーコードは error-codes.ts の AUTH_ERROR_CODES で管理
 */
export function isAuthenticationError(error: UIError): boolean {
	return AUTH_ERROR_CODES.has(error.code)
}

/**
 * エラーがシステムエラーかどうか判定
 * ステータスコードは error-codes.ts の SYSTEM_ERROR_STATUS_CODES で管理
 */
export function isSystemError(error: UIError): boolean {
	return SYSTEM_ERROR_STATUS_CODES.has(error.statusCode)
}

/**
 * エラーが権限エラーかどうか判定
 * エラーコードは error-codes.ts の PERMISSION_ERROR_CODES で管理
 */
export function isPermissionError(error: UIError): boolean {
	return PERMISSION_ERROR_CODES.has(error.code)
}
