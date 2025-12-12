import type { PageServerLoad } from './$types'
import { getApiBaseURL, getTokensFromCookies } from '$lib/api/client'
import { redirect } from '@sveltejs/kit'

export const load: PageServerLoad = async (event) => {
	const parent = await event.parent()
	const user = parent.user
	if (!user?.role?.name || user.role.name !== 'super_admin') {
		throw redirect(302, '/dashboard')
	}

	const url = event.url
	const hours = Number(url.searchParams.get('hours') ?? '24')
	const { access_token } = getTokensFromCookies(event.cookies)

	const backendBaseUrl = getApiBaseURL().replace(/\/$/, '')

	async function jsonFetch<T>(path: string): Promise<T> {
		const headers = new Headers({ 'content-type': 'application/json' })
		if (access_token) {
			headers.set('Authorization', `Bearer ${access_token}`)
		}

		const res = await fetch(`${backendBaseUrl}${path}`, { headers })
		if (!res.ok)
			throw new Error(`fetch ${path} failed: ${res.status}`)
		return (await res.json()) as T
	}

	let summary: unknown = null; let events: unknown = null; let anomalies: unknown = null; let error: string | undefined
	try { summary = await jsonFetch<unknown>(`/auth/security/ip-trust/summary?hours=${hours}`) } catch (e: unknown) { error = e instanceof Error ? e.message : error }
	try { events = await jsonFetch<unknown>(`/auth/security/ip-trust/events?hours=${hours}`) } catch (e: unknown) { error = e instanceof Error ? e.message : error }
	try { anomalies = await jsonFetch<unknown>(`/auth/security/ip-trust/anomalies?hours=${hours}`) } catch (e: unknown) { error = e instanceof Error ? e.message : error }
	return { summary, events, anomalies, error, hours }
}
