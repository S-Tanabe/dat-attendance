<script lang='ts'>
	import { enhance } from '$app/forms'
	import { goto } from '$app/navigation'

	interface User {
		id: string
		email: string
		display_name: string
		role: string
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

	interface PageData {
		users: User[]
		records: AttendanceRecord[]
		total: number
		filters: {
			userId?: string
			from: string
			to: string
			type?: string
		}
	}

	const { data, form } = $props<{
		data: PageData
		form: { success?: boolean, error?: string, action?: string } | null
	}>()

	// フィルター状態
	let selectedUserId = $state(data.filters.userId || '')
	let fromDate = $state(data.filters.from)
	let toDate = $state(data.filters.to)
	let selectedType = $state(data.filters.type || '')

	// モーダル状態
	let showAddModal = $state(false)
	let showEditModal = $state(false)
	let editingRecord = $state<AttendanceRecord | null>(null)

	// 新規追加フォーム
	let newUserId = $state('')
	let newType = $state<'CLOCK_IN' | 'CLOCK_OUT' | 'ADJUSTMENT'>('CLOCK_IN')
	let newTimestamp = $state('')
	let newNote = $state('')

	// 編集フォーム
	let editTimestamp = $state('')
	let editNote = $state('')

	// ユーザー名取得
	function getUserName(userId: string): string {
		const user = data.users.find((u: User) => u.id === userId)
		return user ? user.display_name : userId
	}

	// フィルター適用
	function applyFilters() {
		const params = new URLSearchParams()
		if (selectedUserId)
			params.set('user_id', selectedUserId)
		if (fromDate)
			params.set('from', fromDate)
		if (toDate)
			params.set('to', toDate)
		if (selectedType)
			params.set('type', selectedType)
		void goto(`?${params.toString()}`)
	}

	// フィルターリセット
	function resetFilters() {
		selectedUserId = ''
		selectedType = ''
		const now = new Date()
		const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1)
		const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0)
		fromDate = formatDate(defaultFrom)
		toDate = formatDate(defaultTo)
		void goto('/attendance')
	}

	// 日付フォーマット
	function formatDate(date: Date): string {
		const year = date.getFullYear()
		const month = String(date.getMonth() + 1).padStart(2, '0')
		const day = String(date.getDate()).padStart(2, '0')
		return `${year}-${month}-${day}`
	}

	// 日時フォーマット（表示用）
	function formatDateTime(timestamp: string): string {
		const date = new Date(timestamp)
		return date.toLocaleString('ja-JP', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
		})
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

	// 新規追加モーダルを開く
	function openAddModal() {
		newUserId = ''
		newType = 'CLOCK_IN'
		newTimestamp = new Date().toISOString().slice(0, 16)
		newNote = ''
		showAddModal = true
	}

	// 編集モーダルを開く
	function openEditModal(record: AttendanceRecord) {
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
	<title>出退勤管理 - DAT Attendance</title>
</svelte:head>

<div class='flex flex-col space-y-4'>
	<!-- ヘッダー -->
	<div class='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4'>
		<div>
			<h1 class='text-2xl font-bold'>出退勤管理</h1>
			<p class='text-sm text-base-content/70'>全ユーザーの出退勤記録を管理します</p>
		</div>
		<button class='btn btn-primary' onclick={openAddModal}>
			<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
				<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 4v16m8-8H4' />
			</svg>
			打刻を追加
		</button>
	</div>

	<!-- フィルター -->
	<div class='card bg-base-100 shadow-xl'>
		<div class='card-body p-4'>
			<h2 class='card-title text-lg'>フィルター</h2>
			<div class='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4'>
				<!-- ユーザー選択 -->
				<div class='form-control'>
					<label class='label' for='filter-user'>
						<span class='label-text'>ユーザー</span>
					</label>
					<select
						id='filter-user'
						class='select select-bordered select-sm'
						bind:value={selectedUserId}
					>
						<option value=''>全員</option>
						{#each data.users as user}
							<option value={user.id}>{user.display_name}</option>
						{/each}
					</select>
				</div>

				<!-- 開始日 -->
				<div class='form-control'>
					<label class='label' for='filter-from'>
						<span class='label-text'>開始日</span>
					</label>
					<input
						id='filter-from'
						type='date'
						class='input input-bordered input-sm'
						bind:value={fromDate}
					/>
				</div>

				<!-- 終了日 -->
				<div class='form-control'>
					<label class='label' for='filter-to'>
						<span class='label-text'>終了日</span>
					</label>
					<input
						id='filter-to'
						type='date'
						class='input input-bordered input-sm'
						bind:value={toDate}
					/>
				</div>

				<!-- タイプ選択 -->
				<div class='form-control'>
					<label class='label' for='filter-type'>
						<span class='label-text'>種別</span>
					</label>
					<select
						id='filter-type'
						class='select select-bordered select-sm'
						bind:value={selectedType}
					>
						<option value=''>すべて</option>
						<option value='CLOCK_IN'>出勤</option>
						<option value='CLOCK_OUT'>退勤</option>
						<option value='ADJUSTMENT'>調整</option>
					</select>
				</div>

				<!-- 検索ボタン -->
				<div class='form-control justify-end'>
					<div class='join'>
						<button class='join-item btn btn-primary btn-sm' onclick={applyFilters}>
							検索
						</button>
						<button class='join-item btn btn-ghost btn-sm' onclick={resetFilters}>
							リセット
						</button>
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

	<!-- 記録一覧 -->
	<div class='card bg-base-100 shadow-xl'>
		<div class='card-body p-4'>
			<div class='flex justify-between items-center'>
				<h2 class='card-title text-lg'>
					打刻記録
					<span class='badge badge-ghost'>{data.total}件</span>
				</h2>
			</div>

			{#if data.records.length === 0}
				<div class='text-center py-8 text-base-content/50'>
					<svg xmlns='http://www.w3.org/2000/svg' class='h-12 w-12 mx-auto mb-2' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
						<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' />
					</svg>
					<p>この期間の打刻データはありません</p>
				</div>
			{:else}
				<div class='overflow-x-auto'>
					<table class='table table-zebra'>
						<thead>
							<tr>
								<th>日時</th>
								<th>ユーザー</th>
								<th>種別</th>
								<th>ソース</th>
								<th>備考</th>
								<th>操作</th>
							</tr>
						</thead>
						<tbody>
							{#each data.records as record}
								<tr>
									<td class='font-mono text-sm'>
										{formatDateTime(record.timestamp)}
									</td>
									<td>{getUserName(record.user_id)}</td>
									<td>
										<span class='badge {getTypeBadgeClass(record.type)}'>
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
			{/if}
		</div>
	</div>
</div>

<!-- 新規追加モーダル -->
{#if showAddModal}
	<dialog class='modal modal-open'>
		<div class='modal-box'>
			<h3 class='font-bold text-lg'>打刻を追加</h3>
			<form method='POST' action='?/adminClock' use:enhance>
				<div class='form-control mt-4'>
					<label class='label' for='add-user'>
						<span class='label-text'>ユーザー</span>
					</label>
					<select
						id='add-user'
						name='user_id'
						class='select select-bordered'
						bind:value={newUserId}
						required
					>
						<option value='' disabled>選択してください</option>
						{#each data.users as user}
							<option value={user.id}>{user.display_name}</option>
						{/each}
					</select>
				</div>

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
						<span class='label-text'>ユーザー</span>
					</label>
					<input
						type='text'
						class='input input-bordered'
						value={getUserName(editingRecord.user_id)}
						disabled
					/>
				</div>

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
