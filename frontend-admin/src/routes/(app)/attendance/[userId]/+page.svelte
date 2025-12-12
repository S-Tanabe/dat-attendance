<script lang='ts'>
	import type { attendance } from '$lib/generated/client'
	import { enhance } from '$app/forms'
	import { goto } from '$app/navigation'

	interface PageData {
		detail: attendance.UserAttendanceDetailResponse | null
		year: number
		month: number
		error?: string
	}

	const { data, form } = $props<{
		data: PageData
		form: { success?: boolean, error?: string, action?: string } | null
	}>()

	// モーダル状態
	let showAddModal = $state(false)
	let showEditModal = $state(false)
	let editingRecord = $state<attendance.AttendanceRecord | null>(null)

	// 新規追加フォーム
	let newType = $state<'CLOCK_IN' | 'CLOCK_OUT' | 'ADJUSTMENT'>('CLOCK_IN')
	let newTimestamp = $state('')
	let newNote = $state('')

	// 編集フォーム
	let editTimestamp = $state('')
	let editNote = $state('')

	// 展開状態の管理
	let expandedDates = $state<Set<string>>(new Set())

	// 年月選択用
	let selectedYear = $state(data.year)
	let selectedMonth = $state(data.month)

	// 日付行の展開トグル
	function toggleDate(date: string) {
		const newSet = new Set(expandedDates)
		if (newSet.has(date)) {
			newSet.delete(date)
		} else {
			newSet.add(date)
		}
		expandedDates = newSet
	}

	// 月を変更
	function changeMonth(delta: number) {
		let newMonth = selectedMonth + delta
		let newYear = selectedYear

		if (newMonth > 12) {
			newMonth = 1
			newYear++
		} else if (newMonth < 1) {
			newMonth = 12
			newYear--
		}

		selectedYear = newYear
		selectedMonth = newMonth
		void goto(`?year=${newYear}&month=${newMonth}`)
	}

	// 今月に移動
	function goToCurrentMonth() {
		const now = new Date()
		selectedYear = now.getFullYear()
		selectedMonth = now.getMonth() + 1
		void goto(`?year=${selectedYear}&month=${selectedMonth}`)
	}

	// 時刻フォーマット（HH:mm形式）
	function formatTime(timestamp: string | null): string {
		if (!timestamp)
			return '-'
		const date = new Date(timestamp)
		return date.toLocaleTimeString('ja-JP', {
			hour: '2-digit',
			minute: '2-digit',
		})
	}

	// 日付フォーマット（M月D日（曜日））
	function formatDate(dateStr: string): string {
		const date = new Date(dateStr)
		return date.toLocaleDateString('ja-JP', {
			month: 'numeric',
			day: 'numeric',
			weekday: 'short',
		})
	}

	// 日時フォーマット（HH:mm:ss形式）
	function formatDateTime(timestamp: string): string {
		const date = new Date(timestamp)
		return date.toLocaleTimeString('ja-JP', {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		})
	}

	// 勤務時間フォーマット
	function formatWorkingTime(minutes: number): string {
		if (minutes === 0)
			return '-'
		const hours = Math.floor(minutes / 60)
		const mins = minutes % 60
		if (hours === 0)
			return `${mins}分`
		if (mins === 0)
			return `${hours}時間`
		return `${hours}時間${mins}分`
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

	// タイプバッジクラス
	function getTypeBadgeClass(type: string): string {
		switch (type) {
			case 'CLOCK_IN': return 'badge-primary'
			case 'CLOCK_OUT': return 'badge-secondary'
			case 'ADJUSTMENT': return 'badge-warning'
			default: return 'badge-ghost'
		}
	}

	// ソースラベル
	function getSourceLabel(source: string): string {
		switch (source) {
			case 'USER': return 'ユーザー'
			case 'ADMIN': return '管理者'
			case 'SYSTEM': return 'システム'
			default: return source
		}
	}

	// 曜日による行の色分け
	function getDayClass(dateStr: string): string {
		const date = new Date(dateStr)
		const day = date.getDay()
		if (day === 0)
			return 'bg-red-50 dark:bg-red-900/10' // 日曜
		if (day === 6)
			return 'bg-blue-50 dark:bg-blue-900/10' // 土曜
		return ''
	}

	// 新規追加モーダルを開く
	function openAddModal(date?: string) {
		newType = 'CLOCK_IN'
		if (date) {
			// 選択した日付の9:00をデフォルトに設定
			newTimestamp = `${date}T09:00`
		} else {
			newTimestamp = new Date().toISOString().slice(0, 16)
		}
		newNote = ''
		showAddModal = true
	}

	// 編集モーダルを開く
	function openEditModal(record: attendance.AttendanceRecord) {
		editingRecord = record
		editTimestamp = record.timestamp.slice(0, 16)
		editNote = record.note || ''
		showEditModal = true
	}

	// モーダルを閉じる
	function closeModals() {
		showAddModal = false
		showEditModal = false
		editingRecord = null
	}

	// フォーム送信後の処理
	$effect(() => {
		if (form?.success) {
			closeModals()
		}
	})
</script>

<svelte:head>
	<title>{data.detail?.display_name || 'ユーザー'}の勤怠詳細 - DAT Attendance</title>
</svelte:head>

<div class='flex flex-col space-y-4'>
	<!-- ヘッダー -->
	<div class='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4'>
		<div class='flex items-center gap-4'>
			<a href='/attendance' class='btn btn-ghost btn-sm'>
				<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
					<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M15 19l-7-7 7-7' />
				</svg>
				戻る
			</a>
			<div>
				<h1 class='text-2xl font-bold'>
					{data.detail?.display_name || 'ユーザー'}の勤怠詳細
				</h1>
				<p class='text-sm text-base-content/70'>{data.detail?.email || ''}</p>
			</div>
		</div>
		<button class='btn btn-primary' onclick={() => openAddModal()}>
			<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
				<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 4v16m8-8H4' />
			</svg>
			打刻を追加
		</button>
	</div>

	{#if data.error}
		<div class='alert alert-error'>
			<svg xmlns='http://www.w3.org/2000/svg' class='stroke-current shrink-0 h-6 w-6' fill='none' viewBox='0 0 24 24'>
				<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' />
			</svg>
			<span>{data.error}</span>
		</div>
	{:else if data.detail}
		<!-- 月選択 -->
		<div class='card bg-base-100 shadow-xl'>
			<div class='card-body p-4'>
				<div class='flex flex-col sm:flex-row justify-between items-center gap-4'>
					<div class='flex items-center gap-2'>
						<button class='btn btn-ghost btn-sm' onclick={() => changeMonth(-1)}>
							<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
								<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M15 19l-7-7 7-7' />
							</svg>
						</button>
						<span class='text-xl font-bold min-w-[140px] text-center'>
							{data.year}年{data.month}月
						</span>
						<button class='btn btn-ghost btn-sm' onclick={() => changeMonth(1)}>
							<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
								<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M9 5l7 7-7 7' />
							</svg>
						</button>
						<button class='btn btn-ghost btn-sm' onclick={goToCurrentMonth}>
							今月
						</button>
					</div>
					<div class='stats shadow'>
						<div class='stat py-2 px-4'>
							<div class='stat-title text-xs'>勤務時間</div>
							<div class='stat-value text-lg'>{formatWorkingTime(data.detail.month_total_minutes)}</div>
						</div>
						<div class='stat py-2 px-4'>
							<div class='stat-title text-xs'>勤務日数</div>
							<div class='stat-value text-lg'>{data.detail.month_working_days}日</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- エラー/成功メッセージ -->
		{#if form?.error}
			<div class='alert alert-error'>
				<svg xmlns='http://www.w3.org/2000/svg' class='stroke-current shrink-0 h-6 w-6' fill='none' viewBox='0 0 24 24'>
					<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' />
				</svg>
				<span>{form.error}</span>
			</div>
		{/if}

		{#if form?.success}
			<div class='alert alert-success'>
				<svg xmlns='http://www.w3.org/2000/svg' class='stroke-current shrink-0 h-6 w-6' fill='none' viewBox='0 0 24 24'>
					<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' />
				</svg>
				<span>{form.action === 'update' ? '更新しました' : '追加しました'}</span>
			</div>
		{/if}

		<!-- 日別勤怠一覧 -->
		<div class='card bg-base-100 shadow-xl'>
			<div class='card-body p-4'>
				<h2 class='card-title text-lg mb-4'>日別勤怠記録</h2>

				{#if data.detail.daily_attendances.length === 0}
					<div class='text-center py-8 text-base-content/50'>
						<svg xmlns='http://www.w3.org/2000/svg' class='h-12 w-12 mx-auto mb-2' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
							<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' />
						</svg>
						<p>この月の勤怠データはありません</p>
					</div>
				{:else}
					<div class='overflow-x-auto'>
						<table class='table'>
							<thead>
								<tr>
									<th class='w-8'></th>
									<th>日付</th>
									<th>出勤</th>
									<th>退勤</th>
									<th>勤務時間</th>
									<th>操作</th>
								</tr>
							</thead>
							<tbody>
								{#each data.detail.daily_attendances as daily}
									{@const hasRecords = daily.records && daily.records.length > 0}
									{@const isExpanded = expandedDates.has(daily.date)}
									<tr class={getDayClass(daily.date)}>
										<td>
											{#if hasRecords}
												<button
													class='btn btn-ghost btn-xs'
													onclick={() => toggleDate(daily.date)}
												>
													<svg
														xmlns='http://www.w3.org/2000/svg'
														class='h-4 w-4 transition-transform {isExpanded ? 'rotate-90' : ''}'
														fill='none'
														viewBox='0 0 24 24'
														stroke='currentColor'
													>
														<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M9 5l7 7-7 7' />
													</svg>
												</button>
											{/if}
										</td>
										<td class='font-medium'>
											{formatDate(daily.date)}
										</td>
										<td class='font-mono'>
											{formatTime(daily.clock_in)}
										</td>
										<td class='font-mono'>
											{formatTime(daily.clock_out)}
										</td>
										<td>
											{formatWorkingTime(daily.working_minutes)}
										</td>
										<td>
											<button
												class='btn btn-ghost btn-xs'
												onclick={() => openAddModal(daily.date)}
											>
												+追加
											</button>
										</td>
									</tr>
									{#if isExpanded && hasRecords}
										<tr>
											<td colspan='6' class='bg-base-200/50 p-0'>
												<div class='p-4'>
													<table class='table table-sm'>
														<thead>
															<tr>
																<th>時刻</th>
																<th>種別</th>
																<th>ソース</th>
																<th>備考</th>
																<th>操作</th>
															</tr>
														</thead>
														<tbody>
															{#each daily.records as record}
																<tr>
																	<td class='font-mono text-sm'>
																		{formatDateTime(record.timestamp)}
																	</td>
																	<td>
																		<span class='badge badge-sm {getTypeBadgeClass(record.type)}'>
																			{getTypeLabel(record.type)}
																		</span>
																	</td>
																	<td class='text-sm text-base-content/70'>
																		{getSourceLabel(record.source)}
																	</td>
																	<td class='text-sm max-w-xs truncate'>
																		{record.note || '-'}
																	</td>
																	<td>
																		<button
																			class='btn btn-ghost btn-xs'
																			onclick={() => openEditModal(record)}
																		>
																			編集
																		</button>
																	</td>
																</tr>
															{/each}
														</tbody>
													</table>
												</div>
											</td>
										</tr>
									{/if}
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<!-- 新規追加モーダル -->
{#if showAddModal}
	<dialog class='modal modal-open'>
		<div class='modal-box'>
			<h3 class='font-bold text-lg'>打刻を追加</h3>
			<form method='POST' action='?/adminClock' use:enhance>
				<div class='form-control mt-4'>
					<label class='label' for='add-type'>
						<span class='label-text'>種別</span>
					</label>
					<select
						id='add-type'
						name='type'
						class='select select-bordered'
						bind:value={newType}
						required
					>
						<option value='CLOCK_IN'>出勤</option>
						<option value='CLOCK_OUT'>退勤</option>
						<option value='ADJUSTMENT'>調整</option>
					</select>
				</div>

				<div class='form-control mt-4'>
					<label class='label' for='add-timestamp'>
						<span class='label-text'>日時</span>
					</label>
					<input
						id='add-timestamp'
						type='datetime-local'
						name='timestamp'
						class='input input-bordered'
						bind:value={newTimestamp}
						required
					/>
				</div>

				<div class='form-control mt-4'>
					<label class='label' for='add-note'>
						<span class='label-text'>備考</span>
					</label>
					<textarea
						id='add-note'
						name='note'
						class='textarea textarea-bordered'
						bind:value={newNote}
						placeholder='任意'
					></textarea>
				</div>

				<div class='modal-action'>
					<button type='button' class='btn btn-ghost' onclick={closeModals}>
						キャンセル
					</button>
					<button type='submit' class='btn btn-primary'>
						追加
					</button>
				</div>
			</form>
		</div>
		<form method='dialog' class='modal-backdrop'>
			<button type='button' onclick={closeModals}>閉じる</button>
		</form>
	</dialog>
{/if}

<!-- 編集モーダル -->
{#if showEditModal && editingRecord}
	<dialog class='modal modal-open'>
		<div class='modal-box'>
			<h3 class='font-bold text-lg'>打刻を編集</h3>
			<form method='POST' action='?/updateAttendance' use:enhance>
				<input type='hidden' name='id' value={editingRecord.id} />

				<div class='form-control mt-4'>
					<label class='label'>
						<span class='label-text'>種別</span>
					</label>
					<input
						type='text'
						class='input input-bordered'
						value={getTypeLabel(editingRecord.type)}
						disabled
					/>
				</div>

				<div class='form-control mt-4'>
					<label class='label' for='edit-timestamp'>
						<span class='label-text'>日時</span>
					</label>
					<input
						id='edit-timestamp'
						type='datetime-local'
						name='timestamp'
						class='input input-bordered'
						bind:value={editTimestamp}
						required
					/>
				</div>

				<div class='form-control mt-4'>
					<label class='label' for='edit-note'>
						<span class='label-text'>備考</span>
					</label>
					<textarea
						id='edit-note'
						name='note'
						class='textarea textarea-bordered'
						bind:value={editNote}
						placeholder='任意'
					></textarea>
				</div>

				<div class='modal-action'>
					<button type='button' class='btn btn-ghost' onclick={closeModals}>
						キャンセル
					</button>
					<button type='submit' class='btn btn-primary'>
						更新
					</button>
				</div>
			</form>
		</div>
		<form method='dialog' class='modal-backdrop'>
			<button type='button' onclick={closeModals}>閉じる</button>
		</form>
	</dialog>
{/if}
