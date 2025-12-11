<script lang='ts'>
	import type { SmartRecommendation } from '../types'

	interface Props {
		recommendations: SmartRecommendation[]
		animationDelay?: number
	}

	const { recommendations }: Props = $props()

	let activeCategory = $state<string>('all')

	// カテゴリ別フィルタリング
	const categories = [
		{ id: 'all', label: 'すべて', icon: 'squares-2x2' },
		{ id: 'performance', label: 'パフォーマンス', icon: 'bolt' },
		{ id: 'cost', label: 'コスト', icon: 'currency-dollar' },
		{ id: 'security', label: 'セキュリティ', icon: 'shield-check' },
		{ id: 'workflow', label: 'ワークフロー', icon: 'arrow-path' },
		{ id: 'automation', label: '自動化', icon: 'cpu-chip' },
	]

	const filteredRecommendations = $derived(
		activeCategory === 'all'
			? recommendations
			: recommendations.filter((rec) => rec.category === activeCategory),
	)

	// アイコンの描画
	const renderIcon = (iconName: string) => {
		switch (iconName) {
			case 'squares-2x2':
				return 'M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z'
			case 'bolt':
				return 'M13 10V3L4 14h5v7l9-11h-5z'
			case 'currency-dollar':
				return 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM13.5 6L10 8.5 10.5 11l3-2.5L13.5 6zM9.5 12.5L13 10l-0.5-2.5-3 2.5L9.5 12.5zM10.5 18L14 15.5 13.5 13l-3 2.5L10.5 18z'
			case 'shield-check':
				return 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z M10.5 15.5L7 12l1.41-1.41L10.5 12.67l5.59-5.59L17.5 8.5l-7 7z'
			case 'arrow-path':
				return 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
			case 'cpu-chip':
				return 'M8 2v2H6V2h2zM6 6V4h2v2H6zm0 4V8h2v2H6zm0 4v-2h2v2H6zm6-4V8h2v2h-2zm0 4v-2h2v2h-2zm0-8V4h2v2h-2zm0-4V2h2v2h-2z'
			case 'cog':
				return 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z'
			case 'chart-bar':
				return 'M3 13l4-4 4 4 6-6v10H3v-4z'
			case 'clock':
				return 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM13 13h-2V7h2v6z'
			default:
				return 'M13 10V3L4 14h5v7l9-11h-5z'
		}
	}

	// インパクト・工数レベルのスタイル
	const getLevelStyle = (level: 'low' | 'medium' | 'high') => {
		switch (level) {
			case 'high':
				return { color: 'success', intensity: 'font-bold' }
			case 'medium':
				return { color: 'warning', intensity: 'font-medium' }
			case 'low':
				return { color: 'info', intensity: 'font-normal' }
		}
	}

	// カテゴリのスタイル
	const getCategoryStyle = (category: SmartRecommendation['category']) => {
		switch (category) {
			case 'performance':
				return 'bg-success/20 text-success border-success/30'
			case 'cost':
				return 'bg-warning/20 text-warning border-warning/30'
			case 'security':
				return 'bg-error/20 text-error border-error/30'
			case 'workflow':
				return 'bg-info/20 text-info border-info/30'
			case 'automation':
				return 'bg-primary/20 text-primary border-primary/30'
			default:
				return 'bg-neutral/20 text-neutral border-neutral/30'
		}
	}
</script>

