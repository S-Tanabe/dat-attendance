<script lang='ts'>
	import type { attendance } from '$lib/generated/client'

	interface PageData {
		summaries: attendance.UserAttendanceSummary[]
		total: number
	}

	const { data } = $props<{
		data: PageData
	}>()

	// ステータスラベル
	function getStatusLabel(status: string): string {
		switch (status) {
			case 'NOT_CLOCKED_IN': return '未出勤'
			case 'WORKING': return '勤務中'
			case 'CLOCKED_OUT': return '退勤済'
			default: return status
		}
	}

	// ステータスバッジクラス
	function getStatusBadgeClass(status: string): string {
		switch (status) {
			case 'NOT_CLOCKED_IN': return 'badge-ghost'
			case 'WORKING': return 'badge-success'
			case 'CLOCKED_OUT': return 'badge-neutral'
			default: return 'badge-ghost'
		}
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

	// 勤務時間フォーマット（時間と分）
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
</script>

<svelte:head>
	<title>勤怠管理 - DAT Attendance</title>
</svelte:head>

<div class='flex flex-col space-y-4'>
	<!-- ヘッダー -->
	<div class='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4'>
		<div>
			<h1 class='text-2xl font-bold'>勤怠管理</h1>
			<p class='text-sm text-base-content/70'>ユーザー別の勤怠状況を確認・管理します</p>
		</div>
	</div>

	<!-- 今日の日付 -->
	<div class='card bg-base-100 shadow-xl'>
		<div class='card-body p-4'>
			<div class='flex items-center gap-2'>
				<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5 text-primary' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
					<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' />
				</svg>
				<span class='font-medium'>
					{new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
				</span>
			</div>
		</div>
	</div>

	<!-- ユーザー一覧 -->
	<div class='card bg-base-100 shadow-xl'>
		<div class='card-body p-4'>
			<div class='flex justify-between items-center mb-4'>
				<h2 class='card-title text-lg'>
					ユーザー勤怠一覧
					<span class='badge badge-ghost'>{data.total}名</span>
				</h2>
			</div>

			{#if data.summaries.length === 0}
				<div class='text-center py-8 text-base-content/50'>
					<svg xmlns='http://www.w3.org/2000/svg' class='h-12 w-12 mx-auto mb-2' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
						<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' />
					</svg>
					<p>ユーザーが登録されていません</p>
				</div>
			{:else}
				<div class='overflow-x-auto'>
					<table class='table table-zebra'>
						<thead>
							<tr>
								<th>ユーザー</th>
								<th>今日のステータス</th>
								<th>出勤</th>
								<th>退勤</th>
								<th>今月の勤務時間</th>
								<th>勤務日数</th>
								<th>操作</th>
							</tr>
						</thead>
						<tbody>
							{#each data.summaries as summary}
								<tr>
									<td>
										<div class='flex items-center gap-3'>
											<div class='avatar placeholder'>
												<div class='bg-neutral text-neutral-content rounded-full w-10'>
													<span class='text-sm'>{summary.display_name.charAt(0)}</span>
												</div>
											</div>
											<div>
												<div class='font-bold'>{summary.display_name}</div>
												<div class='text-sm opacity-50'>{summary.email}</div>
											</div>
										</div>
									</td>
									<td>
										<span class='badge {getStatusBadgeClass(summary.today_status)}'>
											{getStatusLabel(summary.today_status)}
										</span>
									</td>
									<td class='font-mono'>
										{formatTime(summary.today_clock_in)}
									</td>
									<td class='font-mono'>
										{formatTime(summary.today_clock_out)}
									</td>
									<td>
										{formatWorkingTime(summary.month_total_minutes)}
									</td>
									<td>
										{summary.month_working_days}日
									</td>
									<td>
										<a
											href='/attendance/{summary.user_id}'
											class='btn btn-ghost btn-sm'
										>
											詳細
										</a>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	</div>

	<!-- 凡例 -->
	<div class='card bg-base-100 shadow-xl'>
		<div class='card-body p-4'>
			<h3 class='font-medium mb-2'>ステータスの説明</h3>
			<div class='flex flex-wrap gap-4'>
				<div class='flex items-center gap-2'>
					<span class='badge badge-ghost'>未出勤</span>
					<span class='text-sm text-base-content/70'>今日まだ出勤していない</span>
				</div>
				<div class='flex items-center gap-2'>
					<span class='badge badge-success'>勤務中</span>
					<span class='text-sm text-base-content/70'>出勤済み・退勤前</span>
				</div>
				<div class='flex items-center gap-2'>
					<span class='badge badge-neutral'>退勤済</span>
					<span class='text-sm text-base-content/70'>今日の勤務終了</span>
				</div>
			</div>
		</div>
	</div>
</div>
