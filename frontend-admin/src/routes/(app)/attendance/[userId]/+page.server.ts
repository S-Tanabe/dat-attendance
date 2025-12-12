import type { Actions, PageServerLoad } from './$types'
import { getTokensFromCookies, serverClient, setTokensToCookies, withAutoRefresh } from '$lib/api/client'
import { fail } from '@sveltejs/kit'

export const load: PageServerLoad = async (event) => {
	const client = serverClient(event)
	const { refresh_token } = getTokensFromCookies(event.cookies)
	const userId = event.params.userId

	// URLパラメータから年月を取得（デフォルトは今月）
	const url = event.url
	const now = new Date()
	const yearParam = url.searchParams.get('year')
	const monthParam = url.searchParams.get('month')

	const year = yearParam ? Number.parseInt(yearParam) : now.getFullYear()
	const month = monthParam ? Number.parseInt(monthParam) : now.getMonth() + 1

	try {
		// ユーザー勤怠詳細を取得
		const detailResponse = await withAutoRefresh({
			exec: async () => client.app.admin_get_user_attendance_detail(userId, {
				year,
				month,
			}),
			refresh: async () => {
				if (!refresh_token)
					throw new Error('no-refresh-token')
				return client.auth.refresh({ refresh_token })
			},
			onRefreshed: (tokens) => setTokensToCookies(event.cookies, tokens),
		})

		return {
			detail: detailResponse,
			year,
			month,
		}
	} catch (error) {
		console.error('Failed to load user attendance detail:', error)
		return {
			detail: null,
			year,
			month,
			error: 'ユーザーの勤怠詳細を取得できませんでした',
		}
	}
}

export const actions: Actions = {
	// 管理者による打刻追加
	adminClock: async (event) => {
		const client = serverClient(event)
		const { refresh_token } = getTokensFromCookies(event.cookies)
		const userId = event.params.userId

		const formData = await event.request.formData()
		const type = String(formData.get('type') ?? '') as 'CLOCK_IN' | 'CLOCK_OUT' | 'ADJUSTMENT'
		const timestamp = String(formData.get('timestamp') ?? '')
		const note = String(formData.get('note') ?? '') || undefined

		if (!type || !timestamp) {
			return fail(400, { error: '種別、日時は必須です' })
		}

		try {
			await withAutoRefresh({
				exec: async () => client.app.admin_clock({
					user_id: userId,
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

			return { success: true, action: 'add' }
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
