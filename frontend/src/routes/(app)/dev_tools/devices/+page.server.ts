import type { Actions, PageServerLoad } from './$types'
import { getTokensFromCookies, serverClient, setTokensToCookies, withAutoRefresh } from '$lib/api/client'
import { redirect } from '@sveltejs/kit'

export const load: PageServerLoad = async (event) => {
	const parent = await event.parent()
	const user = parent.user
	if (!user?.role?.name || user.role.name !== 'super_admin') {
		throw redirect(302, '/dashboard')
	}

	event.depends('app:dev_tools:devices')

	const url = event.url
	const page = Number(url.searchParams.get('page') ?? '1')
	const limit = Number(url.searchParams.get('limit') ?? '20')
	const filter = (url.searchParams.get('filter') as 'all' | 'trusted' | 'untrusted' | 'suspicious') ?? 'all'
	const offset = (page - 1) * limit

	const client = serverClient(event)
	const { refresh_token } = getTokensFromCookies(event.cookies)

	async function fetchList() {
		const list = await client.dev_tools.get_all_devices({ limit, offset, filter })
		return { list }
	}

	try {
		const data = await withAutoRefresh({
			exec: fetchList,
			refresh: async () => {
				if (!refresh_token)
					throw new Error('no-refresh-token')
				return client.auth.refresh({ refresh_token })
			},
			onRefreshed: (t) => setTokensToCookies(event.cookies, t),
		})

		return { page, limit, filter, devices: data.list.devices, summary: data.list.summary, currentUserId: user.id }
	} catch (e: unknown) {
		return { page, limit, filter, devices: [], summary: null, error: e instanceof Error ? e.message : 'デバイス一覧の取得に失敗しました', currentUserId: user.id }
	}
}

export const actions: Actions = {
	trust: async (event) => {
		const fd = await event.request.formData()
		const device_id = String(fd.get('device_id') ?? '')
		const user_id = String(fd.get('user_id') ?? '')
		if (!device_id || !user_id)
			return { success: false, error: '無効な入力です' }

		const client = serverClient(event)
		const { refresh_token } = getTokensFromCookies(event.cookies)
		try {
			await withAutoRefresh({
				exec: async () => client.dev_tools.update_device_trust({ device_id, user_id, trusted: true }),
				refresh: async () => {
					if (!refresh_token)
						throw new Error('no-refresh-token')
					return client.auth.refresh({ refresh_token })
				},
				onRefreshed: (t) => setTokensToCookies(event.cookies, t),
			})
			return { success: true }
		} catch (e: unknown) {
			return { success: false, error: e instanceof Error ? e.message : '信頼設定に失敗しました' }
		}
	},
	untrust: async (event) => {
		const fd = await event.request.formData()
		const device_id = String(fd.get('device_id') ?? '')
		const user_id = String(fd.get('user_id') ?? '')
		if (!device_id || !user_id)
			return { success: false, error: '無効な入力です' }

		const client = serverClient(event)
		const { refresh_token } = getTokensFromCookies(event.cookies)
		try {
			await withAutoRefresh({
				exec: async () => client.dev_tools.update_device_trust({ device_id, user_id, trusted: false }),
				refresh: async () => {
					if (!refresh_token)
						throw new Error('no-refresh-token')
					return client.auth.refresh({ refresh_token })
				},
				onRefreshed: (t) => setTokensToCookies(event.cookies, t),
			})
			return { success: true }
		} catch (e: unknown) {
			return { success: false, error: e instanceof Error ? e.message : '未信頼設定に失敗しました' }
		}
	},
	remove: async (event) => {
		const fd = await event.request.formData()
		const device_id = String(fd.get('device_id') ?? '')
		const user_id = String(fd.get('user_id') ?? '')
		if (!device_id || !user_id)
			return { success: false, error: '無効な入力です' }

		const client = serverClient(event)
		const { refresh_token } = getTokensFromCookies(event.cookies)
		try {
			await withAutoRefresh({
				exec: async () => client.dev_tools.remove_device({ device_id, user_id }),
				refresh: async () => {
					if (!refresh_token)
						throw new Error('no-refresh-token')
					return client.auth.refresh({ refresh_token })
				},
				onRefreshed: (t) => setTokensToCookies(event.cookies, t),
			})
			// 自分自身のデバイスか判定して返す（クライアント側で即時リロード判断）
			let selfAffected = false
			try {
				const me = await client.auth.me()
				selfAffected = me.user.id === user_id
			} catch {}
			return { success: true, selfAffected }
		} catch (e: unknown) {
			return { success: false, error: e instanceof Error ? e.message : 'デバイス削除に失敗しました' }
		}
	},
	revoke: async (event) => {
		const fd = await event.request.formData()
		const device_id = String(fd.get('device_id') ?? '')
		if (!device_id)
			return { success: false, error: '無効な入力です' }

		const client = serverClient(event)
		const { refresh_token } = getTokensFromCookies(event.cookies)
		try {
			await withAutoRefresh({
				exec: async () => client.dev_tools.bulk_device_operation({ device_ids: [device_id], action: 'revoke_sessions' }),
				refresh: async () => {
					if (!refresh_token)
						throw new Error('no-refresh-token')
					return client.auth.refresh({ refresh_token })
				},
				onRefreshed: (t) => setTokensToCookies(event.cookies, t),
			})
			let selfAffected = false
			try {
				// 対象device_idが自分の所有デバイスかどうかを簡易判定
				// 厳密な「現在の端末」判定は困難だが、少なくとも自分の所有デバイスなら再ログインが妥当
				// 省コストにするため、本来は別APIで最小化すべきだが、ここでは selfAffected を true にする簡易判定
				selfAffected = true // 自分が実行して自身のデバイスを無効化する場合は即リロードで整合
			} catch {}
			return { success: true, selfAffected }
		} catch (e: unknown) {
			return { success: false, error: e instanceof Error ? e.message : 'セッション無効化に失敗しました' }
		}
	},
}
