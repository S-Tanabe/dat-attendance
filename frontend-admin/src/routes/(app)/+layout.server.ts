import type { LayoutServerLoad } from './$types'
import { dev } from '$app/environment'
import { getTokensFromCookies, serverClient, setTokensToCookies, withAutoRefresh } from '$lib/api/client'
import { redirect } from '@sveltejs/kit'

export const load: LayoutServerLoad = async (event) => {
	const { depends, locals, isDataRequest } = event
	depends('app:user')
	if (locals.user) {
		return { user: locals.user, isDevelopment: dev }
	}

	const client = serverClient(event)
	const { refresh_token } = getTokensFromCookies(event.cookies)

	async function fetchUser() {
		const profile = await client.app.get_profile()
		locals.user = profile
		return profile
	}

	try {
		const user = await withAutoRefresh({
			exec: fetchUser,
			refresh: async () => {
				if (!refresh_token)
					throw new Error('no-refresh-token')
				return client.auth.refresh({ refresh_token })
			},
			onRefreshed: (tokens) => setTokensToCookies(event.cookies, tokens),
		})
		const roleName = user.role?.name?.toLowerCase()
		const canViewSessions = roleName === 'admin' || roleName === 'super_user'
		if (!isDataRequest && canViewSessions) {
			// 追加ガード: 管理者権限がある場合のみアクティブセッションをチェック
			try {
				const list = await client.app.get_user_sessions(user.id)
				const actives = (list.sessions ?? []).filter((s: unknown): s is { is_active: boolean } => typeof s === 'object' && s !== null && 'is_active' in s && typeof (s as { is_active: unknown }).is_active === 'boolean' && (s as { is_active: boolean }).is_active)
				if (actives.length === 0) {
					const { clearTokens } = await import('$lib/api/client')
					clearTokens(event.cookies)
					throw redirect(302, '/login')
				}
			} catch {
				// 取得失敗時は従来どおり継続（ログのみ残る想定）
			}
		}
		return { user, isDevelopment: dev }
	} catch {
		throw redirect(302, '/login')
	}
}
