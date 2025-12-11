import type { Actions, PageServerLoad } from './$types'
import { browserClient, getTokensFromCookies, serverClientWithForwardedHeaders, setTokensToCookies } from '$lib/api/client'
import { DEFAULT_APP_PATH } from '$lib/config'
import { fail, redirect } from '@sveltejs/kit'

export const load: PageServerLoad = async (event) => {
	const sessionExpired = event.url.searchParams.get('reason') === 'session_expired'
	// 既にログイン済みならダッシュボードへ
	const { access_token } = getTokensFromCookies(event.cookies)
	if (access_token) {
		try {
			const client = browserClient(access_token)
			await client.auth.me()
			throw redirect(302, '/dashboard')
		} catch {}
	}
	return { sessionExpired }
}

export const actions: Actions = {
	default: async (event) => {
		const form = await event.request.formData()
		const email = String(form.get('email') ?? '')
		const password = String(form.get('password') ?? '')
		const device_fingerprint = String(form.get('device_fingerprint') ?? '')
		const ua_brands_raw = String(form.get('ua_brands') ?? '')
		const remember_device = String(form.get('remember_device') ?? 'true') === 'true'

		if (!email || !password) {
			return fail(400, { error: 'メールアドレスとパスワードを入力してください。' })
		}

		// Redirect を catch しないように、認証部分のみ try/catch に限定
		let tokens: Awaited<ReturnType<ReturnType<typeof browserClient>['auth']['login']>> | null = null
		try {
			// UA/IPを取得し、JSONボディにも明示的に渡す（Backendで優先採用）
			const client = serverClientWithForwardedHeaders(event)
			const client_ip = event.getClientAddress()
			const client_user_agent = event.request.headers.get('user-agent') || undefined
			tokens = await client.auth.login({
				email,
				password,
				device_name: 'web',
				remember_device,
				device_fingerprint: device_fingerprint || undefined,
				// Backend側のLoginParamsに追加した開発用フィールド
				client_ip,
				client_user_agent,
				client_ua_brands: ua_brands_raw ? (JSON.parse(ua_brands_raw) as unknown) : undefined,
			} as Parameters<ReturnType<typeof browserClient>['auth']['login']>[0])
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : 'ログインに失敗しました。'
			return fail(401, { error: message })
		}

		setTokensToCookies(event.cookies, tokens)
		throw redirect(302, DEFAULT_APP_PATH)
	},
}
