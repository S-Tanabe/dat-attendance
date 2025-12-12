import type { Actions, PageServerLoad } from './$types'
import { getTokensFromCookies, serverClient, setTokensToCookies, withAutoRefresh } from '$lib/api/client'
import { fail } from '@sveltejs/kit'

export const load: PageServerLoad = async (event) => {
	const client = serverClient(event)
	const { refresh_token } = getTokensFromCookies(event.cookies)

	// 過去7日分の日付範囲を計算
	const today = new Date()
	const sevenDaysAgo = new Date(today)
	sevenDaysAgo.setDate(today.getDate() - 7)

	const formatDate = (date: Date) => {
		const year = date.getFullYear()
		const month = String(date.getMonth() + 1).padStart(2, '0')
		const day = String(date.getDate()).padStart(2, '0')
		return `${year}-${month}-${day}`
	}

	try {
		// 今日の打刻状態と直近の履歴を並列取得
		const [todayStatus, recentAttendance] = await Promise.all([
			withAutoRefresh({
				exec: async () => client.app.get_today_status(),
				refresh: async () => {
					if (!refresh_token)
						throw new Error('no-refresh-token')
					return client.auth.refresh({ refresh_token })
				},
				onRefreshed: (tokens) => setTokensToCookies(event.cookies, tokens),
			}),
			withAutoRefresh({
				exec: async () => client.app.get_my_attendance({
					from: formatDate(sevenDaysAgo),
					to: formatDate(today),
					limit: 10,
					offset: 0,
				}),
				refresh: async () => {
					if (!refresh_token)
						throw new Error('no-refresh-token')
					return client.auth.refresh({ refresh_token })
				},
				onRefreshed: (tokens) => setTokensToCookies(event.cookies, tokens),
			}),
		])

		return {
			todayStatus,
			recentRecords: recentAttendance.records || [],
		}
	} catch (error) {
		console.error('Failed to load dashboard data:', error)
		return {
			todayStatus: null,
			recentRecords: [],
		}
	}
}

export const actions: Actions = {
	clockIn: async (event) => {
		const client = serverClient(event)
		const { refresh_token } = getTokensFromCookies(event.cookies)

		try {
			const result = await withAutoRefresh({
				exec: async () => client.app.clock_in({
					clock_method_code: 'button',
				}),
				refresh: async () => {
					if (!refresh_token)
						throw new Error('no-refresh-token')
					return client.auth.refresh({ refresh_token })
				},
				onRefreshed: (tokens) => setTokensToCookies(event.cookies, tokens),
			})

			return { success: true, data: result }
		} catch (error) {
			const message = error instanceof Error ? error.message : '出勤打刻に失敗しました'
			return fail(400, { error: message })
		}
	},

	clockOut: async (event) => {
		const client = serverClient(event)
		const { refresh_token } = getTokensFromCookies(event.cookies)

		try {
			const result = await withAutoRefresh({
				exec: async () => client.app.clock_out({
					clock_method_code: 'button',
				}),
				refresh: async () => {
					if (!refresh_token)
						throw new Error('no-refresh-token')
					return client.auth.refresh({ refresh_token })
				},
				onRefreshed: (tokens) => setTokensToCookies(event.cookies, tokens),
			})

			return { success: true, data: result }
		} catch (error) {
			const message = error instanceof Error ? error.message : '退勤打刻に失敗しました'
			return fail(400, { error: message })
		}
	},
}
