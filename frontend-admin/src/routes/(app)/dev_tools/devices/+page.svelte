<script lang='ts'>
	import type { dev_tools } from '$lib/generated/client'
	import { enhance } from '$app/forms'
	import { goto } from '$app/navigation'
	import { useEnhance } from '$lib/utils/forms'

	const { data, form } = $props()

	type Summary = dev_tools.DeviceListResponse['summary']
	type Device = dev_tools.DeviceListResponse['devices'][number]

	// Runes: data 更新に追従するように $derived 化
	const devices = $derived((data.devices ?? []) as Device[])
	const summary = $derived((data.summary ?? null) as Summary | null)
	const page = $derived((data.page ?? 1) as number)
	const limit = $derived((data.limit ?? 20) as number)
	const filter = $derived((data.filter ?? 'all') as 'all' | 'trusted' | 'untrusted' | 'suspicious')
	const currentUserId = $derived((data.currentUserId ?? '') as string)

	// SSR安全: リンクは相対クエリのみを使用し、location参照はしない
	const link = (p: Record<string, string | number>) => `?filter=${p.filter ?? filter}&page=${p.page ?? page}&limit=${p.limit ?? limit}`

	let modalOpen = $state(false)
	let pendingAction = $state<'trust' | 'untrust' | 'remove' | 'revoke'>('trust')
	let selected = $state<Device | null>(null)

	function openConfirm(action: 'trust' | 'untrust' | 'remove' | 'revoke', d: Device) {
		pendingAction = action
		selected = d
		modalOpen = true
	}

	const onConfirm = useEnhance({
		successMessage: 'デバイスの状態を更新しました',
		invalidateDeps: ['app:dev_tools:devices'],
	})

	$effect(() => {
		// フォームアクションが成功したらモーダルを閉じる
		if (form?.success) {
			modalOpen = false
			selected = null
			// 自分のデバイスを revoke/remove した事後は、整合性のため即時リロード（SSRガードでログアウト）
			if (form?.selfAffected && (pendingAction === 'revoke' || pendingAction === 'remove')) {
				location.reload()
			}
		}
	})
</script>

<svelte:head>
	<title>デバイス管理（READ） - 開発者ツール - FOX HOUND</title>
	<meta name='robots' content='noindex' />
</svelte:head>

