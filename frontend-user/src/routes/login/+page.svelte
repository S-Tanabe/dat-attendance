<script lang='ts'>
	import { enhance } from '$app/forms'
	import { goto } from '$app/navigation'
	import { DEFAULT_APP_PATH } from '$lib/config'
	import { onMount } from 'svelte'

	const props = $props<{ form: unknown, sessionExpired?: boolean }>()
	const form = $derived(props.form)
	const sessionExpired = $derived(Boolean(props.sessionExpired))

	let isLoading = $state(false)
	const sessionExpiredMessage = 'セッションが期限切れです。再度ログインしてください。'
	let errorText = $state<string | null>(sessionExpired ? sessionExpiredMessage : null)

	$effect(() => {
		if (sessionExpired && errorText === null)
			errorText = sessionExpiredMessage
	})

	let deviceFingerprint = $state('')
	let uaBrands = $state('')

	async function sha256Hex(input: string) {
		const enc = new TextEncoder().encode(input)
		const digest = await crypto.subtle.digest('SHA-256', enc)
		return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
	}

	async function computeFingerprint() {
		try {
			const nav = navigator as unknown as Record<string, unknown>
			const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
			const parts = {
				ua: navigator.userAgent,
				platform: navigator.platform,
				lang: navigator.language,
				langs: navigator.languages?.join(',') ?? '',
				vendor: nav.vendor ?? '',
				hw: nav.hardwareConcurrency ?? '',
				mem: nav.deviceMemory ?? '',
				tz,
				screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
			}
			return await sha256Hex(JSON.stringify(parts))
		} catch {
			return ''
		}
	}

	onMount(async () => {
		deviceFingerprint = await computeFingerprint()
		try {
			const navData = navigator as unknown as Record<string, unknown>
			const d = navData.userAgentData
			if (d && typeof d === 'object' && d !== null && 'brands' in d && Array.isArray((d as Record<string, unknown>).brands)) {
				uaBrands = JSON.stringify((d as Record<string, unknown>).brands)
			}
		} catch { /* ignore */ }
	})

	// 現在時刻
	let currentTime = $state(new Date())

	$effect(() => {
		const timer = setInterval(() => {
			currentTime = new Date()
		}, 1000)
		return () => clearInterval(timer)
	})
</script>

<svelte:head>
	<title>ログイン - DAT勤怠</title>
</svelte:head>

<div class='min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex flex-col'>
	<!-- メインコンテンツ -->
	<div class='flex-1 flex flex-col items-center justify-center p-6'>
		<!-- ロゴ・タイトル -->
		<div class='text-center mb-8'>
			<div class='w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30'>
				<svg xmlns='http://www.w3.org/2000/svg' class='h-9 w-9 text-white' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
					<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' />
				</svg>
			</div>
			<h1 class='text-2xl font-bold text-slate-800 dark:text-slate-100'>DAT勤怠</h1>
			<p class='text-sm text-slate-500 dark:text-slate-400 mt-1'>勤怠管理システム</p>
		</div>

		<!-- 現在時刻 -->
		<div class='text-center mb-6'>
			<div class='text-4xl font-light text-slate-700 dark:text-slate-200 tabular-nums'>
				{currentTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
			</div>
			<div class='text-sm text-slate-500 dark:text-slate-400 mt-1'>
				{currentTime.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
			</div>
		</div>

		<!-- ログインカード -->
		<div class='w-full max-w-sm'>
			<div class='bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6'>
				<h2 class='text-lg font-semibold text-slate-800 dark:text-slate-100 text-center mb-6'>ログイン</h2>

				<form
					method='POST'
					use:enhance={() => {
						isLoading = true
						return async ({ result, update }) => {
							isLoading = false
							if (result.type === 'failure') {
								errorText = (typeof result.data === 'object' && result.data !== null && 'error' in result.data && typeof result.data.error === 'string') ? result.data.error : 'ログインに失敗しました'
								await update()
								return
							}
							if (result.type === 'redirect') {
								errorText = null
								await update()
								return
							}
							if (result.type === 'success') {
								errorText = null
								await goto(DEFAULT_APP_PATH)
							}
						}
					}}
				>
					<input type='hidden' name='remember_device' value='true' />
					<input type='hidden' name='device_fingerprint' value={deviceFingerprint} />
					{#if uaBrands}
						<input type='hidden' name='ua_brands' value={uaBrands} />
					{/if}

					<!-- エラーメッセージ -->
					{#if (errorText ?? form?.error) && !isLoading}
						<div class='mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl'>
							<div class='flex items-center gap-2'>
								<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5 text-red-500' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
									<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
								</svg>
								<span class='text-sm text-red-700 dark:text-red-300'>{errorText ?? form.error}</span>
							</div>
						</div>
					{/if}

					<!-- メールアドレス -->
					<div class='mb-4'>
						<label for='email' class='block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5'>
							メールアドレス
						</label>
						<div class='relative'>
							<input
								id='email'
								name='email'
								type='email'
								placeholder='user@example.com'
								class='w-full px-4 py-3 pl-11 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all'
								required
								disabled={isLoading}
							/>
							<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
								<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' />
							</svg>
						</div>
					</div>

					<!-- パスワード -->
					<div class='mb-6'>
						<label for='password' class='block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5'>
							パスワード
						</label>
						<div class='relative'>
							<input
								id='password'
								name='password'
								type='password'
								placeholder='••••••••'
								class='w-full px-4 py-3 pl-11 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all'
								required
								disabled={isLoading}
							/>
							<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
								<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' />
							</svg>
						</div>
					</div>

					<!-- ログインボタン -->
					<button
						type='submit'
						class='w-full py-3.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200'
						disabled={isLoading}
					>
						{#if isLoading}
							<span class='flex items-center justify-center gap-2'>
								<svg class='animate-spin h-5 w-5' xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'>
									<circle class='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' stroke-width='4'></circle>
									<path class='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'></path>
								</svg>
								ログイン中...
							</span>
						{:else}
							ログイン
						{/if}
					</button>
				</form>
			</div>

			<!-- ヘルプリンク -->
			<div class='text-center mt-4'>
				<p class='text-xs text-slate-500 dark:text-slate-400'>
					ログインできない場合は管理者にお問い合わせください
				</p>
			</div>

			<!-- キオスク端末リンク -->
			<div class='mt-6 pt-6 border-t border-slate-200 dark:border-slate-700'>
				<p class='text-xs text-slate-500 dark:text-slate-400 text-center mb-3'>打刻端末モード</p>
				<div class='grid grid-cols-2 gap-2'>
					<a
						href='/kiosk'
						class='flex flex-col items-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors'
					>
						<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
							<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z' />
						</svg>
						<span class='text-xs font-medium'>QRコード</span>
					</a>
					<a
						href='/kiosk-face'
						class='flex flex-col items-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors'
					>
						<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
							<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z' />
						</svg>
						<span class='text-xs font-medium'>顔認証</span>
					</a>
				</div>
				<p class='text-xs text-slate-400 dark:text-slate-500 text-center mt-2'>
					タブレット等で打刻を受け付けます
				</p>
			</div>
		</div>
	</div>

	<!-- フッター -->
	<footer class='py-4 text-center'>
		<p class='text-xs text-slate-400 dark:text-slate-500'>
			DAT Attendance System
		</p>
	</footer>
</div>
