import type { RequestHandler } from './$types'
import { getTokensFromCookies, serverClient, setTokensToCookies, withAutoRefresh } from '$lib/api/client'
import { json } from '@sveltejs/kit'
import { z } from 'zod'

const RegisterFaceSchema = z.object({
	descriptor: z.array(z.number()),
	label: z.string().optional(),
})

export const POST: RequestHandler = async (event) => {
	const client = serverClient(event)
	const { refresh_token } = getTokensFromCookies(event.cookies)

	try {
		const body: unknown = await event.request.json()
		const parsed = RegisterFaceSchema.safeParse(body)

		if (!parsed.success) {
			return json({ error: '顔特徴データが不正です' }, { status: 400 })
		}

		const { descriptor, label } = parsed.data

		const result = await withAutoRefresh({
			exec: async () => client.app.register_face({
				descriptor,
				label,
			}),
			refresh: async () => {
				if (!refresh_token)
					throw new Error('no-refresh-token')
				return client.auth.refresh({ refresh_token })
			},
			onRefreshed: (tokens) => setTokensToCookies(event.cookies, tokens),
		})

		return json(result)
	} catch (error) {
		const message = error instanceof Error ? error.message : '顔データの登録に失敗しました'
		return json({ error: message }, { status: 400 })
	}
}
