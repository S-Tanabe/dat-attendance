<script lang='ts'>
	import type { users } from '$lib/generated/client'

	import type { ConnectionStatus, NotificationItem, NotificationScope } from '$lib/notifications/types'
	import { goto } from '$app/navigation'
	import notificationCenter from '$lib/notifications/store'

	const props = $props<{ user: users.UserProfile | null, onLogout: () => void }>()

	const notificationsStore = notificationCenter.notifications
	const unreadCountStore = notificationCenter.unreadCount
	const statusStore = notificationCenter.status
	const lastReceivedStore = notificationCenter.lastReceivedAt

	const statusLabels: Record<ConnectionStatus, string> = {
		idle: '未接続',
		connecting: '接続中…',
		open: '接続済み',
		reconnecting: '再接続中…',
		error: 'エラー',
		closed: '切断',
	}

	const priorityLabels: Record<NotificationItem['priority'], string> = {
		low: '低',
		normal: '通常',
		high: '高',
		urgent: '緊急',
	}

	const priorityClasses: Record<NotificationItem['priority'], string> = {
		low: 'badge badge-ghost',
		normal: 'badge badge-neutral',
		high: 'badge badge-warning',
		urgent: 'badge badge-error',
	}

	type NotificationFilter = 'all' | NotificationScope

	const filterOptions: { value: NotificationFilter, label: string }[] = [
		{ value: 'all', label: 'すべて' },
		{ value: 'self', label: '自分' },
		{ value: 'user', label: '個別（他者）' },
		{ value: 'broadcast', label: '全体' },
		{ value: 'admin', label: '運用' },
	]

	const scopeLabels: Record<NotificationScope, string> = {
		self: '自分',
		user: '個別',
		broadcast: '全体',
		admin: '運用',
		other: 'その他',
	}

	const scopeBadgeClasses: Record<NotificationScope, string> = {
		self: 'badge badge-primary badge-sm',
		user: 'badge badge-info badge-sm',
		broadcast: 'badge badge-neutral badge-sm',
		admin: 'badge badge-warning badge-sm',
		other: 'badge badge-ghost badge-sm',
	}

	let notificationDropdownOpen = $state(false)
	let activeFilter = $state<NotificationFilter>('all')

	function getDisplayInitials(): string {
		if (!props.user)
			return '--'
		if (props.user.first_name)
			return props.user.first_name[0].toUpperCase()
		if (props.user.last_name)
			return props.user.last_name[0].toUpperCase()
		if (props.user.first_name_romaji && props.user.last_name_romaji) {
			return `${props.user.first_name_romaji[0]}${props.user.last_name_romaji[0]}`.toUpperCase()
		}
		if (props.user.display_name)
			return props.user.display_name[0].toUpperCase()
		return '--'
	}

	async function handleUserSettings() {
		await goto('/user-settings')
	}

	function toggleNotificationDropdown() {
		notificationDropdownOpen = !notificationDropdownOpen
	}

	function handleNotificationFocusOut(event: FocusEvent) {
		const current = event.currentTarget as HTMLElement
		const next = event.relatedTarget as Node | null
		if (!next || !current.contains(next)) {
			notificationDropdownOpen = false
		}
	}

	function getPriorityBadgeClass(priority: NotificationItem['priority']) {
		return priorityClasses[priority] ?? 'badge'
	}

	function getPriorityLabel(priority: NotificationItem['priority']) {
		return priorityLabels[priority] ?? priority
	}

	function trimMessage(message: string) {
		return message.length > 96 ? `${message.slice(0, 93)}…` : message
	}

	function formatTimestamp(timestamp: string) {
		try {
			return new Date(timestamp).toLocaleString('ja-JP', {
				hour12: false,
			})
		} catch (error) {
			console.error('[notifications] timestamp format failed', error)
			return timestamp
		}
	}

	function reconnectStream() {
		notificationCenter.reconnect()
	}

	$effect(() => {
		if (notificationDropdownOpen) {
			notificationCenter.markAllRead()
		}
	})

	$effect(() => {
		const user = props.user
		if (!user) {
			notificationCenter.clear()
			notificationCenter.stop()
			return
		}

		const extraChannels: string[] = []
		const roleName = user.role?.name?.toLowerCase()
		if (roleName === 'admin' || roleName === 'super_user') {
			extraChannels.push('admin-dashboard')
		}

		notificationCenter.start({ channels: extraChannels, userId: user.id })
	})

	const connectionStatus = $derived($statusStore)
	const connectionLabel = $derived(statusLabels[connectionStatus] ?? '未接続')
	const lastReceivedDisplay = $derived(
		$lastReceivedStore ? formatTimestamp($lastReceivedStore) : '未受信',
	)
	const unreadCount = $derived($unreadCountStore)
	const notifications = $derived($notificationsStore)
	const hasNotifications = $derived(notifications.length > 0)
	const filteredNotifications = $derived(
		activeFilter === 'all'
			? notifications
			: notifications.filter((item) => item.scopes?.includes(activeFilter as NotificationScope)),
	)

	function getScopeLabel(scope: NotificationScope) {
		return scopeLabels[scope] ?? scope
	}

	function getScopeBadgeClass(scope: NotificationScope) {
		return scopeBadgeClasses[scope] ?? 'badge badge-ghost badge-sm'
	}
