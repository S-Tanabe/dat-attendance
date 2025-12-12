<script lang='ts'>
	import { goto } from '$app/navigation'
	import { page } from '$app/stores'

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

	const { data } = $props<{
		data: {
			records: AttendanceRecord[]
			total: number
			from: string
			to: string
		}
	}>()

	// フィルター用の日付
	let fromDate = $state(data.from)
	let toDate = $state(data.to)

	// 日付でグループ化したレコード
	const groupedRecords = $derived(() => {
		const groups: Record<string, AttendanceRecord[]> = {}
		for (const record of data.records) {
			const dateKey = record.timestamp.split('T')[0]
			if (!groups[dateKey]) {
				groups[dateKey] = []
			}
			groups[dateKey].push(record)
		}
		// 日付順にソート（新しい順）
		return Object.entries(groups)
			.sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
	})

	// 1日の勤務情報を計算
	function getDayWorkInfo(records: AttendanceRecord[]): { clockIn: string | null, clockOut: string | null, duration: string } {
		const sorted = [...records].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
		const clockInRecord = sorted.find((r: AttendanceRecord) => r.type === 'CLOCK_IN')
		const clockOutRecord = sorted.find((r: AttendanceRecord) => r.type === 'CLOCK_OUT')

		const clockIn = clockInRecord ? formatTime(clockInRecord.timestamp) : null
		const clockOut = clockOutRecord ? formatTime(clockOutRecord.timestamp) : null

		let duration = '--:--'
		if (clockInRecord && clockOutRecord) {
			const inTime = new Date(clockInRecord.timestamp).getTime()
			const outTime = new Date(clockOutRecord.timestamp).getTime()
			const diffMs = outTime - inTime
			const hours = Math.floor(diffMs / (1000 * 60 * 60))
			const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
			duration = `${hours}:${String(mins).padStart(2, '0')}`
		}

		return { clockIn, clockOut, duration }
	}

	// 検索実行
	function handleSearch() {
		const params = new URLSearchParams($page.url.searchParams)
		params.set('from', fromDate)
		params.set('to', toDate)
		void goto(`?${params.toString()}`)
	}

	// 前月へ
	function goToPreviousMonth() {
		const from = new Date(fromDate)
		from.setMonth(from.getMonth() - 1)
		from.setDate(1)
		const to = new Date(from.getFullYear(), from.getMonth() + 1, 0)
		fromDate = formatDateISO(from)
		toDate = formatDateISO(to)
		handleSearch()
	}

	// 翌月へ
	function goToNextMonth() {
		const from = new Date(fromDate)
		from.setMonth(from.getMonth() + 1)
		from.setDate(1)
		const to = new Date(from.getFullYear(), from.getMonth() + 1, 0)
		fromDate = formatDateISO(from)
		toDate = formatDateISO(to)
		handleSearch()
	}

	// 今月へ
	function goToCurrentMonth() {
		const now = new Date()
		const from = new Date(now.getFullYear(), now.getMonth(), 1)
		const to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
		fromDate = formatDateISO(from)
		toDate = formatDateISO(to)
		void goto('/history')
	}

	// 日付フォーマット（ISO）
	function formatDateISO(date: Date): string {
		const year = date.getFullYear()
		const month = String(date.getMonth() + 1).padStart(2, '0')
		const day = String(date.getDate()).padStart(2, '0')
		return `${year}-${month}-${day}`
	}

	// 時刻フォーマット
	function formatTime(timestamp: string): string {
		const date = new Date(timestamp)
		return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
	}

	// 日付フォーマット（表示用）
	function formatDisplayDate(dateStr: string): { day: number, weekday: string, isWeekend: boolean } {
		const date = new Date(dateStr)
		const weekdays = ['日', '月', '火', '水', '木', '金', '土']
		const dayOfWeek = date.getDay()
		return {
			day: date.getDate(),
			weekday: weekdays[dayOfWeek],
			isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
		}
	}

	// 表示期間のラベル
	const periodLabel = $derived(() => {
		const from = new Date(data.from)
		return `${from.getFullYear()}年${from.getMonth() + 1}月`
	})

	// 今月かどうか
	const isCurrentMonth = $derived(() => {
		const now = new Date()
		const from = new Date(data.from)
		return now.getFullYear() === from.getFullYear() && now.getMonth() === from.getMonth()
	})
</script>

<svelte:head>
	<title>履歴 - DAT勤怠</title>
</svelte:head>

