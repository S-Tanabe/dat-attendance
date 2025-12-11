// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { users } from '$lib/generated/client'

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user?: users.UserProfile
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	/**
	 * アプリケーションバージョン
	 * vite.config.tsでpackage.jsonから注入される
	 */
	const __APP_VERSION__: string
}

export {}
