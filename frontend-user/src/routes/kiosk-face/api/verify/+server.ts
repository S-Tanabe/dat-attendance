import type { RequestHandler } from './$types'
import { getApiBaseURL } from '$lib/api/client'
import { json } from '@sveltejs/kit'
import { z } from 'zod'

const VerifyFaceSchema = z.object({
	descriptor: z.array(z.number()).length(128),
	clock_type: z.enum(['CLOCK_IN', 'CLOCK_OUT']),
	liveness_check: z.boolean().optional(),
})

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body: unknown = await request.json()
		const parsed = VerifyFaceSchema.safeParse(body)

		if (!parsed.success) {
			const firstError = parsed.error.issues[0]
			if (firstError?.path[0] === 'descriptor') {
				return json({ success: false, error: '顔特徴データが不正です' }, { status: 400 })
			}
			return json({ success: false, error: '打刻種別が不正です' }, { status: 400 })
		}

		const { descriptor, clock_type, liveness_check } = parsed.data

		// バックエンドの公開APIを直接呼び出す
		const baseUrl = getApiBaseURL()
		const response = await fetch(`${baseUrl}/public/attendance/face/verify`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				descriptor,
				clock_type,
				liveness_check,
			}),
		})

		const result: unknown = await response.json()

		if (!response.ok) {
			const errorMessage = typeof result === 'object' && result !== null && 'message' in result
				? String((result as { message: unknown }).message)
				: '顔認証に失敗しました'
			return json(
				{ success: false, error: errorMessage },
				{ status: response.status },
			)
		}

		return json(result as Record<string, unknown>)
	} catch (error) {
		const message = error instanceof Error ? error.message : '顔認証に失敗しました'
		return json({ success: false, error: message }, { status: 500 })
	}
}
