import type { RequestHandler } from './$types'
import { getTokensFromCookies, serverClient, setTokensToCookies, withAutoRefresh } from '$lib/api/client'
import { json } from '@sveltejs/kit'
import { z } from 'zod'

const GenerateQRSchema = z.object({
	clock_type: z.enum(['CLOCK_IN', 'CLOCK_OUT']).optional(),
	ttl_seconds: z.number().optional().default(300),
})

export const POST: RequestHandler = async (event) => {
	const client = serverClient(event)
	const { refresh_token } = getTokensFromCookies(event.cookies)

	try {
		const body: unknown = await event.request.json()
		const parsed = GenerateQRSchema.safeParse(body)

		if (!parsed.success) {
			return json({ error: 'リクエストが不正です' }, { status: 400 })
		}

		const { clock_type, ttl_seconds } = parsed.data

		const result = await withAutoRefresh({
			exec: async () => client.app.generate_qr_token({
				clock_type,
				ttl_seconds,
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
		const message = error instanceof Error ? error.message : 'QRコードの生成に失敗しました'
		return json({ error: message }, { status: 400 })
	}
}
