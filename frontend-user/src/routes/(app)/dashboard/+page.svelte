<script lang='ts'>
	import { enhance } from '$app/forms'
	import { invalidateAll } from '$app/navigation'

	interface TodayStatus {
		has_clocked_in: boolean
		has_clocked_out: boolean
		clock_in_time?: string | null
		clock_out_time?: string | null
		working_duration_minutes?: number | null
	}

	interface AttendanceRecord {
		id: string
		user_id: string
		timestamp: string
		type: 'CLOCK_IN' | 'CLOCK_OUT' | 'ADJUSTMENT'
		note?: string | null
		source: 'USER' | 'ADMIN' | 'SYSTEM'
		clock_method_id?: string | null
		created_at: string
	}

	const { data, form } = $props<{
		data: { todayStatus: TodayStatus | null, recentRecords: AttendanceRecord[] }
		form: { success?: boolean, error?: string, data?: unknown } | null
	}>()

	let isLoading = $state(false)
	let errorMessage = $state<string | null>(null)
	let successMessage = $state<string | null>(null)
	let showSuccessAnimation = $state(false)

	// 現在時刻を取得して更新
	let currentTime = $state(new Date())

	$effect(() => {
		const timer = setInterval(() => {
			currentTime = new Date()
		}, 1000)

		return () => clearInterval(timer)
	})

	// フォーム結果の処理
	$effect(() => {
		if (form?.error) {
			errorMessage = form.error
			successMessage = null
			showSuccessAnimation = false
		} else if (form?.success) {
			successMessage = '打刻が完了しました'
			errorMessage = null
			showSuccessAnimation = true
			setTimeout(() => {
				successMessage = null
				showSuccessAnimation = false
			}, 3000)
		}
	})

	// 時刻フォーマット
	function formatTime(dateString: string | null | undefined): string {
		if (!dateString)
			return '--:--'
		const date = new Date(dateString)
		return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
	}

	// 勤務時間フォーマット
	function formatDuration(minutes: number | null | undefined): string {
		if (minutes === null || minutes === undefined)
			return '0:00'
		const hours = Math.floor(minutes / 60)
		const mins = minutes % 60
		return `${hours}:${String(mins).padStart(2, '0')}`
	}

	// 曜日の配列
	const weekdays = ['日', '月', '火', '水', '木', '金', '土']

	// 現在の状態を判定
	const workStatus = $derived(() => {
		if (!data.todayStatus?.has_clocked_in)
			return 'not_started'
		if (data.todayStatus?.has_clocked_out)
			return 'finished'
		return 'working'
	})

	// ステータスラベル
	const statusLabel = $derived(() => {
		switch (workStatus()) {
			case 'not_started': return '未出勤'
			case 'working': return '勤務中'
			case 'finished': return '退勤済み'
			default: return ''
		}
	})

	// ステータスカラー
	const statusColor = $derived(() => {
		switch (workStatus()) {
			case 'not_started': return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
			case 'working': return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
			case 'finished': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
			default: return ''
		}
	})

	// 打刻履歴用のフォーマット
	function formatRecordDateTime(timestamp: string): { date: string, time: string } {
		const date = new Date(timestamp)
		return {
			date: date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
			time: date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
		}
	}

	// タイプラベル
	function getTypeLabel(type: string): string {
		switch (type) {
			case 'CLOCK_IN': return '出勤'
			case 'CLOCK_OUT': return '退勤'
			case 'ADJUSTMENT': return '調整'
			default: return type
		}
	}

	// タイプの色
	function getTypeColor(type: string): string {
		switch (type) {
			case 'CLOCK_IN': return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40'
			case 'CLOCK_OUT': return 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/40'
			case 'ADJUSTMENT': return 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40'
			default: return 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800'
		}
	}
</script>

<svelte:head>
	<title>打刻 - DAT勤怠</title>
</svelte:head>

