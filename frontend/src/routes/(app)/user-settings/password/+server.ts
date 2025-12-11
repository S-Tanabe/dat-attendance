import type { RequestHandler } from './$types'
import { getTokensFromCookies, serverClient, setTokensToCookies, withAutoRefresh } from '$lib/api/client'
import { json } from '@sveltejs/kit'
import { z } from 'zod'

export const POST: RequestHandler = async (event) => {
	const client = serverClient(event)
	const { refresh_token } = getTokensFromCookies(event.cookies)

	try {
		const body: unknown = await event.request.json()
		const Schema = z.object({ current_password: z.string().min(1), new_password: z.string().min(8) })
		const parsed = Schema.safeParse(body)
		if (!parsed.success)
			return json({ ok: false, error: parsed.error.issues[0]?.message ?? '入力が不正です' }, { status: 400 })
		const res = await withAutoRefresh({
			exec: async () => client.app.change_password({ current_password: parsed.data.current_password, new_password: parsed.data.new_password }),
			refresh: async () => {
				if (!refresh_token)
					throw new Error('no-refresh-token')
				return client.auth.refresh({ refresh_token })
			},
			onRefreshed: (t) => setTokensToCookies(event.cookies, t),
		})
		return json({ ok: true, ...res })
	} catch (e: unknown) {
		return json({ ok: false, error: e instanceof Error ? e.message : 'パスワード変更に失敗しました' }, { status: 400 })
	}
}
