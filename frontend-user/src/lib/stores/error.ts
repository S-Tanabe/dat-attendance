/**
 * エラーストア
 * 共通のエラーストアは @dat-attendance/shared から提供されます
 */
export {
	clearError,
	errorSeverity,
	globalError,
	hasError,
	isRetryable,
	setError,
} from '@dat-attendance/shared/stores'