<div class='container mx-auto px-4 py-8'>
	<div class='mb-6'>
		<div class='flex items-center gap-3 mb-3'>
			<span class='text-3xl'>📱</span>
			<h1 class='text-2xl font-bold'>デバイス管理（READ）</h1>
		</div>
		<p class='text-base-content/70'>ユーザーのログインデバイス状況を参照します（super_admin限定）。</p>
	</div>

	<!-- 概要カード -->
	{#if summary}
		<div class='stats stats-vertical lg:stats-horizontal shadow bg-base-100'>
			<div class='stat'>
				<div class='stat-title'>総デバイス数</div>
				<div class='stat-value'>{summary.total_devices}</div>
			</div>
			<div class='stat'>
				<div class='stat-title'>信頼済み</div>
				<div class='stat-value text-success'>{summary.trusted_devices}</div>
			</div>
			<div class='stat'>
				<div class='stat-title'>未信頼</div>
				<div class='stat-value text-warning'>{summary.untrusted_devices}</div>
			</div>
			<div class='stat'>
				<div class='stat-title'>平均信頼スコア</div>
				<div class='stat-value text-primary'>{summary.avg_trust_score}</div>
			</div>
		</div>
	{/if}

	<!-- フィルタ -->
	<div class='mt-6 flex items-center gap-2'>
		<span class='text-sm opacity-70'>フィルタ:</span>
		<a class="btn btn-sm {filter === 'all' ? 'btn-active' : ''}" href={link({ filter: 'all', page: 1, limit })}>すべて</a>
		<a class="btn btn-sm {filter === 'trusted' ? 'btn-active' : ''}" href={link({ filter: 'trusted', page: 1, limit })}>信頼</a>
		<a class="btn btn-sm {filter === 'untrusted' ? 'btn-active' : ''}" href={link({ filter: 'untrusted', page: 1, limit })}>未信頼</a>
		<a class="btn btn-sm {filter === 'suspicious' ? 'btn-active' : ''}" href={link({ filter: 'suspicious', page: 1, limit })}>要注意</a>
		<div class='ml-auto'></div>
		<label class='label text-sm' for='device-limit'>表示件数</label>
		<select
			id='device-limit'
			class='select select-sm select-bordered'
			onchange={(e) => goto(link({ filter, page: 1, limit: (e.target as HTMLSelectElement).value }))}
		>
			<option value='10' selected={limit === 10}>10</option>
			<option value='20' selected={limit === 20}>20</option>
			<option value='50' selected={limit === 50}>50</option>
		</select>
	</div>

	<!-- 一覧テーブル -->
	<div class='mt-4 overflow-x-auto bg-base-100 rounded-box shadow'>
		<table class='table table-sm'>
			<thead>
				<tr>
					<th>Device ID</th>
					<th>ユーザー</th>
					<th>名称</th>
					<th>信頼</th>
					<th>最終確認</th>
					<th>アクティブセッション</th>
				</tr>
			</thead>
			<tbody>
				{#if devices.length === 0}
					<tr><td colspan='5' class='text-center opacity-60'>該当デバイスはありません</td></tr>
				{:else}
					{#each devices as d}
						<tr>
							<td class='font-mono text-xs break-all'>{d.device_id}</td>
							<td class='text-xs'>{d.user_email}</td>
							<td>{d.device_name}</td>
							<td>
								{#if d.trusted}
									<span class='badge badge-success'>trusted</span>
								{:else}
									<span class='badge'>untrusted</span>
								{/if}
							</td>
							<td>{new Date(d.last_seen_at).toLocaleString('ja-JP')}</td>
							<td class='flex items-center gap-2'>
								<span>{d.sessions_count ?? 0}</span>
								<div class='ml-auto flex gap-2'>
									{#if d.trusted}
										<button class='btn btn-xs' onclick={() => openConfirm('untrust', d)}>未信頼にする</button>
									{:else}
										<button class='btn btn-xs btn-success' onclick={() => openConfirm('trust', d)}>信頼にする</button>
									{/if}
									<button class='btn btn-xs btn-warning' onclick={() => openConfirm('revoke', d)}>セッション無効化</button>
									<button class='btn btn-xs btn-error' onclick={() => openConfirm('remove', d)}>削除</button>
								</div>
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>

	<!-- ページング -->
	<div class='mt-4 flex items-center justify-between'>
		<a class='btn btn-sm' aria-disabled={page <= 1} href={page > 1 ? link({ filter, page: page - 1, limit }) : undefined}>前へ</a>
		<span class='text-sm opacity-70'>Page {page}</span>
		<a class='btn btn-sm' href={link({ filter, page: page + 1, limit })}>次へ</a>
	</div>

	<!-- 確認モーダル -->
	{#if modalOpen && selected}
		<dialog open class='modal'>
			<div class='modal-box'>
				<h3 class='font-bold text-lg'>確認</h3>
				<p class='py-4'>
					{#if pendingAction === 'trust'}
						デバイス「{selected.device_name}」({selected.device_id}) を <b>信頼済み</b> に設定します。よろしいですか？
					{:else if pendingAction === 'untrust'}
						デバイス「{selected.device_name}」({selected.device_id}) を <b>未信頼</b> に設定します。よろしいですか？
					{:else if pendingAction === 'revoke'}
						デバイス「{selected.device_name}」({selected.device_id}) の <b>全セッションを無効化</b> します。よろしいですか？
					{:else}
						デバイス「{selected.device_name}」({selected.device_id}) を <b>削除</b> します。関連セッションは無効化されます。よろしいですか？
					{/if}
				</p>
				{#if selected.user_id === currentUserId && (pendingAction === 'revoke' || pendingAction === 'remove')}
					<div class='alert alert-warning'>
						この操作により<b>現在のログイン状態は解除</b>されます。続行しますか？
					</div>
				{/if}
				<div class='modal-action'>
					<button class='btn' type='button' onclick={() => { modalOpen = false }}>キャンセル</button>
					<form method='POST' action={`?/${pendingAction}`} use:enhance={onConfirm}>
						<input type='hidden' name='device_id' value={selected.device_id} />
						<input type='hidden' name='user_id' value={selected.user_id} />
						<button type='submit' class='btn btn-primary'>実行</button>
					</form>
				</div>
			</div>
		</dialog>
	{/if}
</div>
