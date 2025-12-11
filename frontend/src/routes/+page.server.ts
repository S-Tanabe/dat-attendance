import type { PageServerLoad } from './$types'
import { DEFAULT_APP_PATH } from '$lib/config'
import { redirect } from '@sveltejs/kit'

export const load: PageServerLoad = async () => {
	// ルートアクセス時は既定のアプリパスへ転送
	throw redirect(302, DEFAULT_APP_PATH)
}
