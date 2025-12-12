import type { Actions, PageServerLoad } from './$types'
import { getTokensFromCookies, serverClient, setTokensToCookies, withAutoRefresh } from '$lib/api/client'
import { fail } from '@sveltejs/kit'

export const load: PageServerLoad = async (event) => {
	const client = serverClient(event)
	const { refresh_token } = getTokensFromCookies(event.cookies)

	try {
		// プロフィールと顔データ登録状態を並列取得
		const [profile, faceStatus] = await Promise.all([
			withAutoRefresh({
				exec: async () => client.app.get_profile(),
				refresh: async () => {
					if (!refresh_token)
						throw new Error('no-refresh-token')
					return client.auth.refresh({ refresh_token })
				},
				onRefreshed: (tokens) => setTokensToCookies(event.cookies, tokens),
			}),
			withAutoRefresh({
				exec: async () => client.app.get_face_status(),
				refresh: async () => {
					if (!refresh_token)
						throw new Error('no-refresh-token')
					return client.auth.refresh({ refresh_token })
				},
				onRefreshed: (tokens) => setTokensToCookies(event.cookies, tokens),
			}),
		])

		return {
			profile,
			faceStatus,
		}
	} catch (error) {
		console.error('Failed to load settings data:', error)
		return {
			profile: null,
			faceStatus: null,
		}
	}
}

export const actions: Actions = {
	updateProfile: async (event) => {
		const client = serverClient(event)
		const { refresh_token } = getTokensFromCookies(event.cookies)

		const formData = await event.request.formData()
		const display_name = String(formData.get('display_name') ?? '') || undefined
		const first_name = String(formData.get('first_name') ?? '') || undefined
		const last_name = String(formData.get('last_name') ?? '') || undefined

		try {
			await withAutoRefresh({
				exec: async () => client.app.update_profile({
					display_name,
					first_name,
					last_name,
				}),
				refresh: async () => {
					if (!refresh_token)
						throw new Error('no-refresh-token')
					return client.auth.refresh({ refresh_token })
				},
				onRefreshed: (tokens) => setTokensToCookies(event.cookies, tokens),
			})

			return { success: true, action: 'updateProfile' }
		} catch (error) {
			const message = error instanceof Error ? error.message : 'プロフィールの更新に失敗しました'
			return fail(400, { error: message })
		}
	},

	changePassword: async (event) => {
		const client = serverClient(event)
		const { refresh_token } = getTokensFromCookies(event.cookies)

		const formData = await event.request.formData()
		const current_password = String(formData.get('current_password') ?? '')
		const new_password = String(formData.get('new_password') ?? '')
		const confirm_password = String(formData.get('confirm_password') ?? '')

		if (!current_password || !new_password) {
			return fail(400, { error: '現在のパスワードと新しいパスワードを入力してください' })
		}

		if (new_password.length < 8) {
			return fail(400, { error: '新しいパスワードは8文字以上にしてください' })
		}

		if (new_password !== confirm_password) {
			return fail(400, { error: '新しいパスワードと確認用パスワードが一致しません' })
		}

		try {
			await withAutoRefresh({
				exec: async () => client.app.change_password({
					current_password,
					new_password,
				}),
				refresh: async () => {
					if (!refresh_token)
						throw new Error('no-refresh-token')
					return client.auth.refresh({ refresh_token })
				},
				onRefreshed: (tokens) => setTokensToCookies(event.cookies, tokens),
			})

			return { success: true, action: 'changePassword' }
		} catch (error) {
			const message = error instanceof Error ? error.message : 'パスワードの変更に失敗しました'
			return fail(400, { error: message })
		}
	},
}
