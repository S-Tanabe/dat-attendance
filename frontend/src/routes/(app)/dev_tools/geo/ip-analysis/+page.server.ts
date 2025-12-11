import type { PageServerLoad } from './$types'
import { getTokensFromCookies, serverClient, serverClientWithHeaders, setTokensToCookies, withAutoRefresh } from '$lib/api/client'
import { redirect } from '@sveltejs/kit'

export const load: PageServerLoad = async (event) => {
	const parent = await event.parent()
	const user = parent.user
	if (!user?.role?.name || user.role.name !== 'super_admin') {
		throw redirect(302, '/dashboard')
	}

	const mode = event.url.searchParams.get('mode')
	event.depends(`app:dev_tools:geo:ip_analysis:${mode ?? 'full'}`)

	const url = event.url
	const days_back = Number(url.searchParams.get('days_back') ?? '7')
	const min_sessions = Number(url.searchParams.get('min_sessions') ?? '1')
	const risk_threshold = Number(url.searchParams.get('risk_threshold') ?? '50')

	const client = mode ? serverClientWithHeaders(event, { 'x-dev-geo-mode': String(mode) }) : serverClient(event)
	const { refresh_token } = getTokensFromCookies(event.cookies)

	async function fetchIPAnalysis() {
		const devTools = client.dev_tools as unknown as {
			analyze_ip_addresses?: (params: {
				days_back: number
				min_sessions: number
				risk_threshold: number
			}) => Promise<unknown>
		}

		if (typeof devTools.analyze_ip_addresses !== 'function') {
			throw new TypeError('IP分析APIが利用できません')
		}

		const res = await devTools.analyze_ip_addresses({ days_back, min_sessions, risk_threshold })
		return { res }
	}

	try {
		const data = await withAutoRefresh({
			exec: fetchIPAnalysis,
			refresh: async () => {
				if (!refresh_token)
					throw new Error('no-refresh-token')
				return client.auth.refresh({ refresh_token })
			},
			onRefreshed: (t) => setTokensToCookies(event.cookies, t),
		})
		return { ...data, days_back, min_sessions, risk_threshold }
	} catch (e: unknown) {
		return { res: null, error: e instanceof Error ? e.message : 'IP分析の取得に失敗しました', days_back, min_sessions, risk_threshold }
	}
}
