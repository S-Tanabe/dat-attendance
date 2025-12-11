<script lang='ts'>
	import type { ActivityItem } from '../types'

	interface Props {
		activities: ActivityItem[]
		maxItems?: number
	}

	const { activities, maxItems = 8 }: Props = $props()

	// 最新のアクティビティを表示
	const displayActivities = $derived(activities.slice(0, maxItems))

	// 時間の相対表示
	const getRelativeTime = (timestamp: Date): string => {
		const now = new Date()
		const diff = now.getTime() - timestamp.getTime()
		const minutes = Math.floor(diff / (1000 * 60))
		const hours = Math.floor(diff / (1000 * 60 * 60))
		const days = Math.floor(diff / (1000 * 60 * 60 * 24))

		if (minutes < 1)
			return 'たった今'
		if (minutes < 60)
			return `${minutes}分前`
		if (hours < 24)
			return `${hours}時間前`
		return `${days}日前`
	}

	// アクティビティタイプのアイコンとスタイル
	const getActivityStyle = (type: ActivityItem['type']) => {
		switch (type) {
			case 'create':
				return {
					icon: 'plus',
					bgColor: 'bg-success/20',
					iconColor: 'text-success',
					borderColor: 'border-success/30',
				}
			case 'update':
				return {
					icon: 'pencil',
					bgColor: 'bg-primary/20',
					iconColor: 'text-primary',
					borderColor: 'border-primary/30',
				}
			case 'delete':
				return {
					icon: 'trash',
					bgColor: 'bg-error/20',
					iconColor: 'text-error',
					borderColor: 'border-error/30',
				}
			case 'complete':
				return {
					icon: 'check',
					bgColor: 'bg-success/20',
					iconColor: 'text-success',
					borderColor: 'border-success/30',
				}
			case 'comment':
				return {
					icon: 'chat',
					bgColor: 'bg-info/20',
					iconColor: 'text-info',
					borderColor: 'border-info/30',
				}
			default:
				return {
					icon: 'bell',
					bgColor: 'bg-neutral/20',
					iconColor: 'text-neutral',
					borderColor: 'border-neutral/30',
				}
		}
	}

	// SVGアイコンの描画
	const renderIcon = (iconName: string) => {
		switch (iconName) {
			case 'plus':
				return 'M12 4v16m8-8H4'
			case 'pencil':
				return 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7m-5.5-5.5l7-7 2.5 2.5-7 7m0 0l-2.5 2.5-7-7'
			case 'trash':
				return 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
			case 'check':
				return 'M5 13l4 4L19 7'
			case 'chat':
				return 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'
			default:
				return 'M15 17h5l-5 5v-5zM4.5 5.653c0-1.337 1.13-2.423 2.524-2.423h5.452c1.394 0 2.524 1.086 2.524 2.423v6.694c0 1.337-1.13 2.423-2.524 2.423H7.024c-1.394 0-2.524-1.086-2.524-2.423V5.653z'
		}
	}
</script>

<div class='space-y-4'>
	<!-- ヘッダー -->
	<div class='flex items-center justify-between'>
		<h2 class='text-lg font-semibold text-base-content'>最近のアクティビティ</h2>
		{#if activities.length > maxItems}
			<button class='text-sm text-primary hover:text-primary-focus transition-colors'>
				すべて表示 ({activities.length})
			</button>
		{/if}
	</div>

	<!-- タイムライン -->
	<div class='relative'>
		{#if displayActivities.length === 0}
			<!-- 空の状態 -->
			<div class='text-center py-8'>
				<div class='w-16 h-16 mx-auto mb-4 rounded-full bg-base-200 flex items-center justify-center'>
					<svg class='w-8 h-8 text-base-content/40' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
						<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' />
					</svg>
				</div>
				<p class='text-base-content/60'>まだアクティビティがありません</p>
			</div>
		{:else}
			<!-- タイムライン線 -->
			<div class='absolute left-6 top-0 bottom-0 w-px bg-base-300'></div>

			<!-- アクティビティリスト -->
			<div class='space-y-4'>
				{#each displayActivities as activity}
					{@const style = getActivityStyle(activity.type)}

					<div class='relative flex items-start space-x-4 group'>
						<!-- アイコンバッジ -->
						<div class='relative z-10'>
							<div class='w-12 h-12 rounded-full border-2 {style.borderColor} {style.bgColor} flex items-center justify-center'>
								<svg class='w-5 h-5 {style.iconColor}' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
									<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d={renderIcon(style.icon)} />
								</svg>
							</div>
						</div>

						<!-- コンテンツ -->
						<div class='flex-1 min-w-0'>
							<div class='bg-base-100 rounded-lg border border-base-300 p-4 shadow-sm hover:shadow-md transition-shadow group-hover:border-base-400'>
								<!-- ユーザー情報とアクション -->
								<div class='flex items-start justify-between'>
									<div class='flex items-center space-x-3'>
										<!-- ユーザーアバター -->
										<div class='avatar avatar-placeholder'>
											{#if activity.user.avatar}
												<div class='w-10 h-10 rounded-full'>
													<img src={activity.user.avatar} alt={activity.user.name} />
												</div>
											{:else}
												<div class='bg-neutral text-neutral-content rounded-full w-10 h-10 flex items-center justify-center'>
													<span class='text-sm leading-none'>{activity.user.initials}</span>
												</div>
											{/if}
										</div>

										<!-- アクション内容 -->
										<div class='min-w-0 flex-1'>
											<p class='text-sm font-medium text-base-content'>
												<span class='font-semibold'>{activity.user.name}</span>
												が{activity.action}
												{#if activity.target}
													<span class='text-primary'>{activity.target}</span>
												{/if}
											</p>
										</div>
									</div>

									<!-- 時間 -->
									<span class='text-xs text-base-content/50 whitespace-nowrap ml-2'>
										{getRelativeTime(activity.timestamp)}
									</span>
								</div>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- フッター（もっと見る） -->
	{#if activities.length > maxItems}
		<div class='text-center pt-4 border-t border-base-200'>
			<button class='btn btn-ghost btn-sm'>
				<svg class='w-4 h-4 mr-2' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
					<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7' />
				</svg>
				過去のアクティビティを表示
			</button>
		</div>
	{/if}
</div>
