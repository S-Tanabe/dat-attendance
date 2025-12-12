import type { RequestHandler } from './$types'
import { getTokensFromCookies, serverClient, setTokensToCookies, withAutoRefresh } from '$lib/api/client'
import { json } from '@sveltejs/kit'
import { z } from 'zod'

const VerifyFaceSchema = z.object({
	descriptor: z.array(z.number()),
	clock_type: z.enum(['CLOCK_IN', 'CLOCK_OUT']),
	liveness_check: z.boolean().optional().default(false),
})

export const POST: RequestHandler = async (event) => {
	const client = serverClient(event)
	const { refresh_token } = getTokensFromCookies(event.cookies)

	try {
		const body: unknown = await event.request.json()
		const parsed = VerifyFaceSchema.safeParse(body)

		if (!parsed.success) {
			const firstError = parsed.error.issues[0]
			if (firstError?.path[0] === 'clock_type') {
				return json({ error: '打刻種別が不正です', success: false }, { status: 400 })
			}
			return json({ error: '顔特徴データが不正です', success: false }, { status: 400 })
		}

		const { descriptor, clock_type, liveness_check } = parsed.data

		const result = await withAutoRefresh({
			exec: async () => client.app.verify_face_and_clock({
				descriptor,
				clock_type,
				liveness_check,
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
		const message = error instanceof Error ? error.message : '顔認証に失敗しました'
		return json({ error: message, success: false }, { status: 400 })
	}
}
