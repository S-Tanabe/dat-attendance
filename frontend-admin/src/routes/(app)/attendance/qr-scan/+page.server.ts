import type { PageServerLoad } from './$types'
import { getTokensFromCookies, serverClient, setTokensToCookies, withAutoRefresh } from '$lib/api/client'

export const load: PageServerLoad = async (event) => {
	const client = serverClient(event)
	const { refresh_token } = getTokensFromCookies(event.cookies)

	try {
		// 今日の打刻状況を取得（ユーザー一覧など必要に応じて）
		const todayAttendance = await withAutoRefresh({
			exec: async () => client.app.admin_get_attendance({
				from: new Date().toISOString().split('T')[0],
				to: new Date().toISOString().split('T')[0],
				limit: 100,
			}),
			refresh: async () => {
				if (!refresh_token)
					throw new Error('no-refresh-token')
				return client.auth.refresh({ refresh_token })
			},
			onRefreshed: (tokens) => setTokensToCookies(event.cookies, tokens),
		})

		return {
			todayAttendance,
		}
	} catch (error) {
		console.error('Failed to load attendance data:', error)
		return {
			todayAttendance: { records: [], total: 0, from: '', to: '' },
		}
	}
}
