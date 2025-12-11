<script lang='ts'>
	import type { users } from '$lib/generated/client'
	import type { ConnectionStatus } from '$lib/notifications/types'
	import notificationCenter from '$lib/notifications/store'

	const props = $props<{ profile: users.UserProfile | null }>()
	const statusStore = notificationCenter.status
	const lastReceivedStore = notificationCenter.lastReceivedAt
	const unreadCountStore = notificationCenter.unreadCount
	const extraChannelsStore = notificationCenter.channels

	const statusLabels: Record<ConnectionStatus, string> = {
		idle: '未接続',
		connecting: '接続中',
		open: '接続済み',
		reconnecting: '再接続中',
		error: 'エラー',
		closed: '切断',
	}

	function formatTimestamp(value: string | null) {
		if (!value)
			return '未受信'
		try {
			return new Date(value).toLocaleString('ja-JP', { hour12: false })
		} catch (error) {
			console.error('[notifications] timestamp format failed', error)
			return value
		}
	}

	function handleReconnect() {
		notificationCenter.reconnect()
	}

	const connectionStatus = $derived($statusStore)
	const statusLabel = $derived(statusLabels[connectionStatus] ?? '未接続')
	const lastReceivedDisplay = $derived(formatTimestamp($lastReceivedStore))
	const unreadCount = $derived($unreadCountStore)
	const extraChannels = $derived($extraChannelsStore)
	const baseChannels = $derived(buildBaseChannels(props.profile))
	const allChannels = $derived(mergeChannels(baseChannels, extraChannels))
	const roleLabel = $derived(props.profile?.role?.name ?? 'user')

	function buildBaseChannels(profile: users.UserProfile | null): string[] {
		if (!profile)
			return []
		const channels = new Set<string>()
		channels.add(`user-${profile.id}`)
		channels.add('all-users')
		const roleName = profile.role?.name?.toLowerCase()
		if (roleName === 'admin' || roleName === 'super_user') {
			channels.add('admin-dashboard')
		}
		return Array.from(channels)
	}

	function mergeChannels(base: string[], extra: string[]): string[] {
		const merged = new Set<string>(base)
		for (const channel of extra ?? []) {
			if (channel)
				merged.add(channel)
		}
		return Array.from(merged)
	}

	function formatChannelName(channel: string): string {
		if (channel.startsWith('user-')) {
			return `個別: ${channel.slice('user-'.length)}`
		}
		if (channel === 'all-users') {
			return '全員'
		}
		if (channel === 'admin-dashboard') {
			return '運用（管理者向け）'
		}
		return channel
	}
</script>

<div class='grid gap-6'>
	<div class='card bg-base-100 shadow-xl border border-base-300'>
		<div class='card-body gap-4'>
			<div class='flex flex-col md:flex-row md:items-center md:justify-between gap-4'>
				<div>
					<h2 class='card-title text-lg'>通知ステータス</h2>
					<p class='text-sm text-base-content/60'>
						自分宛の通知ストリームの接続状態と最後に受信したタイムスタンプを確認できます。
					</p>
					<p class='text-xs text-base-content/50 mt-1'>
						現在のロール: {roleLabel}
					</p>
				</div>
				<div class='join'>
					<button type='button' class='btn btn-outline btn-sm join-item' onclick={handleReconnect}>
						再接続
					</button>
				</div>
			</div>

			<div class='stats stats-vertical md:stats-horizontal shadow-sm bg-base-200/60'>
				<div class='stat'>
					<div class='stat-title text-xs'>接続ステータス</div>
					<div class='stat-value text-lg'>{statusLabel}</div>
					<div class='stat-desc'>サーバーとの SSE 状態</div>
				</div>
				<div class='stat'>
					<div class='stat-title text-xs'>未読件数</div>
					<div class='stat-value text-lg'>{unreadCount}</div>
					<div class='stat-desc'>ヘッダー通知ベルの現在の未読数</div>
				</div>
				<div class='stat'>
					<div class='stat-title text-xs'>最終受信時刻</div>
					<div class='stat-value text-sm'>{lastReceivedDisplay}</div>
					<div class='stat-desc'>直近で通知を受信したタイミング</div>
				</div>
			</div>

			<div class='mt-4'>
				<h3 class='font-semibold text-sm text-base-content/70'>購読中チャネル</h3>
				{#if allChannels.length === 0}
					<p class='text-sm text-base-content/50 mt-2'>
						現在、有効なチャネルはありません。ダッシュボードの通知ベルを開くと自動接続されます。
					</p>
				{:else}
					<ul class='mt-2 space-y-1 text-sm'>
						{#each allChannels as channel (channel)}
							<li class='flex items-center gap-2'>
								<span class='badge badge-outline badge-sm'>{formatChannelName(channel)}</span>
								<span class='text-base-content/60 text-xs'>ID: {channel}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<div class='alert alert-info bg-info/10 border border-info/40'>
				<span>
					通知は個別宛（複数ユーザーIDをまとめて指定可能）と全体配信が基本です。任意の集団に送りたい場合は、対象ユーザーをアプリケーション側で選択し、通知作成時に個別宛先として渡してください。
				</span>
			</div>
		</div>
	</div>

	<div class='card bg-base-100 shadow-xl border border-dashed border-base-300'>
		<div class='card-body items-center text-center gap-4'>
			<h2 class='card-title text-lg'>通知設定 (Coming Soon)</h2>
			<p class='text-sm text-base-content/70'>
				チャネルごとのオン/オフや優先度フィルタは次フェーズで提供予定です。準備が整い次第、ここから設定を変更できるようになります。
			</p>
			<div class='badge badge-outline'>開発中</div>
		</div>
	</div>
</div>
