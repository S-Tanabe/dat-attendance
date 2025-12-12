import type { RequestHandler } from './$types'
import { getTokensFromCookies, serverClient, setTokensToCookies, withAutoRefresh } from '$lib/api/client'
import { json } from '@sveltejs/kit'
import { z } from 'zod'

const VerifyQRSchema = z.object({
	token: z.string(),
	clock_type: z.enum(['CLOCK_IN', 'CLOCK_OUT']),
})

export const POST: RequestHandler = async (event) => {
	const client = serverClient(event)
	const { refresh_token } = getTokensFromCookies(event.cookies)

	try {
		const body: unknown = await event.request.json()
		const parsed = VerifyQRSchema.safeParse(body)

		if (!parsed.success) {
			const firstError = parsed.error.issues[0]
			if (firstError?.path[0] === 'token') {
				return json({ success: false, error: 'QRトークンが不正です' }, { status: 400 })
			}
			return json({ success: false, error: '打刻種別が不正です' }, { status: 400 })
		}

		const { token, clock_type } = parsed.data

		const result = await withAutoRefresh({
			exec: async () => client.app.admin_verify_qr_token({
				token,
				clock_type,
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
		const message = error instanceof Error ? error.message : 'QRコードの検証に失敗しました'
		return json({ success: false, error: message }, { status: 400 })
	}
}
