<script lang='ts'>
	import type { QuickAction } from '../types'
	import { goto } from '$app/navigation'

	interface Props {
		actions: QuickAction[]
		columns?: number
	}

	const { actions, columns = 2 }: Props = $props()

	// アクションのクリック処理
	const handleActionClick = async (action: QuickAction) => {
		if (action.onClick) {
			action.onClick()
		} else if (action.href) {
			await goto(action.href)
		}
	}

	// 色のクラス設定
	const getColorClasses = (color: string) => {
		const colorMap = {
			primary: 'hover:bg-primary/10 hover:text-primary hover:border-primary/30 group-hover:text-primary',
			secondary: 'hover:bg-secondary/10 hover:text-secondary hover:border-secondary/30 group-hover:text-secondary',
			accent: 'hover:bg-accent/10 hover:text-accent hover:border-accent/30 group-hover:text-accent',
			success: 'hover:bg-success/10 hover:text-success hover:border-success/30 group-hover:text-success',
			warning: 'hover:bg-warning/10 hover:text-warning hover:border-warning/30 group-hover:text-warning',
			error: 'hover:bg-error/10 hover:text-error hover:border-error/30 group-hover:text-error',
		}
		return colorMap[color as keyof typeof colorMap] || colorMap.primary
	}

	// アイコンのSVGパス
	const getIconPath = (iconName: string) => {
		switch (iconName) {
			case 'plus':
				return 'M12 4v16m8-8H4'
			case 'user-plus':
				return 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z'
			case 'document-report':
				return 'M9 17v1a3 3 0 003 3h0a3 3 0 003-3v-1m3-10V3a1 1 0 00-1-1H7a1 1 0 00-1 1v4m12 4l4 4m0 0l-4 4m4-4H3'
			case 'cog':
				return 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z'
			case 'chart-bar':
				return 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'
			case 'folder-plus':
				return 'M12 6v6m0 0v6m0-6h6m-6 0H6'
			case 'mail':
				return 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'
			case 'calendar':
				return 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
			case 'bell':
				return 'M15 17h5l-5 5v-5zM4.5 5.653c0-1.337 1.13-2.423 2.524-2.423h5.452c1.394 0 2.524 1.086 2.524 2.423v6.694c0 1.337-1.13 2.423-2.524 2.423H7.024c-1.394 0-2.524-1.086-2.524-2.423V5.653z'
			default:
				return 'M12 4v16m8-8H4'
		}
	}
</script>

<div class='space-y-4'>
	<!-- ヘッダー -->
	<div>
		<h2 class='text-lg font-semibold text-base-content mb-2'>クイックアクション</h2>
		<p class='text-sm text-base-content/60'>よく使用する機能へのショートカット</p>
	</div>

	<!-- アクションカードグリッド -->
	<div class='grid grid-cols-{columns} gap-4'>
		{#each actions as action}
			<button
				class='group relative p-4 bg-base-100 border border-base-300 rounded-xl transition-all duration-300 hover:shadow-lg hover:-translate-y-1 text-left {getColorClasses(action.color)}'
				onclick={() => handleActionClick(action)}
			>
				<!-- 背景グラデーション（ホバー時） -->
				<div class='absolute inset-0 bg-linear-to-br from-transparent to-base-200/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300'></div>

				<!-- コンテンツ -->
				<div class='relative z-10'>
					<!-- アイコンエリア -->
					<div class='flex items-start justify-between mb-3'>
						<div class='w-12 h-12 rounded-lg bg-base-200 group-hover:bg-{action.color}/20 flex items-center justify-center transition-colors duration-300'>
							<svg
								class='w-6 h-6 text-base-content/70 {getColorClasses(action.color)} transition-colors duration-300'
								fill='none'
								stroke='currentColor'
								viewBox='0 0 24 24'
							>
								<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d={getIconPath(action.icon)} />
							</svg>
						</div>

						<!-- 矢印アイコン -->
						<svg class='w-4 h-4 text-base-content/30 group-hover:text-base-content/60 transition-all duration-300 group-hover:translate-x-1' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
							<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M9 5l7 7-7 7' />
						</svg>
					</div>

					<!-- タイトルと説明 -->
					<div>
						<h3 class='font-semibold text-base-content group-hover:text-current mb-1 text-sm'>
							{action.title}
						</h3>
						<p class='text-xs text-base-content/60 line-clamp-2'>
							{action.description}
						</p>
					</div>

					<!-- プログレスバー風装飾 -->
					<div class='mt-3 h-1 bg-base-200 rounded-full overflow-hidden'>
						<div class='h-full bg-linear-to-r from-{action.color}/50 to-{action.color} transform -translate-x-full group-hover:translate-x-0 transition-transform duration-500'></div>
					</div>
				</div>

				<!-- ホバー時のリップル効果 -->
				<div class='absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none'>
					<div class='absolute top-0 left-0 w-2 h-2 bg-{action.color}/30 rounded-full animate-ping'></div>
				</div>
			</button>
		{/each}
	</div>

	<!-- カスタムアクション追加 -->
	<div class='pt-4 border-t border-base-200'>
		<button class='w-full p-3 border-2 border-dashed border-base-300 rounded-xl text-base-content/50 hover:text-base-content hover:border-base-400 transition-all duration-300 group'>
			<div class='flex items-center justify-center space-x-2'>
				<svg class='w-5 h-5 group-hover:scale-110 transition-transform' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
					<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 4v16m8-8H4' />
				</svg>
				<span class='text-sm font-medium'>カスタムアクションを追加</span>
			</div>
		</button>
	</div>
</div>
