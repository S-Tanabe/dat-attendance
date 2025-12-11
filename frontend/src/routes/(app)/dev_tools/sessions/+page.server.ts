import type { Actions, PageServerLoad } from './$types'
import { getTokensFromCookies, serverClient, setTokensToCookies, withAutoRefresh } from '$lib/api/client'
import { fail, redirect } from '@sveltejs/kit'

export const load: PageServerLoad = async (event) => {
	const parent = await event.parent()
	const user = parent.user
	// super_admin 以外はダッシュボードへ
	if (!user?.role?.name || user.role.name !== 'super_admin') {
		throw redirect(302, '/dashboard')
	}

	event.depends('app:dev_tools:sessions')

	const client = serverClient(event)
	const { refresh_token } = getTokensFromCookies(event.cookies)

	async function fetchStats() {
		return client.dev_tools.session_stats()
	}

	try {
		const stats = await withAutoRefresh({
			exec: fetchStats,
			refresh: async () => {
				if (!refresh_token)
					throw new Error('no-refresh-token')
				return client.auth.refresh({ refresh_token })
			},
			onRefreshed: (t) => setTokensToCookies(event.cookies, t),
		})
		return { stats }
	} catch (e: unknown) {
		return { stats: null, error: e instanceof Error ? e.message : 'セッション統計の取得に失敗しました' }
	}
}

export const actions: Actions = {
	refresh: async (event) => {
		const client = serverClient(event)
		const { refresh_token } = getTokensFromCookies(event.cookies)
		try {
			await withAutoRefresh({
				exec: async () => client.dev_tools.session_stats(),
				refresh: async () => {
					if (!refresh_token)
						throw new Error('no-refresh-token')
					return client.auth.refresh({ refresh_token })
				},
				onRefreshed: (t) => setTokensToCookies(event.cookies, t),
			})
			// 成功時はクライアント側でinvalidateする
			return { success: true }
		} catch (e: unknown) {
			return fail(400, { error: e instanceof Error ? e.message : '統計の更新に失敗しました' })
		}
	},
	expire: async (event) => {
		const client = serverClient(event)
		const { refresh_token } = getTokensFromCookies(event.cookies)
		try {
			const result = await withAutoRefresh({
				exec: async () => client.dev_tools.expire_all_sessions(),
				refresh: async () => {
					if (!refresh_token)
						throw new Error('no-refresh-token')
					return client.auth.refresh({ refresh_token })
				},
				onRefreshed: (t) => setTokensToCookies(event.cookies, t),
			})
			return { success: true, expireResult: result }
		} catch (e: unknown) {
			return fail(400, { error: e instanceof Error ? e.message : '全セッションの期限切れ処理に失敗しました' })
		}
	},

	cleanup: async (event) => {
		const client = serverClient(event)
		const { refresh_token } = getTokensFromCookies(event.cookies)
		try {
			const result = await withAutoRefresh({
				exec: async () => client.dev_tools.cleanup_sessions(),
				refresh: async () => {
					if (!refresh_token)
						throw new Error('no-refresh-token')
					return client.auth.refresh({ refresh_token })
				},
				onRefreshed: (t) => setTokensToCookies(event.cookies, t),
			})
			return { success: true, cleanupResult: result }
		} catch (e: unknown) {
			return fail(400, { error: e instanceof Error ? e.message : 'クリーンアップに失敗しました' })
		}
	},
}
