import type { RequestEvent } from '@sveltejs/kit'
import { getTokensFromCookies, serverClient, setTokensToCookies, withAutoRefresh } from '$lib/api/client'
import { json } from '@sveltejs/kit'
import { fetchObjects } from '../../api'

async function callWithRefresh<T>(
	event: RequestEvent,
	exec: (client: ReturnType<typeof serverClient>) => Promise<T>,
): Promise<T> {
	const client = serverClient(event)
	const { refresh_token } = getTokensFromCookies(event.cookies)
	return withAutoRefresh({
		exec: async () => exec(client),
		refresh: async () => {
			if (!refresh_token) {
				throw new Error('no-refresh-token')
			}
			return client.auth.refresh({ refresh_token })
		},
		onRefreshed: (tokens) => setTokensToCookies(event.cookies, tokens),
	})
}

export async function GET(event: RequestEvent) {
	const bucketId = event.url.searchParams.get('bucket')
	const prefix = event.url.searchParams.get('prefix')

	if (!bucketId) {
		return json({ error: 'Bucket ID is required' }, { status: 400 })
	}

	try {
		const objects = await callWithRefresh(event, async (client) =>
			fetchObjects(client, { bucketId, prefix: prefix || undefined }))
		return json(objects)
	} catch (error: unknown) {
		return json({ error: error instanceof Error ? error.message : 'Failed to fetch objects' }, { status: 500 })
	}
}
