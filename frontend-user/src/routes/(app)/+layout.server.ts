import type { LayoutServerLoad } from './$types'
import { dev } from '$app/environment'
import { getTokensFromCookies, serverClient, setTokensToCookies, withAutoRefresh } from '$lib/api/client'
import { redirect } from '@sveltejs/kit'

export const load: LayoutServerLoad = async (event) => {
	const { depends, locals } = event
	depends('app:user')
	if (locals.user) {
		return { user: locals.user, isDevelopment: dev }
	}

	const client = serverClient(event)
	const { refresh_token } = getTokensFromCookies(event.cookies)

	async function fetchUser() {
		const profile = await client.app.get_profile()
		locals.user = profile
		return profile
	}

	try {
		const user = await withAutoRefresh({
			exec: fetchUser,
			refresh: async () => {
				if (!refresh_token)
					throw new Error('no-refresh-token')
				return client.auth.refresh({ refresh_token })
			},
			onRefreshed: (tokens) => setTokensToCookies(event.cookies, tokens),
		})
		return { user, isDevelopment: dev }
	} catch {
		redirect(302, '/login')
	}
}
