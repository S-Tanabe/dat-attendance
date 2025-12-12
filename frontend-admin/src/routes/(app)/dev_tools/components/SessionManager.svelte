<script lang='ts'>
	import type { dev_tools } from '$lib/generated/client'
	import { enhance } from '$app/forms'
	import { useEnhance } from '$lib/utils/forms'

	// Runes: $props から受け取り
	const { stats, form } = $props<{
		stats: dev_tools.SessionStatsResponse | null
		form: unknown
	}>()

	// アクションの結果をローカルに保持（画面内の結果カード用）
	let cleanupResult = $state<dev_tools.CleanupResponse | null>(null)
	let expireResult = $state<dev_tools.ExpireSessionsResponse | null>(null)
	const loading = $state(false)

	// enhance: 成功時にinvalidateは親で設定済み依存キーを使う
	const onCleanup = useEnhance({ successMessage: 'クリーンアップを実行しました', invalidateDeps: ['app:dev_tools:sessions'] })
	const onExpire = useEnhance({ successMessage: '全セッションを期限切れにしました', invalidateDeps: ['app:dev_tools:sessions'] })
	const onRefresh = useEnhance({ invalidateDeps: ['app:dev_tools:sessions'] })

	$effect(() => {
		// アクション結果があれば反映
		if (typeof form === 'object' && form !== null) {
			if ('cleanupResult' in form && typeof form.cleanupResult === 'object' && form.cleanupResult !== null)
				cleanupResult = form.cleanupResult as dev_tools.CleanupResponse
			if ('expireResult' in form && typeof form.expireResult === 'object' && form.expireResult !== null)
				expireResult = form.expireResult as dev_tools.ExpireSessionsResponse
		}
	})
</script>

