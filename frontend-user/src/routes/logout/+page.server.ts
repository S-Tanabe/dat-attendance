import type { PageServerLoad } from './$types'
import { clearTokens } from '$lib/api/client'
import { redirect } from '@sveltejs/kit'

export const load: PageServerLoad = async (event) => {
	clearTokens(event.cookies)
	redirect(302, '/login')
}
