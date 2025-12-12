import type { PageServerLoad } from './$types'
import { getTokensFromCookies, serverClient, setTokensToCookies, withAutoRefresh } from '$lib/api/client'

export const load: PageServerLoad = async (event) => {
	const client = serverClient(event)
	const { refresh_token } = getTokensFromCookies(event.cookies)

	try {
		// ユーザー勤怠サマリー一覧を取得
		const summaryResponse = await withAutoRefresh({
			exec: async () => client.app.admin_get_attendance_summary(),
			refresh: async () => {
				if (!refresh_token)
					throw new Error('no-refresh-token')
				return client.auth.refresh({ refresh_token })
			},
			onRefreshed: (tokens) => setTokensToCookies(event.cookies, tokens),
		})

		return {
			summaries: summaryResponse.summaries || [],
			total: summaryResponse.total || 0,
		}
	} catch (error) {
		console.error('Failed to load attendance summary:', error)
		return {
			summaries: [],
			total: 0,
		}
	}
}