<div class='space-y-6'>
	<!-- 統計情報カード -->
	<div class='card bg-base-100 shadow'>
		<div class='card-body'>
			<h2 class='card-title'>セッション統計</h2>

			{#if loading}
				<div class='flex justify-center py-8'>
					<span class='loading loading-spinner loading-lg'></span>
				</div>
			{:else}
				<div class='stats stats-vertical lg:stats-horizontal shadow'>
					<div class='stat'>
						<div class='stat-title'>総セッション数</div>
						<div class='stat-value text-primary'>{stats?.summary.total_sessions ?? '-'}</div>
						<div class='stat-desc'>全期間</div>
					</div>

					<div class='stat'>
						<div class='stat-title'>アクティブ</div>
						<div class='stat-value text-success'>{stats?.summary.active_sessions ?? '-'}</div>
						<div class='stat-desc'>有効期限内</div>
					</div>

					<div class='stat'>
						<div class='stat-title'>期限切れ</div>
						<div class='stat-value text-warning'>{stats?.summary.expired_sessions ?? '-'}</div>
						<div class='stat-desc'>削除対象</div>
					</div>

					<div class='stat'>
						<div class='stat-title'>無効化済み</div>
						<div class='stat-value text-error'>{stats?.summary.revoked_sessions ?? '-'}</div>
						<div class='stat-desc'>ログアウト済み</div>
					</div>
				</div>

				<!-- ユーザー別セッション数 -->
				<div class='mt-6'>
					<h3 class='text-lg font-semibold mb-4'>アクティブセッション上位ユーザー</h3>
					<div class='overflow-x-auto'>
						<table class='table table-sm'>
							<thead>
								<tr>
									<th>Email</th>
									<th>セッション数</th>
								</tr>
							</thead>
							<tbody>
								{#if stats}
									{#each stats.top_users as user}
										<tr>
											<td>{user.email}</td>
											<td>{user.session_count}</td>
										</tr>
									{/each}
								{:else}
									<tr>
										<td colspan='2' class='text-base-content/60'>データがありません</td>
									</tr>
								{/if}
							</tbody>
						</table>
					</div>
				</div>

				<!-- クリーンアップ推奨 -->
				<div class='mt-6'>
					<h3 class='text-lg font-semibold mb-2'>クリーンアップ推奨</h3>
					<div class='alert alert-info'>
						<svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' class='stroke-current shrink-0 w-6 h-6'>
							<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'></path>
						</svg>
						<div>
							<p>削除可能なセッション:</p>
							<ul class='list-disc list-inside ml-4'>
								<li>期限切れ: {stats?.cleanup_recommendation.expired_to_clean ?? 0}件</li>
								<li>古い無効化済み: {stats?.cleanup_recommendation.revoked_to_clean ?? 0}件</li>
							</ul>
						</div>
					</div>
				</div>
			{/if}

			<div class='card-actions justify-end mt-4 space-x-2'>
				<form method='POST' action='?/refresh' use:enhance={onRefresh}>
					<button class='btn btn-primary' disabled={loading}>
						<svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke-width='1.5' stroke='currentColor' class='w-5 h-5'>
							<path stroke-linecap='round' stroke-linejoin='round' d='M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99' />
						</svg>
						更新
					</button>
				</form>
				<form method='POST' action='?/expire' use:enhance={onExpire}>
					<button class='btn btn-error' disabled={loading}>
						<svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke-width='1.5' stroke='currentColor' class='w-5 h-5'>
							<path stroke-linecap='round' stroke-linejoin='round' d='M12 9v3.75m-9.303 3.376c0 1.621 1.315 2.936 2.937 2.936h14.73c1.621 0 2.936-1.315 2.936-2.936 0-.906-.412-1.717-1.059-2.255l-7.37-6.129a2.936 2.936 0 00-3.742 0l-7.37 6.129c-.647.538-1.059 1.349-1.059 2.255zm9.303 5.814h.008v.008h-.008v-.008z' />
						</svg>
						全セッション強制期限切れ
					</button>
				</form>
				<form method='POST' action='?/cleanup' use:enhance={onCleanup}>
					<button class='btn btn-warning' disabled={loading}>
						<svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke-width='1.5' stroke='currentColor' class='w-5 h-5'>
							<path stroke-linecap='round' stroke-linejoin='round' d='M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0' />
						</svg>
						クリーンアップ実行
					</button>
				</form>
			</div>
		</div>
	</div>

	<!-- クリーンアップ結果 -->
	{#if cleanupResult}
		<div class='card bg-base-100 shadow'>
			<div class='card-body'>
				<h2 class='card-title'>クリーンアップ結果</h2>

				{#if cleanupResult.success}
					<div class='alert alert-success'>
						<svg xmlns='http://www.w3.org/2000/svg' class='stroke-current shrink-0 h-6 w-6' fill='none' viewBox='0 0 24 24'>
							<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' />
						</svg>
						<div>
							<h3 class='font-bold'>クリーンアップ完了</h3>
							<div class='text-sm'>
								<p>削除されたセッション:</p>
								<ul class='list-disc list-inside ml-4'>
									<li>期限切れ: {cleanupResult.deleted?.expired ?? 0}件</li>
									<li>古い無効化済み: {cleanupResult.deleted?.revoked ?? 0}件</li>
									<li>合計: {cleanupResult.deleted?.total ?? 0}件</li>
								</ul>
								<p class='mt-2'>残りのセッション:</p>
								<ul class='list-disc list-inside ml-4'>
									<li>総数: {cleanupResult.remaining?.total ?? 0}件</li>
									<li>アクティブ: {cleanupResult.remaining?.active ?? 0}件</li>
								</ul>
							</div>
						</div>
					</div>
				{:else}
					<div class='alert alert-error'>
						<svg xmlns='http://www.w3.org/2000/svg' class='stroke-current shrink-0 h-6 w-6' fill='none' viewBox='0 0 24 24'>
							<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' />
						</svg>
						<span>クリーンアップに失敗しました: {cleanupResult.error}</span>
					</div>
				{/if}

				<div class='text-sm text-base-content/70'>
					実行時刻: {new Date(cleanupResult.timestamp).toLocaleString('ja-JP')}
				</div>
			</div>
		</div>
	{/if}

	<!-- セッション期限切れ結果 -->
	{#if expireResult}
		<div class='card bg-base-100 shadow'>
			<div class='card-body'>
				<h2 class='card-title'>セッション期限切れ結果</h2>

				{#if expireResult.success}
					<div class='alert alert-warning'>
						<svg xmlns='http://www.w3.org/2000/svg' class='stroke-current shrink-0 h-6 w-6' fill='none' viewBox='0 0 24 24'>
							<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' />
						</svg>
						<div>
							<h3 class='font-bold'>セッション期限切れ完了</h3>
							<div class='text-sm'>
								<p>{expireResult.message}</p>
								<p class='mt-2'>影響を受けたセッション: {expireResult.affected}件</p>
							</div>
						</div>
					</div>
				{:else}
					<div class='alert alert-error'>
						<svg xmlns='http://www.w3.org/2000/svg' class='stroke-current shrink-0 h-6 w-6' fill='none' viewBox='0 0 24 24'>
							<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' />
						</svg>
						<span>セッション期限切れに失敗しました</span>
					</div>
				{/if}

				<div class='text-sm text-base-content/70'>
					実行時刻: {new Date(expireResult.timestamp).toLocaleString('ja-JP')}
				</div>
			</div>
		</div>
	{/if}
</div>
