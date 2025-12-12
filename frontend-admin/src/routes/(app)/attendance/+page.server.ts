import type { Actions, PageServerLoad } from './$types'
import { getTokensFromCookies, serverClient, setTokensToCookies, withAutoRefresh } from '$lib/api/client'
import { fail } from '@sveltejs/kit'

export const load: PageServerLoad = async (event) => {
	const client = serverClient(event)
	const { refresh_token } = getTokensFromCookies(event.cookies)

	// URLパラメータから取得
	const url = event.url
	const userId = url.searchParams.get('user_id') || undefined
	const now = new Date()

	// デフォルト: 今月の1日から末日まで
	const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1)
	const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0)

	const fromParam = url.searchParams.get('from')
	const toParam = url.searchParams.get('to')
	const typeParam = url.searchParams.get('type') || undefined

	const from = fromParam || formatDate(defaultFrom)
	const to = toParam || formatDate(defaultTo)

	try {
		// ユーザー一覧を取得
		const usersResponse = await withAutoRefresh({
			exec: async () => client.app.list_users({ limit: 1000, page: 1 }),
			refresh: async () => {
				if (!refresh_token)
					throw new Error('no-refresh-token')
				return client.auth.refresh({ refresh_token })
			},
			onRefreshed: (tokens) => setTokensToCookies(event.cookies, tokens),
		})

		// 出退勤データを取得
		const attendanceResponse = await withAutoRefresh({
			exec: async () => client.app.admin_get_attendance({
				user_id: userId,
				from,
				to,
				type: typeParam as 'CLOCK_IN' | 'CLOCK_OUT' | 'ADJUSTMENT' | undefined,
				limit: 500,
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
			users: usersResponse.users || [],
			records: attendanceResponse.records || [],
			total: attendanceResponse.total || 0,
			filters: {
				userId,
				from,
				to,
				type: typeParam,
			},
		}
	} catch (error) {
		console.error('Failed to load attendance data:', error)
		return {
			users: [],
			records: [],
			total: 0,
			filters: {
				userId,
				from,
				to,
				type: typeParam,
			},
		}
	}
}

export const actions: Actions = {
	// 管理者による打刻追加
	adminClock: async (event) => {
		const client = serverClient(event)
		const { refresh_token } = getTokensFromCookies(event.cookies)

		const formData = await event.request.formData()
		const user_id = String(formData.get('user_id') ?? '')
		const type = String(formData.get('type') ?? '') as 'CLOCK_IN' | 'CLOCK_OUT' | 'ADJUSTMENT'
		const timestamp = String(formData.get('timestamp') ?? '')
		const note = String(formData.get('note') ?? '') || undefined

		if (!user_id || !type || !timestamp) {
			return fail(400, { error: 'ユーザー、種別、日時は必須です' })
		}

		try {
			await withAutoRefresh({
				exec: async () => client.app.admin_clock({
					user_id,
					type,
					timestamp,
					note,
				}),
				refresh: async () => {
					if (!refresh_token)
						throw new Error('no-refresh-token')
					return client.auth.refresh({ refresh_token })
				},
				onRefreshed: (tokens) => setTokensToCookies(event.cookies, tokens),
			})

			return { success: true }
		} catch (error) {
			const message = error instanceof Error ? error.message : '打刻の追加に失敗しました'
			return fail(400, { error: message })
		}
	},

	// 打刻の更新
	updateAttendance: async (event) => {
		const client = serverClient(event)
		const { refresh_token } = getTokensFromCookies(event.cookies)

		const formData = await event.request.formData()
		const id = String(formData.get('id') ?? '')
		const timestamp = String(formData.get('timestamp') ?? '') || undefined
		const note = String(formData.get('note') ?? '') || undefined

		if (!id) {
			return fail(400, { error: 'IDは必須です' })
		}

		try {
			await withAutoRefresh({
				exec: async () => client.app.admin_update_attendance(id, {
					timestamp,
					note,
				}),
				refresh: async () => {
					if (!refresh_token)
						throw new Error('no-refresh-token')
					return client.auth.refresh({ refresh_token })
				},
				onRefreshed: (tokens) => setTokensToCookies(event.cookies, tokens),
			})

			return { success: true, action: 'update' }
		} catch (error) {
			const message = error instanceof Error ? error.message : '更新に失敗しました'
			return fail(400, { error: message })
		}
	},
}

function formatDate(date: Date): string {
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	return `${year}-${month}-${day}`
}
