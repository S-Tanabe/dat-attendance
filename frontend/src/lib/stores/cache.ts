import type { Readable } from 'svelte/store'
import { writable } from 'svelte/store'

interface CacheEntry<T> { data: T, at: number }

const cache = new Map<string, CacheEntry<unknown>>()
const inflight = new Map<string, Promise<unknown>>()

export type Fetcher<T> = () => Promise<T>

export interface QueryOptions {
	ttl?: number // ms
}

/**
 * シンプルなクエリキャッシュ（重複取得防止 + TTL）
 */
export function createQuery<T>(key: string, fetcher: Fetcher<T>, opts?: QueryOptions): Readable<{ data: T | null, loading: boolean, error: unknown }> & {
	refetch: (force?: boolean) => Promise<T>
	setData: (updater: (old: T | null) => T) => void
	getSnapshot: () => T | null
	invalidate: () => void
} {
	const ttl = opts?.ttl ?? 30_000
	const state = writable<{ data: T | null, loading: boolean, error: unknown }>({ data: cached<T>(key), loading: !cache.has(key), error: null })

	async function load(force = false): Promise<T> {
		const now = Date.now()
		const c = cache.get(key) as CacheEntry<T> | undefined
		if (!force && c && now - c.at < ttl)
			return c.data
		if (inflight.has(key))
			return inflight.get(key) as Promise<T>
		const p = (async () => {
			state.update((s) => ({ ...s, loading: true, error: null }))
			try {
				const data = await fetcher()
				cache.set(key, { data, at: Date.now() })
				state.set({ data, loading: false, error: null })
				return data
			} catch (e) {
				state.set({ data: c?.data ?? null, loading: false, error: e })
				throw e
			} finally {
				inflight.delete(key)
			}
		})()
		inflight.set(key, p)
		return p
	}

	function invalidate() {
		cache.delete(key)
	}

	function setData(updater: (old: T | null) => T) {
		const next = updater(cached<T>(key))
		cache.set(key, { data: next, at: Date.now() })
		state.set({ data: next, loading: false, error: null })
	}

	function getSnapshot() {
		return cached<T>(key)
	}

	// 初回必要時読み込み
	if (!cache.has(key)) {
		load().catch(() => {})
	}

	const { subscribe } = state
	return { subscribe, refetch: load, setData, getSnapshot, invalidate }
}

function cached<T>(key: string): T | null {
	return (cache.get(key)?.data as T) ?? null
}