<div class='flex flex-col items-center space-y-6'>
	<!-- 日付・時刻表示 -->
	<div class='text-center w-full'>
		<div class='text-sm text-slate-500 dark:text-slate-400 mb-1'>
			{currentTime.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
			<span class='ml-1'>({weekdays[currentTime.getDay()]})</span>
		</div>
		<div class='text-6xl sm:text-7xl font-light text-slate-800 dark:text-slate-100 tabular-nums tracking-tight'>
			{currentTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
		</div>
		<div class='text-2xl text-slate-400 dark:text-slate-500 font-light tabular-nums'>
			:{String(currentTime.getSeconds()).padStart(2, '0')}
		</div>
	</div>

	<!-- ステータスバッジ -->
	<div class='inline-flex items-center gap-2 px-4 py-2 rounded-full {statusColor()}'>
		{#if workStatus() === 'working'}
			<span class='relative flex h-2 w-2'>
				<span class='animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75'></span>
				<span class='relative inline-flex rounded-full h-2 w-2 bg-green-500'></span>
			</span>
		{/if}
		<span class='text-sm font-medium'>{statusLabel()}</span>
	</div>

	<!-- メッセージ表示 -->
	{#if errorMessage}
		<div class='w-full bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center gap-3'>
			<div class='flex-shrink-0 w-10 h-10 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center'>
				<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5 text-red-600 dark:text-red-400' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
					<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 18L18 6M6 6l12 12' />
				</svg>
			</div>
			<div class='flex-1'>
				<p class='text-sm font-medium text-red-800 dark:text-red-200'>エラー</p>
				<p class='text-sm text-red-600 dark:text-red-300'>{errorMessage}</p>
			</div>
		</div>
	{/if}

	{#if successMessage}
		<div class='w-full bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-center gap-3'>
			<div class='flex-shrink-0 w-10 h-10 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center' class:animate-bounce={showSuccessAnimation}>
				<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5 text-green-600 dark:text-green-400' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
					<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M5 13l4 4L19 7' />
				</svg>
			</div>
			<div class='flex-1'>
				<p class='text-sm font-medium text-green-800 dark:text-green-200'>成功</p>
				<p class='text-sm text-green-600 dark:text-green-300'>{successMessage}</p>
			</div>
		</div>
	{/if}

	<!-- 打刻ボタン -->
	<div class='w-full flex flex-col gap-3'>
		<!-- 出勤ボタン -->
		<form
			method='POST'
			action='?/clockIn'
			class='w-full'
			use:enhance={() => {
				isLoading = true
				errorMessage = null
				successMessage = null
				return async ({ update }) => {
					isLoading = false
					await update()
					await invalidateAll()
				}
			}}
		>
			<button
				type='submit'
				class='w-full h-20 rounded-2xl text-xl font-semibold transition-all duration-200 flex items-center justify-center gap-3
					{data.todayStatus?.has_clocked_in
						? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed'
						: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98]'}'
				disabled={isLoading || data.todayStatus?.has_clocked_in}
			>
				{#if isLoading}
					<span class='loading loading-spinner loading-md'></span>
				{:else}
					<svg xmlns='http://www.w3.org/2000/svg' class='h-7 w-7' fill='none' viewBox='0 0 24 24' stroke='currentColor' stroke-width='2'>
						<path stroke-linecap='round' stroke-linejoin='round' d='M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1' />
					</svg>
					出勤
				{/if}
			</button>
		</form>

		<!-- 退勤ボタン -->
		<form
			method='POST'
			action='?/clockOut'
			class='w-full'
			use:enhance={() => {
				isLoading = true
				errorMessage = null
				successMessage = null
				return async ({ update }) => {
					isLoading = false
					await update()
					await invalidateAll()
				}
			}}
		>
			<button
				type='submit'
				class='w-full h-20 rounded-2xl text-xl font-semibold transition-all duration-200 flex items-center justify-center gap-3
					{!data.todayStatus?.has_clocked_in || data.todayStatus?.has_clocked_out
						? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed'
						: 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 hover:scale-[1.02] active:scale-[0.98]'}'
				disabled={isLoading || !data.todayStatus?.has_clocked_in || data.todayStatus?.has_clocked_out}
			>
				{#if isLoading}
					<span class='loading loading-spinner loading-md'></span>
				{:else}
					<svg xmlns='http://www.w3.org/2000/svg' class='h-7 w-7' fill='none' viewBox='0 0 24 24' stroke='currentColor' stroke-width='2'>
						<path stroke-linecap='round' stroke-linejoin='round' d='M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1' />
					</svg>
					退勤
				{/if}
			</button>
		</form>
	</div>

	<!-- 今日の勤怠サマリー -->
	<div class='w-full bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden'>
		<div class='px-4 py-3 border-b border-slate-100 dark:border-slate-700'>
			<h3 class='text-sm font-medium text-slate-500 dark:text-slate-400'>本日の勤務</h3>
		</div>
		<div class='grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-700'>
			<!-- 出勤時刻 -->
			<div class='p-4 text-center'>
				<div class='text-xs text-slate-500 dark:text-slate-400 mb-1'>出勤</div>
				<div class='text-lg font-semibold text-slate-800 dark:text-slate-100 tabular-nums'>
					{formatTime(data.todayStatus?.clock_in_time)}
				</div>
			</div>

			<!-- 退勤時刻 -->
			<div class='p-4 text-center'>
				<div class='text-xs text-slate-500 dark:text-slate-400 mb-1'>退勤</div>
				<div class='text-lg font-semibold text-slate-800 dark:text-slate-100 tabular-nums'>
					{formatTime(data.todayStatus?.clock_out_time)}
				</div>
			</div>

			<!-- 勤務時間 -->
			<div class='p-4 text-center'>
				<div class='text-xs text-slate-500 dark:text-slate-400 mb-1'>勤務</div>
				<div class='text-lg font-semibold tabular-nums' class:text-green-600={workStatus() === 'working'} class:dark:text-green-400={workStatus() === 'working'} class:text-slate-800={workStatus() !== 'working'} class:dark:text-slate-100={workStatus() !== 'working'}>
					{formatDuration(data.todayStatus?.working_duration_minutes)}
				</div>
			</div>
		</div>
	</div>

	<!-- 他の打刻方法 -->
	<div class='w-full'>
		<a
			href='/dashboard/clock-method'
			class='flex items-center justify-between w-full px-4 py-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors'
		>
			<div class='flex items-center gap-3'>
				<div class='w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center'>
					<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5 text-slate-500 dark:text-slate-400' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
						<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M4 6h16M4 12h16m-7 6h7' />
					</svg>
				</div>
				<div class='text-left'>
					<div class='text-sm font-medium text-slate-700 dark:text-slate-300'>他の打刻方法</div>
					<div class='text-xs text-slate-500 dark:text-slate-400'>QRコード・顔認証</div>
				</div>
			</div>
			<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5 text-slate-400' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
				<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M9 5l7 7-7 7' />
			</svg>
		</a>
	</div>

	<!-- 最近の打刻履歴 -->
	{#if data.recentRecords.length > 0}
		<div class='w-full bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden'>
			<div class='px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between'>
				<h3 class='text-sm font-medium text-slate-500 dark:text-slate-400'>最近の打刻</h3>
				<a href='/history' class='text-xs text-blue-600 dark:text-blue-400 hover:underline'>
					すべて表示
				</a>
			</div>
			<ul class='divide-y divide-slate-100 dark:divide-slate-700'>
				{#each data.recentRecords.slice(0, 5) as record}
					{@const datetime = formatRecordDateTime(record.timestamp)}
					<li class='px-4 py-3 flex items-center justify-between'>
						<div class='flex items-center gap-3'>
							<span class='text-xs font-medium px-2 py-1 rounded {getTypeColor(record.type)}'>
								{getTypeLabel(record.type)}
							</span>
							<div>
								<span class='text-sm text-slate-800 dark:text-slate-200 tabular-nums'>{datetime.time}</span>
								<span class='text-xs text-slate-400 dark:text-slate-500 ml-2'>{datetime.date}</span>
							</div>
						</div>
						{#if record.note}
							<span class='text-xs text-slate-400 dark:text-slate-500 truncate max-w-24' title={record.note}>
								{record.note}
							</span>
						{/if}
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<!-- 補足情報 -->
	<div class='text-center text-xs text-slate-400 dark:text-slate-500'>
		{#if workStatus() === 'not_started'}
			出勤ボタンを押して勤務を開始してください
		{:else if workStatus() === 'working'}
			お疲れさまです。退勤時は退勤ボタンを押してください
		{:else}
			本日の勤務は終了しています
		{/if}
	</div>
</div>
