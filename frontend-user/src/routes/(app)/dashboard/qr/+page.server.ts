import type { PageServerLoad } from './$types'
import { getTokensFromCookies, serverClient, setTokensToCookies, withAutoRefresh } from '$lib/api/client'

export const load: PageServerLoad = async (event) => {
	const client = serverClient(event)
	const { refresh_token } = getTokensFromCookies(event.cookies)

	try {
		// 今日の打刻状態を取得
		const todayStatus = await withAutoRefresh({
			exec: async () => client.app.get_today_status(),
			refresh: async () => {
				if (!refresh_token)
					throw new Error('no-refresh-token')
				return client.auth.refresh({ refresh_token })
			},
			onRefreshed: (tokens) => setTokensToCookies(event.cookies, tokens),
		})

		return {
			todayStatus,
		}
	} catch (error) {
		console.error('Failed to load today status:', error)
		return {
			todayStatus: null,
		}
	}
}
