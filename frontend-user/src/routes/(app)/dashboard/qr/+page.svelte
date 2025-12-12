<script lang='ts'>
	import { browser } from '$app/environment'
	import QRCode from 'qrcode'
	import { onMount } from 'svelte'

	interface TodayStatus {
		has_clocked_in: boolean
		has_clocked_out: boolean
	}

	const { data } = $props<{
		data: { todayStatus: TodayStatus | null }
	}>()

	let qrDataUrl = $state<string | null>(null)
	let isLoading = $state(false)
	let error = $state<string | null>(null)
	let expiresAt = $state<Date | null>(null)
	let remainingSeconds = $state(0)
	let clockType = $state<'CLOCK_IN' | 'CLOCK_OUT'>('CLOCK_IN')

	// 現在の打刻状態から適切な打刻種別を判定
	$effect(() => {
		if (data.todayStatus?.has_clocked_in && !data.todayStatus?.has_clocked_out) {
			clockType = 'CLOCK_OUT'
		} else {
			clockType = 'CLOCK_IN'
		}
	})

	// 残り時間のカウントダウン
	$effect(() => {
		if (!expiresAt || !browser)
			return

		const currentExpiresAt = expiresAt
		const timer = setInterval(() => {
			const now = new Date()
			const diff = Math.max(0, Math.floor((currentExpiresAt.getTime() - now.getTime()) / 1000))
			remainingSeconds = diff

			// 期限切れの場合は自動更新
			if (diff <= 0) {
				void generateQRCode()
			}
		}, 1000)

		return () => clearInterval(timer)
	})

	interface QRGenerateResult {
		error?: string
		qr_data?: string
		expires_at?: string
	}

	async function generateQRCode() {
		if (!browser)
			return

		isLoading = true
		error = null

		try {
			const response = await fetch('/dashboard/qr/api/generate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					clock_type: clockType,
					ttl_seconds: 300, // 5分
				}),
			})

			const result = await response.json() as QRGenerateResult

			if (!response.ok || !result.qr_data) {
				throw new Error(result.error ?? 'QRコードの生成に失敗しました')
			}

			// QRコード画像を生成
			qrDataUrl = await QRCode.toDataURL(result.qr_data, {
				width: 280,
				margin: 2,
				color: {
					dark: '#1e293b',
					light: '#ffffff',
				},
			})

			expiresAt = result.expires_at ? new Date(result.expires_at) : null
		} catch (err) {
			error = err instanceof Error ? err.message : 'QRコードの生成に失敗しました'
			qrDataUrl = null
		} finally {
			isLoading = false
		}
	}

	onMount(() => {
		void generateQRCode()
	})

	// 残り時間のフォーマット
	function formatRemainingTime(seconds: number): string {
		const mins = Math.floor(seconds / 60)
		const secs = seconds % 60
		return `${mins}:${String(secs).padStart(2, '0')}`
	}
</script>

<svelte:head>
	<title>QRコード打刻 - DAT勤怠</title>
</svelte:head>

<div class='flex flex-col items-center space-y-6'>
	<div class='text-center'>
		<h1 class='text-xl font-bold text-slate-800 dark:text-slate-100'>QRコード打刻</h1>
		<p class='text-sm text-slate-500 dark:text-slate-400 mt-1'>
			このQRコードを受付でスキャンしてもらってください
		</p>
	</div>

	<!-- 打刻種別表示 -->
	<div class='inline-flex items-center gap-2 px-4 py-2 rounded-full {clockType === 'CLOCK_IN' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400'}'>
		{#if clockType === 'CLOCK_IN'}
			<svg xmlns='http://www.w3.org/2000/svg' class='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
				<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1' />
			</svg>
			<span class='text-sm font-medium'>出勤用</span>
		{:else}
			<svg xmlns='http://www.w3.org/2000/svg' class='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
				<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1' />
			</svg>
			<span class='text-sm font-medium'>退勤用</span>
		{/if}
	</div>

	<!-- QRコード表示エリア -->
	<div class='bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6'>
		{#if isLoading}
			<div class='w-72 h-72 flex items-center justify-center'>
				<div class='flex flex-col items-center gap-3'>
					<span class='loading loading-spinner loading-lg text-blue-500'></span>
					<span class='text-sm text-slate-500 dark:text-slate-400'>QRコードを生成中...</span>
				</div>
			</div>
		{:else if error}
			<div class='w-72 h-72 flex items-center justify-center'>
				<div class='flex flex-col items-center gap-3 text-center'>
					<div class='w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center'>
						<svg xmlns='http://www.w3.org/2000/svg' class='h-8 w-8 text-red-500' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
							<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' />
						</svg>
					</div>
					<p class='text-sm text-red-600 dark:text-red-400'>{error}</p>
					<button
						onclick={() => void generateQRCode()}
						class='px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors'
					>
						再試行
					</button>
				</div>
			</div>
		{:else if qrDataUrl}
			<div class='flex flex-col items-center gap-4'>
				<img src={qrDataUrl} alt='QRコード' class='w-72 h-72' />

				<!-- 残り時間 -->
				<div class='flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg'>
					<svg xmlns='http://www.w3.org/2000/svg' class='h-4 w-4 text-slate-500 dark:text-slate-400' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
						<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' />
					</svg>
					<span class='text-sm text-slate-600 dark:text-slate-300'>
						有効期限: <span class='font-mono font-medium tabular-nums {remainingSeconds < 60 ? 'text-red-500' : ''}'>{formatRemainingTime(remainingSeconds)}</span>
					</span>
				</div>
			</div>
		{/if}
	</div>

	<!-- 更新ボタン -->
	<button
		onclick={() => void generateQRCode()}
		disabled={isLoading}
		class='flex items-center gap-2 px-6 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50'
	>
		<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
			<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' />
		</svg>
		QRコードを更新
	</button>

	<!-- 説明 -->
	<div class='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-sm'>
		<div class='flex items-start gap-3'>
			<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
				<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
			</svg>
			<div class='text-blue-700 dark:text-blue-300'>
				<p class='font-medium mb-1'>使い方</p>
				<ol class='list-decimal list-inside space-y-1 text-blue-600 dark:text-blue-400'>
					<li>このQRコードを受付のスタッフに見せてください</li>
					<li>スキャンされると自動的に打刻が完了します</li>
					<li>QRコードは5分間有効です</li>
				</ol>
			</div>
		</div>
	</div>

	<!-- 戻るボタン -->
	<a
		href='/dashboard'
		class='text-sm text-blue-600 dark:text-blue-400 hover:underline'
	>
		ダッシュボードに戻る
	</a>
</div>
