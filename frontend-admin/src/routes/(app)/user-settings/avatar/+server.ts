import type { RequestHandler } from './$types'
import { getTokensFromCookies, serverClient, setTokensToCookies, withAutoRefresh } from '$lib/api/client'
import { json } from '@sveltejs/kit'

export const POST: RequestHandler = async (event) => {
	const client = serverClient(event)
	const { refresh_token } = getTokensFromCookies(event.cookies)
	try {
		const body: unknown = await event.request.json() // { data: base64, contentType }
		if (typeof body !== 'object' || body === null || !('data' in body) || !('contentType' in body)) {
			return json({ ok: false, error: 'Invalid request body' }, { status: 400 })
		}
		const uploadData = body as { data: string, contentType: string }
		const res = await withAutoRefresh({
			exec: async () => client.app.upload_avatar(uploadData),
			refresh: async () => {
				if (!refresh_token)
					throw new Error('no-refresh-token')
				return client.auth.refresh({ refresh_token })
			},
			onRefreshed: (t) => setTokensToCookies(event.cookies, t),
		})
		return json({ ok: true, ...res })
	} catch (e: unknown) {
		return json({ ok: false, error: e instanceof Error ? e.message : 'アバターのアップロードに失敗しました' }, { status: 400 })
	}
}

export const DELETE: RequestHandler = async (event) => {
	const client = serverClient(event)
	const { refresh_token } = getTokensFromCookies(event.cookies)
	try {
		const res = await withAutoRefresh({
			exec: async () => client.app.delete_avatar(),
			refresh: async () => {
				if (!refresh_token)
					throw new Error('no-refresh-token')
				return client.auth.refresh({ refresh_token })
			},
			onRefreshed: (t) => setTokensToCookies(event.cookies, t),
		})
		return json({ ok: true, ...res })
	} catch (e: unknown) {
		return json({ ok: false, error: e instanceof Error ? e.message : 'アバターの削除に失敗しました' }, { status: 400 })
	}
}
