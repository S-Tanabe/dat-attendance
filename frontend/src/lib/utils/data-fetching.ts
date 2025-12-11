import { browser } from '$app/environment'
import { invalidate } from '$app/navigation'

/**
 * データフェッチングのベストプラクティスユーティリティ
 */

/**
 * 特定の依存関係のみを無効化する
 *
 * @example
 * // ユーザープロファイルのみ再取得
 * await invalidateSpecific('app:user-profile');
 */
export async function invalidateSpecific(dependency: string | string[]) {
	const deps = Array.isArray(dependency) ? dependency : [dependency]

	for (const dep of deps) {
		await invalidate(dep)
	}
}

/**
 * URLベースの依存関係を無効化
 *
 * @example
 * // 特定のAPIエンドポイントのキャッシュを無効化
 * await invalidateUrl('/api/users');
 */
export async function invalidateUrl(url: string) {
	await invalidate((testUrl) => testUrl.href.includes(url))
}

/**
 * データのキャッシュ管理
 */
export class DataCache<T> {
	private cache = new Map<string, { data: T, timestamp: number }>()

	constructor(private ttl: number = 5 * 60 * 1000) {} // デフォルト5分

	set(key: string, data: T) {
		this.cache.set(key, { data, timestamp: Date.now() })
	}

	get(key: string): T | null {
		const cached = this.cache.get(key)
		if (!cached)
			return null

		if (Date.now() - cached.timestamp > this.ttl) {
			this.cache.delete(key)
			return null
		}

		return cached.data
	}

	clear(key?: string) {
		if (key) {
			this.cache.delete(key)
		} else {
			this.cache.clear()
		}
	}

	isStale(key: string): boolean {
		const cached = this.cache.get(key)
		if (!cached)
			return true

		return Date.now() - cached.timestamp > this.ttl
	}
}

/**
 * 条件付きデータフェッチング
 *
 * @example
 * const data = await fetchWithCache(
 *   'user-profile',
 *   () => client.app.get_profile(),
 *   { ttl: 10 * 60 * 1000 } // 10分
 * );
 */
export async function fetchWithCache<T>(
	key: string,
	fetcher: () => Promise<T>,
	options: {
		ttl?: number
		force?: boolean
		cache?: DataCache<T>
	} = {},
): Promise<T> {
	const cache = options.cache || new DataCache<T>(options.ttl)

	if (!options.force) {
		const cached = cache.get(key)
		if (cached !== null) {
			return cached
		}
	}

	const data = await fetcher()
	cache.set(key, data)

	return data
}

/**
 * デバウンス付きデータ更新
 *
 * @example
 * const updateProfile = createDebouncedUpdate(
 *   async (data) => await client.app.update_profile(data),
 *   500
 * );
 */
export function createDebouncedUpdate<T, R>(
	updater: (data: T) => Promise<R>,
	delay: number = 300,
): (data: T) => Promise<R> {
	let timeoutId: ReturnType<typeof setTimeout> | null = null
	let lastPromise: Promise<R> | null = null

	return async (data: T): Promise<R> => {
		if (timeoutId) {
			clearTimeout(timeoutId)
		}

		lastPromise = new Promise((resolve, reject) => {
			timeoutId = setTimeout(() => {
				updater(data).then(resolve).catch(reject)
			}, delay)
		})

		return lastPromise
	}
}

/**
 * ポーリング処理
 *
 * @example
 * const stop = startPolling(
 *   async () => {
 *     const status = await client.jobs.get_status(jobId);
 *     if (status.completed) stop();
 *   },
 *   5000 // 5秒ごと
 * );
 */
export function startPolling(
	callback: () => Promise<void>,
	interval: number = 5000,
): () => void {
	if (!browser)
		return () => {}

	let stopped = false
	let timeoutId: ReturnType<typeof setTimeout>

	const poll = async () => {
		if (stopped)
			return

		try {
			await callback()
		} catch (error) {
			console.error('Polling error:', error)
		}

		if (!stopped) {
			timeoutId = setTimeout(() => { void poll() }, interval)
		}
	}

	void poll()

	return () => {
		stopped = true
		if (timeoutId) {
			clearTimeout(timeoutId)
		}
	}
}
