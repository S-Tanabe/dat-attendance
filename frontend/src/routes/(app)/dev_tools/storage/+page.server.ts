import type { RequestEvent } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import type { DeleteObjectsResponse, ListObjectsResponse, SignedUrlResponse, StorageBucketSummary } from './api'
import { getTokensFromCookies, serverClient, setTokensToCookies, withAutoRefresh } from '$lib/api/client'
import { fail, redirect } from '@sveltejs/kit'
import {
	createPrefix,
	deleteObjects,
	fetchBuckets,
	fetchObjects,
	requestDownloadUrl,
	requestUploadUrl,

} from './api'

// Ensure SSR handling remains enabled while preventing static prerendering
export const ssr = true
export const prerender = false

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

export const load: PageServerLoad = async (event) => {
	const parent = await event.parent()
	const user = parent.user
	if (!user?.role?.name) {
		throw redirect(302, '/dashboard')
	}

	event.depends('app:dev_tools:storage')
	const requestEvent = event as unknown as RequestEvent

	let buckets: StorageBucketSummary[] = []
	let selectedBucketId: string | null = null
	let objectsResponse: ListObjectsResponse | null = null
	let error: string | null = null

	try {
		buckets = await callWithRefresh(requestEvent, async (client) => fetchBuckets(client))
	} catch (e: unknown) {
		error = e instanceof Error ? e.message : 'バケット一覧の取得に失敗しました'
	}

	if (buckets.length === 0) {
		return {
			buckets,
			selectedBucketId,
			objects: null,
			prefix: '',
			error: error ?? '利用可能なバケットがありません',
		}
	}

	const queryBucket = event.url.searchParams.get('bucket')
	const prefix = event.url.searchParams.get('prefix') ?? ''

	selectedBucketId = buckets.some((b) => b.id === queryBucket) ? queryBucket : buckets[0].id

	if (selectedBucketId) {
		try {
			objectsResponse = await callWithRefresh(requestEvent, async (client) =>
				fetchObjects(client, { bucketId: selectedBucketId, prefix: prefix || undefined }))
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : 'ファイル一覧の取得に失敗しました'
		}
	}

	return {
		buckets,
		selectedBucketId,
		objects: objectsResponse,
		prefix: prefix ?? '',
		error,
	}
}

export const actions: Actions = {
	delete: async (event) => {
		const formData = await event.request.formData()
		const bucketId = formData.get('bucketId')
		const keys = formData
			.getAll('keys')
			.map((value) => (typeof value === 'string' ? value : String(value)))
			.filter((key) => key.trim().length > 0)
		const uniqueKeys = Array.from(new Set(keys))

		if (typeof bucketId !== 'string' || uniqueKeys.length === 0) {
			return fail(400, { error: '削除対象が指定されていません' })
		}

		try {
			const result: DeleteObjectsResponse = await callWithRefresh(event, async (client) =>
				deleteObjects(client, { bucketId, keys: uniqueKeys }))
			if (result.failed.length > 0) {
				return fail(400, { error: '一部の削除に失敗しました', result })
			}
			return { success: true, result, action: 'delete' as const }
		} catch (e: unknown) {
			return fail(500, { error: e instanceof Error ? e.message : 'オブジェクトの削除に失敗しました' })
		}
	},
	folder: async (event) => {
		const formData = await event.request.formData()
		const bucketId = formData.get('bucketId')
		const prefix = formData.get('prefix')

		if (typeof bucketId !== 'string' || typeof prefix !== 'string' || prefix.trim() === '') {
			return fail(400, { error: 'フォルダ名を入力してください' })
		}

		try {
			await callWithRefresh(event, async (client) => createPrefix(client, { bucketId, prefix }))
			return { success: true, action: 'folder' as const }
		} catch (e: unknown) {
			return fail(500, { error: e instanceof Error ? e.message : 'フォルダの作成に失敗しました' })
		}
	},
	download: async (event) => {
		const formData = await event.request.formData()
		const bucketId = formData.get('bucketId')
		const key = formData.get('key')

		if (typeof bucketId !== 'string' || typeof key !== 'string') {
			return fail(400, { error: 'ダウンロード対象が不正です' })
		}

		try {
			const url: SignedUrlResponse = await callWithRefresh(event, async (client) =>
				requestDownloadUrl(client, { bucketId, key }))
			return { success: true, url, action: 'download' as const }
		} catch (e: unknown) {
			return fail(500, { error: e instanceof Error ? e.message : 'ダウンロードURLの生成に失敗しました' })
		}
	},
	upload: async (event) => {
		const formData = await event.request.formData()
		const bucketId = formData.get('bucketId')
		const key = formData.get('key')
		const contentType = formData.get('contentType')

		if (typeof bucketId !== 'string' || typeof key !== 'string') {
			return fail(400, { error: 'アップロード対象が不正です' })
		}

		try {
			const url: SignedUrlResponse = await callWithRefresh(event, async (client) =>
				requestUploadUrl(client, {
					bucketId,
					key,
					contentType: typeof contentType === 'string' ? contentType : undefined,
				}))
			return { success: true, url, action: 'upload' as const }
		} catch (e: unknown) {
			return fail(500, { error: e instanceof Error ? e.message : 'アップロードURLの生成に失敗しました' })
		}
	},
}
