import type { SubmitFunction } from '@sveltejs/kit'
import { invalidate } from '$app/navigation'
import { toast } from '$lib/stores/toast'

export interface EnhanceOptions {
	successMessage?: string
	invalidateDeps?: string[] // e.g. ['app:users']
}

/**
 * SvelteKit form enhance の共通化
 */
export function useEnhance(opts: EnhanceOptions = {}): SubmitFunction {
	// SvelteKit enhance actionは (submit) => (result) => {} のシグネチャ
	return () => async ({ result, update }) => {
		if (result.type === 'failure') {
			const err = typeof result.data?.error === 'string' ? result.data.error : '操作に失敗しました'
			toast.error(err)
			// 失敗時も対象データのみの再取得に留める
			if (opts.invalidateDeps?.length) {
				for (const d of opts.invalidateDeps) await invalidate(d)
			}
			return
		}
		if (result.type === 'success') {
			if (opts.successMessage)
				toast.success(opts.successMessage)
			if (opts.invalidateDeps?.length) {
				for (const d of opts.invalidateDeps) {
					await invalidate(d)
				}
			}
			// invalidateDeps が指定されている場合は、対象のみ再取得すれば十分。
			// 余計な親レイアウトの再ロードを避けるため、update() は省略する。
			if (!opts.invalidateDeps || opts.invalidateDeps.length === 0) {
				await update()
			}
			return
		}
		if (result.type === 'redirect') {
			await update()
		}
	}
}
