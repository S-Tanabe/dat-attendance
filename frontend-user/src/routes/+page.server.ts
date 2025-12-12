import type { PageServerLoad } from './$types'
import { getTokensFromCookies } from '$lib/api/client'
import { redirect } from '@sveltejs/kit'

export const load: PageServerLoad = async (event) => {
	const { access_token } = getTokensFromCookies(event.cookies)

	if (access_token) {
		// ログイン済みの場合はダッシュボードへリダイレクト
		redirect(302, '/dashboard')
	} else {
		// 未ログインの場合はログインページへリダイレクト
		redirect(302, '/login')
	}
}
