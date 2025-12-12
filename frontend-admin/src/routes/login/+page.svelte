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
		} catch {}
	})
</script>

<svelte:head>
	<title>ログイン - Accelerator</title>
</svelte:head>

<div class='min-h-screen bg-linear-to-br from-base-200 via-base-300 to-base-200 flex items-center justify-center p-4'>
	<div class='w-full max-w-md'>
		<!-- Logo and Title -->
		<div class='text-center mb-8'>
			<div class='inline-flex items-center justify-center w-20 h-20 bg-primary rounded-full mb-4'>
				<svg xmlns='http://www.w3.org/2000/svg' class='h-10 w-10 text-primary-content' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
					<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M13 10V3L4 14h7v7l9-11h-7z' />
				</svg>
			</div>
			<h1 class='text-3xl font-bold text-base-content'>Accelerator</h1>
			<p class='text-base-content/70 mt-2'>エンタープライズ管理ダッシュボード</p>
		</div>

		<!-- Login Card -->
		<div class='card bg-base-100 shadow-2xl'>
			<div class='card-body'>
				<h2 class='card-title text-2xl font-bold text-center w-full mb-2'>ログイン</h2>
				<p class='text-center text-base-content/70 mb-6'>アカウント情報を入力してください</p>

				<form
					method='POST'
					use:enhance={() => {
						isLoading = true
						return async ({ result, update }) => {
							isLoading = false
							if (result.type === 'failure') {
								// 失敗のみUI更新（エラー表示）
								errorText = (typeof result.data === 'object' && result.data !== null && 'error' in result.data && typeof result.data.error === 'string') ? result.data.error : 'ログインに失敗しました'
								await update()
								return
							}
							if (result.type === 'redirect') {
								errorText = null // エラー状態をクリア
								await update() // SvelteKit標準のリダイレクト適用
								return
							}
							if (result.type === 'success') {
								errorText = null // エラー状態をクリア
								// 念のためのフォールバック
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
					<div class='form-control'>
						<label class='label' for='email'>
							<span class='label-text'>メールアドレス</span>
						</label>
						<div class='relative'>
							<input
								id='email'
								name='email'
								type='email'
								placeholder='admin@example.com'
								class='input input-bordered w-full pl-10'
								required
								disabled={isLoading}
							/>
							<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
								<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' />
							</svg>
						</div>
					</div>

					<div class='form-control mt-4'>
						<label class='label' for='password'>
							<span class='label-text'>パスワード</span>
						</label>
						<div class='relative'>
							<input
								id='password'
								name='password'
								type='password'
								placeholder='••••••••'
								class='input input-bordered w-full pl-10'
								required
								disabled={isLoading}
							/>
							<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
								<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' />
							</svg>
						</div>
					</div>

					<!-- Error Message -->
					{#if (errorText ?? form?.error) && !isLoading}
						<div class='alert alert-error mt-4'>
							<svg xmlns='http://www.w3.org/2000/svg' class='stroke-current shrink-0 h-6 w-6' fill='none' viewBox='0 0 24 24'>
								<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' />
							</svg>
							<span>{errorText ?? form.error}</span>
						</div>
					{/if}

					<div class='form-control mt-6'>
						<button type='submit' class='btn btn-primary' disabled={isLoading}>
							{#if isLoading}
								<span class='loading loading-spinner'></span>
								ログイン中...
							{:else}
								ログイン
							{/if}
						</button>
					</div>
				</form>

				<!-- Additional Info -->
				<div class='divider mt-6'>または</div>

				<div class='text-center'>
					<p class='text-sm text-base-content/70'>
						アカウントに関するお問い合わせは
					</p>
					<p class='text-sm text-base-content/70'>
						システム管理者にご連絡ください
					</p>
				</div>
			</div>
		</div>

		<!-- Footer -->
		<div class='text-center mt-8'>
			<p class='text-xs text-base-content/50'>
				© 2025 Dashboard Accelerator. All rights reserved.
			</p>
			<p class='text-xs text-base-content/50 mt-1'>
				Powered by FOX HOUND LTD.
			</p>
		</div>
	</div>
</div>