<div class='flex flex-col space-y-4'>
	<!-- 月選択ヘッダー -->
	<div class='flex items-center justify-between'>
		<button
			class='p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors'
			onclick={goToPreviousMonth}
			aria-label='前の月'
		>
			<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5 text-slate-600 dark:text-slate-400' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
				<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M15 19l-7-7 7-7' />
			</svg>
		</button>

		<div class='flex items-center gap-3'>
			<h1 class='text-xl font-bold text-slate-800 dark:text-slate-100'>{periodLabel()}</h1>
			{#if !isCurrentMonth()}
				<button
					class='text-xs px-2 py-1 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors'
					onclick={goToCurrentMonth}
				>
					今月
				</button>
			{/if}
		</div>

		<button
			class='p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors'
			onclick={goToNextMonth}
			aria-label='次の月'
		>
			<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5 text-slate-600 dark:text-slate-400' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
				<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M9 5l7 7-7 7' />
			</svg>
		</button>
	</div>

	<!-- サマリー -->
	<div class='bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4'>
		<div class='flex items-center justify-between'>
			<div class='flex items-center gap-2'>
				<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5 text-slate-400' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
					<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' />
				</svg>
				<span class='text-sm text-slate-600 dark:text-slate-400'>打刻記録</span>
			</div>
			<span class='text-sm font-medium text-slate-800 dark:text-slate-100'>{data.total}件</span>
		</div>
	</div>

	<!-- 勤怠一覧 -->
	{#if data.records.length === 0}
		<div class='bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 text-center'>
			<div class='w-16 h-16 mx-auto mb-4 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center'>
				<svg xmlns='http://www.w3.org/2000/svg' class='h-8 w-8 text-slate-400' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
					<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' />
				</svg>
			</div>
			<p class='text-slate-500 dark:text-slate-400'>この期間の打刻データはありません</p>
		</div>
	{:else}
		<div class='space-y-2'>
			{#each groupedRecords() as [dateKey, records]}
				{@const dateInfo = formatDisplayDate(dateKey)}
				{@const workInfo = getDayWorkInfo(records)}
				<div class='bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden'>
					<div class='flex items-stretch'>
						<!-- 日付表示 -->
						<div
							class='w-16 flex-shrink-0 flex flex-col items-center justify-center py-3 border-r border-slate-100 dark:border-slate-700 {dateInfo.weekday === '日' ? 'bg-red-50 dark:bg-red-900/20' : dateInfo.weekday === '土' ? 'bg-blue-50 dark:bg-blue-900/20' : ''}'
						>
							<span
								class='text-2xl font-bold {dateInfo.weekday === '日' ? 'text-red-500 dark:text-red-400' : dateInfo.weekday === '土' ? 'text-blue-500 dark:text-blue-400' : 'text-slate-800 dark:text-slate-100'}'
							>
								{dateInfo.day}
							</span>
							<span
								class='text-xs font-medium {dateInfo.weekday === '日' ? 'text-red-500 dark:text-red-400' : dateInfo.weekday === '土' ? 'text-blue-500 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}'
							>
								{dateInfo.weekday}
							</span>
						</div>

						<!-- 勤怠情報 -->
						<div class='flex-1 p-3'>
							<div class='flex items-center justify-between'>
								<div class='flex items-center gap-4'>
									<!-- 出勤 -->
									<div class='flex items-center gap-2'>
										<div class='w-2 h-2 rounded-full bg-blue-500'></div>
										<span class='text-sm text-slate-600 dark:text-slate-400'>出勤</span>
										<span class='text-sm font-medium text-slate-800 dark:text-slate-100 tabular-nums'>
											{workInfo.clockIn || '--:--'}
										</span>
									</div>

									<!-- 退勤 -->
									<div class='flex items-center gap-2'>
										<div class='w-2 h-2 rounded-full bg-orange-500'></div>
										<span class='text-sm text-slate-600 dark:text-slate-400'>退勤</span>
										<span class='text-sm font-medium text-slate-800 dark:text-slate-100 tabular-nums'>
											{workInfo.clockOut || '--:--'}
										</span>
									</div>
								</div>

								<!-- 勤務時間 -->
								<div class='flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-md'>
									<svg xmlns='http://www.w3.org/2000/svg' class='h-3.5 w-3.5 text-slate-500 dark:text-slate-400' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
										<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' />
									</svg>
									<span class='text-sm font-medium text-slate-700 dark:text-slate-300 tabular-nums'>
										{workInfo.duration}
									</span>
								</div>
							</div>

							<!-- 備考があれば表示 -->
							{#each records.filter((r: AttendanceRecord) => r.note) as record}
								<div class='mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-start gap-1'>
									<svg xmlns='http://www.w3.org/2000/svg' class='h-3.5 w-3.5 flex-shrink-0 mt-0.5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
										<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z' />
									</svg>
									<span>{record.note}</span>
								</div>
							{/each}
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
