import type { RequestHandler } from './$types'
import { getTokensFromCookies, serverClient, setTokensToCookies, withAutoRefresh } from '$lib/api/client'
import { json } from '@sveltejs/kit'
import { z } from 'zod'

export const PUT: RequestHandler = async (event) => {
	const client = serverClient(event)
	const { refresh_token } = getTokensFromCookies(event.cookies)

	try {
		const body: unknown = await event.request.json()
		const Schema = z.object({
			display_name: z.string().min(1),
			first_name: z.string().optional(),
			last_name: z.string().optional(),
			first_name_romaji: z.string().optional(),
			last_name_romaji: z.string().optional(),
		})
		const parsed = Schema.safeParse(body)
		if (!parsed.success)
			return json({ ok: false, error: parsed.error.issues[0]?.message ?? '入力が不正です' }, { status: 400 })
		const updated = await withAutoRefresh({
			exec: async () => client.app.update_profile(parsed.data),
			refresh: async () => {
				if (!refresh_token)
					throw new Error('no-refresh-token')
				return client.auth.refresh({ refresh_token })
			},
			onRefreshed: (t) => setTokensToCookies(event.cookies, t),
		})
		return json({ ok: true, profile: updated })
	} catch (e: unknown) {
		return json({ ok: false, error: e instanceof Error ? e.message : 'プロフィール更新に失敗しました' }, { status: 400 })
	}
}
