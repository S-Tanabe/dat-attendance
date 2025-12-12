import type { PageServerLoad } from './$types'
import { getTokensFromCookies, serverClient, setTokensToCookies, withAutoRefresh } from '$lib/api/client'

export const load: PageServerLoad = async (event) => {
	const client = serverClient(event)
	const { refresh_token } = getTokensFromCookies(event.cookies)

	try {
		const profile = await withAutoRefresh({
			exec: async () => client.app.get_profile(),
			refresh: async () => {
				if (!refresh_token)
					throw new Error('no-refresh-token')
				return client.auth.refresh({ refresh_token })
			},
			onRefreshed: (t) => setTokensToCookies(event.cookies, t),
		})
		return { profile }
	} catch (e: unknown) {
		return { profile: null, error: e instanceof Error ? e.message : 'プロフィール取得に失敗しました' }
	}
}