<div class='bg-base-100/80 backdrop-blur-sm rounded-2xl shadow-xl border border-base-300 overflow-hidden h-full flex flex-col'>
	<!-- ヘッダー -->
	<div class='bg-linear-to-r from-secondary/10 to-accent/10 p-6 border-b border-base-300'>
		<div class='flex items-center justify-between'>
			<div class='flex items-center space-x-3'>
				<div class='w-12 h-12 bg-linear-to-br from-secondary to-accent rounded-xl flex items-center justify-center shadow-lg'>
					<svg class='w-6 h-6 text-white' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
						<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d={renderIcon('cpu-chip')} />
					</svg>
				</div>
				<div>
					<h2 class='text-xl font-bold text-base-content'>スマート提案</h2>
					<p class='text-sm text-base-content/60'>AIによる改善提案</p>
				</div>
			</div>

			<!-- 統計サマリー -->
			<div class='text-right'>
				<div class='text-2xl font-bold text-base-content'>{filteredRecommendations.length}</div>
				<div class='text-sm text-base-content/60'>提案</div>
			</div>
		</div>

		<!-- カテゴリフィルター -->
		<div class='mt-4 flex flex-wrap gap-2'>
			{#each categories as category}
				<button
					class="px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 {activeCategory === category.id ? 'bg-primary text-primary-content shadow-md' : 'bg-base-100/60 text-base-content hover:bg-base-200'}"
					onclick={() => activeCategory = category.id}
				>
					<div class='flex items-center space-x-1'>
						<svg class='w-3 h-3' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
							<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d={renderIcon(category.icon)} />
						</svg>
						<span>{category.label}</span>
					</div>
				</button>
			{/each}
		</div>
	</div>

	<!-- 推奨事項リスト -->
	<div class='p-6 flex-1'>
		{#if filteredRecommendations.length === 0}
			<!-- 空の状態 -->
			<div class='text-center py-8'>
				<div class='w-16 h-16 mx-auto mb-4 rounded-full bg-base-200 flex items-center justify-center'>
					<svg class='w-8 h-8 text-base-content/40' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
						<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' />
					</svg>
				</div>
				<p class='text-base-content/60'>このカテゴリには提案がありません</p>
			</div>
		{:else}
			<div class='space-y-4'>
				{#each filteredRecommendations as recommendation}
					{@const impactStyle = getLevelStyle(recommendation.impact)}
					{@const effortStyle = getLevelStyle(recommendation.effort)}

					<div class='bg-base-100/60 backdrop-blur-sm rounded-xl p-5 border border-base-300 hover:bg-base-200 hover:shadow-lg transition-all duration-300 group'>
						<div class='flex items-start space-x-4'>
							<!-- アイコンとカテゴリ -->
							<div class='shrink-0'>
								<div class='w-12 h-12 bg-linear-to-br from-base-100 to-base-200 rounded-lg flex items-center justify-center border border-base-300 shadow-sm'>
									<svg class='w-6 h-6 text-{recommendation.color}' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
										<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d={renderIcon(recommendation.icon)} />
									</svg>
								</div>
							</div>

							<!-- メインコンテンツ -->
							<div class='flex-1 min-w-0'>
								<div class='flex items-start justify-between mb-2'>
									<div class='min-w-0 flex-1'>
										<h3 class='text-base font-semibold text-base-content mb-1'>{recommendation.title}</h3>
										<p class='text-sm text-base-content/70'>{recommendation.description}</p>
									</div>

									<!-- カテゴリバッジ -->
									<span class='ml-2 px-2 py-1 text-xs font-medium rounded-full {getCategoryStyle(recommendation.category)}'>
										{recommendation.category}
									</span>
								</div>

								<!-- メトリクス -->
								<div class='flex items-center space-x-6 mb-3'>
									<div class='flex items-center space-x-2'>
										<span class='text-xs text-base-content/60'>インパクト:</span>
										<span class='text-xs {impactStyle.intensity} text-{impactStyle.color}'>
											{recommendation.impact.toUpperCase()}
										</span>
									</div>

									<div class='flex items-center space-x-2'>
										<span class='text-xs text-base-content/60'>工数:</span>
										<span class='text-xs {effortStyle.intensity} text-{effortStyle.color}'>
											{recommendation.effort.toUpperCase()}
										</span>
									</div>

									{#if recommendation.implementationTime}
										<div class='flex items-center space-x-2'>
											<svg class='w-3 h-3 text-base-content/60' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
												<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d={renderIcon('clock')} />
											</svg>
											<span class='text-xs text-base-content/60'>{recommendation.implementationTime}</span>
										</div>
									{/if}

									{#if recommendation.estimatedSavings}
										<div class='flex items-center space-x-2'>
											<svg class='w-3 h-3 text-success' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
												<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d={renderIcon('currency-dollar')} />
											</svg>
											<span class='text-xs font-medium text-success'>
												¥{recommendation.estimatedSavings.toLocaleString()}節約
											</span>
										</div>
									{/if}
								</div>

								<!-- アクションボタン -->
								{#if recommendation.action}
									<div class='flex items-center justify-between'>
										<button class='text-sm font-medium text-primary hover:text-primary-focus transition-colors'>
											{recommendation.action} →
										</button>

										<!-- 進捗インジケーター -->
										<div class='flex items-center space-x-1'>
											<div class='w-2 h-2 rounded-full bg-{recommendation.color}/30'></div>
											<div class='w-2 h-2 rounded-full bg-base-300'></div>
											<div class='w-2 h-2 rounded-full bg-base-300'></div>
											<span class='text-xs text-base-content/60 ml-2'>未実装</span>
										</div>
									</div>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
