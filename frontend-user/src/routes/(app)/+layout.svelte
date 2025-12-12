<script lang='ts'>
	import { browser } from '$app/environment'
	import { goto } from '$app/navigation'
	import { page } from '$app/stores'
	import { clearSentryUser, setSentryUser } from '$lib/monitoring/sentry'

	interface UserProfile {
		id: string
		email: string
		display_name?: string | null
	}

	const { data, children } = $props<{
		data: { user: UserProfile | null, isDevelopment: boolean }
		children: import('svelte').Snippet
	}>()

	let userData = $state(data.user)

	// データが更新されたら userData を更新 + Sentryユーザーコンテキストを更新
	$effect(() => {
		userData = data.user
		if (userData && browser) {
			setSentryUser(
				userData.id,
				userData.email,
				userData.display_name || undefined,
			)
		}
	})

	async function handleLogout() {
		clearSentryUser()
		await goto('/logout')
	}

	// 現在のパスを取得
	const currentPath = $derived($page.url.pathname)

	// ナビゲーションアイテム
	const navItems = [
		{ href: '/dashboard', label: '打刻', icon: 'clock' },
		{ href: '/history', label: '履歴', icon: 'calendar' },
		{ href: '/settings', label: '設定', icon: 'cog' },
	]

	// アクティブ判定
	function isActive(href: string): boolean {
		return currentPath === href || currentPath.startsWith(`${href}/`)
	}
</script>

<div class='min-h-screen flex flex-col bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800'>
	<!-- ヘッダー（シンプル） -->
	<header class='bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 sticky top-0 z-50'>
		<div class='flex items-center justify-between max-w-lg mx-auto'>
			<div class='flex items-center gap-2'>
				<div class='w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center'>
					<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5 text-white' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
						<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' />
					</svg>
				</div>
				<span class='font-semibold text-slate-800 dark:text-slate-100'>DAT勤怠</span>
			</div>

			<!-- ユーザーメニュー -->
			<div class='dropdown dropdown-end'>
				<button class='flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors'>
					<div class='w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center'>
						<span class='text-sm font-medium text-white'>
							{userData?.display_name?.charAt(0) || userData?.email?.charAt(0) || '?'}
						</span>
					</div>
					<span class='text-sm text-slate-600 dark:text-slate-300 hidden sm:inline max-w-24 truncate'>
						{userData?.display_name || userData?.email?.split('@')[0] || ''}
					</span>
					<svg xmlns='http://www.w3.org/2000/svg' class='h-4 w-4 text-slate-400' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
						<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7' />
					</svg>
				</button>
				<ul class='dropdown-content menu bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 mt-2 w-56 p-2 z-[100]'>
					<li class='px-3 py-2 border-b border-slate-100 dark:border-slate-700'>
						<div class='flex flex-col'>
							<span class='text-sm font-medium text-slate-800 dark:text-slate-100'>
								{userData?.display_name || 'ユーザー'}
							</span>
							<span class='text-xs text-slate-500 dark:text-slate-400 truncate'>
								{userData?.email || ''}
							</span>
						</div>
					</li>
					<li>
						<button onclick={handleLogout} class='text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg mt-1'>
							<svg xmlns='http://www.w3.org/2000/svg' class='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
								<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1' />
							</svg>
							ログアウト
						</button>
					</li>
				</ul>
			</div>
		</div>
	</header>

	<!-- メインコンテンツ -->
	<main class='flex-1 pb-20'>
		<div class='max-w-lg mx-auto px-4 py-6'>
			{@render children()}
		</div>
	</main>

	<!-- ボトムナビゲーション -->
	<nav class='fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 px-4 py-2 z-50'>
		<div class='max-w-lg mx-auto flex justify-around'>
			{#each navItems as item}
				<a
					href={item.href}
					class='flex flex-col items-center gap-1 px-6 py-2 rounded-xl transition-all duration-200 {isActive(item.href) ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400'}'
				>
					{#if item.icon === 'clock'}
						<svg xmlns='http://www.w3.org/2000/svg' class='h-6 w-6' fill='none' viewBox='0 0 24 24' stroke='currentColor' stroke-width={isActive(item.href) ? 2.5 : 2}>
							<path stroke-linecap='round' stroke-linejoin='round' d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' />
						</svg>
					{:else if item.icon === 'calendar'}
						<svg xmlns='http://www.w3.org/2000/svg' class='h-6 w-6' fill='none' viewBox='0 0 24 24' stroke='currentColor' stroke-width={isActive(item.href) ? 2.5 : 2}>
							<path stroke-linecap='round' stroke-linejoin='round' d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' />
						</svg>
					{:else if item.icon === 'cog'}
						<svg xmlns='http://www.w3.org/2000/svg' class='h-6 w-6' fill='none' viewBox='0 0 24 24' stroke='currentColor' stroke-width={isActive(item.href) ? 2.5 : 2}>
							<path stroke-linecap='round' stroke-linejoin='round' d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' />
							<path stroke-linecap='round' stroke-linejoin='round' d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
						</svg>
					{/if}
					<span class='text-xs font-medium'>{item.label}</span>
				</a>
			{/each}
		</div>
	</nav>
</div>