</script>

<div class='navbar bg-base-100 shadow-lg min-h-[4.5rem]'>
	<div class='flex-1'>
		<!-- タイトル部分は空（必要に応じて後で追加） -->
	</div>
	<div class='flex-none items-center gap-3 mr-3'>
		<div
			class={`dropdown dropdown-end ${notificationDropdownOpen ? 'dropdown-open' : ''}`}
			onfocusout={handleNotificationFocusOut}
		>
			<button
				type='button'
				class='btn btn-ghost btn-circle'
				onclick={toggleNotificationDropdown}
			>
				<div class='indicator'>
					{#if unreadCount > 0}
						<span class='indicator-item badge badge-error badge-xs'>{unreadCount}</span>
					{/if}
					<svg
						xmlns='http://www.w3.org/2000/svg'
						fill='none'
						viewBox='0 0 24 24'
						stroke-width='1.5'
						stroke='currentColor'
						class='w-6 h-6'
					>
						<path
							stroke-linecap='round'
							stroke-linejoin='round'
							d='M14.857 17.082a23.848 23.848 0 005.454-1.31 8.967 8.967 0 00-2.311-6.022V9.75a6 6 0 10-12 0v.7a8.967 8.967 0 01-2.311 6.022 23.848 23.848 0 005.454 1.31m12 0a3 3 0 11-5.714 0'
						/>
					</svg>
				</div>
			</button>
			<div class='mt-3 z-[60] w-96 card bg-base-100 shadow-xl dropdown-content'>
				<div class='card-body gap-3 p-4'>
					<div class='flex items-center justify-between'>
						<div>
							<p class='font-semibold text-base'>通知センター</p>
							<p class='text-xs text-base-content/60'>
								状態: {connectionLabel} / 最終受信: {lastReceivedDisplay}
							</p>
						</div>
						<button type='button' class='btn btn-ghost btn-xs' onclick={reconnectStream}>
							再接続
						</button>
					</div>

					<div class='divider my-1'></div>

					<div class='join join-sm w-full'>
						{#each filterOptions as option}
							<button
								type='button'
								class={`join-item btn btn-sm ${activeFilter === option.value ? 'btn-active' : 'btn-ghost'}`}
								onclick={() => activeFilter = option.value}
							>
								{option.label}
							</button>
						{/each}
					</div>

					{#if filteredNotifications.length === 0}
						<div class='flex flex-col items-center justify-center py-6 text-base-content/60 text-center px-3 space-y-1'>
							<svg
								xmlns='http://www.w3.org/2000/svg'
								fill='none'
								viewBox='0 0 24 24'
								stroke-width='1.5'
								stroke='currentColor'
								class='w-10 h-10 mb-2'
							>
								<path
									stroke-linecap='round'
									stroke-linejoin='round'
									d='M14.857 17.082a23.848 23.848 0 005.454-1.31 8.967 8.967 0 00-2.311-6.022V9.75a6 6 0 10-12 0v.7a8.967 8.967 0 01-2.311 6.022 23.848 23.848 0 005.454 1.31m12 0a3 3 0 11-5.714 0'
								/>
							</svg>
							<p class='text-sm'>{hasNotifications ? '選択中のフィルタに該当する通知はありません' : '新しい通知はありません'}</p>
							{#if hasNotifications}
								<p class='text-[11px] text-base-content/50'>別のフィルタを選択すると表示される場合があります。</p>
							{/if}
						</div>
					{:else}
						<div class='max-h-80 space-y-3 overflow-y-auto pr-1'>
							{#each filteredNotifications as item (item.dedupeKey)}
								<article class={`rounded-lg border border-base-300 p-3 ${item.read ? 'opacity-70' : ''}`}>
									<div class='flex items-center justify-between gap-2'>
										<span class={getPriorityBadgeClass(item.priority)}>{getPriorityLabel(item.priority)}</span>
										<span class='text-xs text-base-content/50'>{formatTimestamp(item.receivedAt)}</span>
									</div>
									{#if item.scopes?.length}
										<div class='flex flex-wrap gap-1 mt-2'>
											{#each item.scopes as scope (scope)}
												<span class={getScopeBadgeClass(scope)}>{getScopeLabel(scope)}</span>
											{/each}
										</div>
									{/if}
									{#if item.subject}
										<p class='mt-2 font-semibold text-sm text-base-content'>{item.subject}</p>
									{/if}
									<p class='mt-1 text-sm leading-snug text-base-content/80'>{trimMessage(item.message)}</p>
									{#if item.channels?.length > 1}
										<p class='mt-2 text-[11px] text-base-content/50'>
											チャネル: {item.channels.join(', ')}
										</p>
									{/if}
								</article>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>

		<div class='dropdown dropdown-end'>
			<div tabindex='0' role='button' class='btn btn-ghost btn-circle'>
				{#if props.user?.avatar_url}
					<div class='avatar'>
						<div class='w-10 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2'>
							<img src={props.user.avatar_url} alt={props.user?.display_name || 'User avatar'} />
						</div>
					</div>
				{:else}
					<div class='avatar avatar-placeholder'>
						<div class='bg-neutral text-neutral-content rounded-full w-10 flex items-center justify-center'>
							<span class='leading-none'>{getDisplayInitials()}</span>
						</div>
					</div>
				{/if}
			</div>

			<ul class='mt-3 z-[50] p-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box w-64'>
				<li class='menu-title px-3 py-2'>
					<div>
						<p class='font-semibold text-base'>{props.user?.display_name || 'User'}</p>
						<p class='text-xs text-base-content/70'>{props.user?.email}</p>
						{#if props.user?.role}
							<p class='text-xs text-base-content/60 mt-1'>ロール: {props.user.role.name}</p>
						{/if}
					</div>
				</li>

				<div class='divider my-1'></div>

				<li>
					<button class='flex items-center gap-2' onclick={handleUserSettings}>
						<svg
							xmlns='http://www.w3.org/2000/svg'
							fill='none'
							viewBox='0 0 24 24'
							stroke-width='1.5'
							stroke='currentColor'
							class='w-4 h-4'
						>
							<path
								stroke-linecap='round'
								stroke-linejoin='round'
								d='M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z'
							/>
						</svg>
						ユーザー設定
					</button>
				</li>

				<div class='divider my-1'></div>

				<li>
					<button class='flex items-center gap-2 text-error' onclick={props.onLogout}>
						<svg
							xmlns='http://www.w3.org/2000/svg'
							fill='none'
							viewBox='0 0 24 24'
							stroke-width='1.5'
							stroke='currentColor'
							class='w-4 h-4'
						>
							<path
								stroke-linecap='round'
								stroke-linejoin='round'
								d='M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75'
							/>
						</svg>
						ログアウト
					</button>
				</li>
			</ul>
		</div>
	</div>
</div>
