import type { PageServerLoad } from './$types'
import { getTokensFromCookies, serverClient, setTokensToCookies, withAutoRefresh } from '$lib/api/client'

export const load: PageServerLoad = async (event) => {
	const client = serverClient(event)
	const { refresh_token } = getTokensFromCookies(event.cookies)

	// URLパラメータから期間を取得（デフォルトは今月）
	const url = event.url
	const now = new Date()

	// デフォルト: 今月の1日から末日まで
	const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1)
	const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0)

	const fromParam = url.searchParams.get('from')
	const toParam = url.searchParams.get('to')

	const from = fromParam || formatDate(defaultFrom)
	const to = toParam || formatDate(defaultTo)

	try {
		const response = await withAutoRefresh({
			exec: async () => client.app.get_my_attendance({
				from,
				to,
				limit: 100,
				offset: 0,
			}),
			refresh: async () => {
				if (!refresh_token)
					throw new Error('no-refresh-token')
				return client.auth.refresh({ refresh_token })
			},
			onRefreshed: (tokens) => setTokensToCookies(event.cookies, tokens),
		})

		return {
			records: response.records || [],
			total: response.total || 0,
			from,
			to,
		}
	} catch (error) {
		console.error('Failed to load attendance history:', error)
		return {
			records: [],
			total: 0,
			from,
			to,
		}
	}
}

function formatDate(date: Date): string {
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	return `${year}-${month}-${day}`
}
