<script lang='ts'>
	const { data } = $props<{
		data: {
			summary: unknown | null
			events: { events: unknown[] } | null
			anomalies: { anomalies: unknown[] } | null
			error?: string
			hours: number
		}
	}>()

	const summary = $derived(data.summary)
	const events = $derived(data.events)
	const anomalies = $derived(data.anomalies)
	const error = $derived(data.error ?? '')
	let hours = $state(data.hours ?? 24)

	function link(h: number) {
		const q = new URLSearchParams()
		q.set('hours', String(h))
		return `?${q.toString()}`
	}

	let tab = $state<'overview' | 'events' | 'anomalies'>('overview')
</script>

<svelte:head>
	<title>IP Trust Dashboard - 開発者ツール - FOX HOUND</title>
	<meta name='robots' content='noindex' />
</svelte:head>

<div class='container mx-auto px-4 py-8'>
	<div class='mb-6 flex items-center gap-3'>
		<span class='text-3xl'>🛡️</span>
		<h1 class='text-2xl font-bold'>IP Trust Dashboard</h1>
	</div>

	<div class='flex items-center gap-3 mb-4'>
		<a class='btn btn-sm' href='/dev_tools'>← 開発者ツール</a>
		<span class='text-sm opacity-70'>対象期間</span>
		<select class='select select-sm select-bordered' bind:value={hours} onchange={(e) => { const v = Number((e.target as HTMLSelectElement).value); location.href = link(v) }}>
			<option value='6'>6時間</option>
			<option value='12'>12時間</option>
			<option value='24'>24時間</option>
			<option value='48'>48時間</option>
			<option value='72'>72時間</option>
		</select>
	</div>

	<div role='tablist' class='tabs tabs-boxed mb-4'>
		<button role='tab' class='tab' class:tab-active={tab === 'overview'} onclick={() => tab = 'overview'}>Overview</button>
		<button role='tab' class='tab' class:tab-active={tab === 'events'} onclick={() => tab = 'events'}>Events</button>
		<button role='tab' class='tab' class:tab-active={tab === 'anomalies'} onclick={() => tab = 'anomalies'}>Anomalies</button>
	</div>

	{#if error}
		<div class='alert alert-error mb-4'><span>{error}</span></div>
	{/if}

	{#if tab === 'overview'}
		<div class='mb-3'><span class='badge badge-outline'>source: events (auth)</span></div>
		{#if summary}
			{#if summary.total_events === 0}
				<div class='alert mb-4'><span>データなし（期間内のイベントがありません）</span></div>
			{/if}
			<div class='stats bg-base-100 shadow mb-4'>
				<div class='stat'>
					<div class='stat-title'>イベント総数</div>
					<div class='stat-value'>{summary.total_events}</div>
					<div class='stat-desc'>{summary.window_hours}h</div>
				</div>
				<div class='stat'>
					<div class='stat-title'>Critical</div>
					<div class='stat-value text-error'>{summary.severity_counts.critical}</div>
				</div>
				<div class='stat'>
					<div class='stat-title'>High</div>
					<div class='stat-value text-warning'>{summary.severity_counts.high}</div>
				</div>
			</div>

			{#if summary.by_flag.length}
				<div class='bg-base-100 rounded-box shadow p-3 mb-6'>
					<h2 class='font-semibold mb-2'>フラグ別内訳</h2>
					<div class='flex flex-wrap gap-2'>
						{#each summary.by_flag as f}
							<span class='badge badge-outline'>{f.flag}: {f.count}</span>
						{/each}
					</div>
				</div>
			{/if}

			<div class='bg-base-100 rounded-box shadow overflow-x-auto'>
				<table class='table table-sm'>
					<thead>
						<tr>
							<th>IP</th><th>件数</th><th>平均スコア</th><th>Severity</th>
						</tr>
					</thead>
					<tbody>
						{#each summary.top_ips as ip}
							<tr>
								<td class='font-mono text-xs'>{ip.ip}</td>
								<td>{ip.count}</td>
								<td>{ip.avg_score}</td>
								<td>{ip.severity}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/if}

	{#if tab === 'events'}
		<div class='mb-3'><span class='badge badge-outline'>source: events (auth)</span></div>
		{#if events}
			{#if events.events.length === 0}
				<div class='alert mb-4'><span>データなし（期間内のイベントがありません）</span></div>
			{/if}
			<div class='bg-base-100 rounded-box shadow overflow-x-auto'>
				<table class='table table-sm'>
					<thead>
						<tr>
							<th>時刻</th><th>ユーザー</th><th>IP</th><th>国/都市</th><th>score</th><th>flags</th>
						</tr>
					</thead>
					<tbody>
						{#each events.events.slice(0, 200) as e}
							{@const event = e as Record<string, unknown>}
							<tr>
								<td class='text-xs'>{new Date(event.created_at as string).toLocaleString('ja-JP')}</td>
								<td class='text-xs font-mono'>{typeof event.user_id === 'string' ? event.user_id.slice(0, 8) : '-'}</td>
								<td class='text-xs font-mono'>{typeof event.ip_address === 'string' ? event.ip_address : '-'}</td>
								<td class='text-xs'>{typeof event.country === 'string' ? event.country : '-'} / {typeof event.city === 'string' ? event.city : '-'}</td>
								<td>{typeof event.score === 'number' ? event.score : '-'}</td>
								<td class='text-xs'>{Array.isArray(event.flags) ? (event.flags as string[]).slice(0, 3).join(', ') : ''}{#if Array.isArray(event.flags) && event.flags.length > 3}<span class='opacity-60'> 他 {event.flags.length - 3}</span>{/if}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/if}

	{#if tab === 'anomalies'}
		<div class='mb-3'><span class='badge badge-outline'>source: anomalies (auth)</span></div>
		{#if anomalies}
			{#if anomalies.anomalies.length === 0}
				<div class='alert mb-4'><span>データなし（期間内の異常はありません）</span></div>
			{/if}
			<div class='bg-base-100 rounded-box shadow overflow-x-auto'>
				<table class='table table-sm'>
					<thead>
						<tr>
							<th>検出</th><th>ユーザー</th><th>タイプ</th><th>severity</th><th>score</th>
						</tr>
					</thead>
					<tbody>
						{#each anomalies.anomalies.slice(0, 200) as a}
							{@const anomaly = a as Record<string, unknown>}
							<tr>
								<td class='text-xs'>{new Date(typeof anomaly.detected_at === 'string' ? anomaly.detected_at : Date.now()).toLocaleString('ja-JP')}</td>
								<td class='text-xs font-mono'>{typeof anomaly.user_id === 'string' ? anomaly.user_id.slice(0, 8) : '-'}</td>
								<td>{typeof anomaly.anomaly_type === 'string' ? anomaly.anomaly_type : '-'}</td>
								<td>{typeof anomaly.severity === 'string' ? anomaly.severity : '-'}</td>
								<td>{typeof anomaly.risk_score === 'number' ? anomaly.risk_score : '-'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/if}
</div>
