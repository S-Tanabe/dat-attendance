<script lang='ts'>
	import type { AIInsight } from '../types'
	import { onMount } from 'svelte'

	interface Props {
		insights: AIInsight[]
		animationDelay?: number
	}

	const { insights, animationDelay = 0 }: Props = $props()

	let isVisible = $state(false)
	let currentInsightIndex = $state(0)
	let analysisProgress = $state(0)

	// アニメーション制御
	$effect(() => {
		if (isVisible) {
			// 分析進捗のアニメーション
			const progressInterval = setInterval(() => {
				analysisProgress = (analysisProgress + 1) % 101
				if (analysisProgress === 100) {
					setTimeout(() => {
						analysisProgress = 0
					}, 1000)
				}
			}, 30)

			// インサイトの自動切り替え
			const insightInterval = setInterval(() => {
				currentInsightIndex = (currentInsightIndex + 1) % insights.length
			}, 4000)

			return () => {
				clearInterval(progressInterval)
				clearInterval(insightInterval)
			}
		}
	})

	// アイコンの描画
	const renderIcon = (iconName: string) => {
		switch (iconName) {
			case 'brain':
				return 'M9.5 2A2.5 2.5 0 007 4.5v.793c-.026.009-.052.02-.076.032L6.674 5.1a2.5 2.5 0 10-.233 4.798l.251.127c.024.012.05.023.076.032v.793a2.5 2.5 0 105 0V9.15c.026-.009.052-.02.076-.032l.251-.127a2.5 2.5 0 10-.233-4.798L11.076 4.5c-.024-.012-.05-.023-.076-.032V3.5A2.5 2.5 0 009.5 2z'
			case 'cpu-chip':
				return 'M8 2v2H6V2h2zM6 6V4h2v2H6zm0 4V8h2v2H6zm0 4v-2h2v2H6zm6-4V8h2v2h-2zm0 4v-2h2v2h-2zm0-8V4h2v2h-2zm0-4V2h2v2h-2z'
			case 'lightning-bolt':
				return 'M13 10V3L4 14h5v7l9-11h-5z'
			case 'chart-bar-square':
				return 'M7 3v2H5V3h2zM5 7V5h2v2H5zm0 4V9h2v2H5zm0 4v-2h2v2H5zm6-4V9h2v2h-2zm0 4v-2h2v2h-2zm0-8V5h2v2h-2zm0-4V3h2v2h-2zm4 0V3h2v2h-2zm0 4V5h2v2h-2zm0 4V9h2v2h-2zm0 4v-2h2v2h-2z'
			case 'sparkles':
				return 'M9.5 12.5l-1.5-4.5-4.5-1.5L8 5l1.5-4.5L11 5l4.5 1.5L11 8l-1.5 4.5zM4 21l.5-1.5L6 19l-1.5-.5L4 17l-.5 1.5L2 19l1.5.5L4 21zm14-10l.5-1.5L20 9l-1.5-.5L18 7l-.5 1.5L16 9l1.5.5L18 11z'
			default:
				return 'M13 10V3L4 14h5v7l9-11h-5z'
		}
	}

	// 優先度に応じた色とスタイル
	const getPriorityStyle = (priority: AIInsight['priority']) => {
		switch (priority) {
			case 'critical':
				return {
					bgColor: 'bg-linear-to-br from-error/20 to-error/5',
					borderColor: 'border-error/30',
					iconColor: 'text-error',
					pulseColor: 'animate-pulse',
				}
			case 'high':
				return {
					bgColor: 'bg-linear-to-br from-warning/20 to-warning/5',
					borderColor: 'border-warning/30',
					iconColor: 'text-warning',
					pulseColor: '',
				}
			case 'medium':
				return {
					bgColor: 'bg-linear-to-br from-info/20 to-info/5',
					borderColor: 'border-info/30',
					iconColor: 'text-info',
					pulseColor: '',
				}
			case 'low':
				return {
					bgColor: 'bg-linear-to-br from-success/20 to-success/5',
					borderColor: 'border-success/30',
					iconColor: 'text-success',
					pulseColor: '',
				}
		}
	}

	const currentInsight = $derived(insights[currentInsightIndex])
	const priorityStyle = $derived(currentInsight ? getPriorityStyle(currentInsight.priority) : getPriorityStyle('low'))

	onMount(() => {
		setTimeout(() => {
			isVisible = true
		}, animationDelay)
	})
</script>

<div class='relative overflow-hidden bg-linear-to-br from-primary/5 via-secondary/5 to-accent/10 rounded-2xl shadow-xl border border-base-300 backdrop-blur-sm h-full flex flex-col'>
	<!-- AI背景エフェクト -->
	<div class='absolute inset-0 overflow-hidden'>
		<div class='absolute top-0 left-0 w-full h-full opacity-30'>
			<!-- パーティクル効果 -->
			<div class='absolute top-4 left-4 w-2 h-2 bg-primary rounded-full animate-ping'></div>
			<div class='absolute top-8 right-8 w-1 h-1 bg-secondary rounded-full animate-pulse delay-1000'></div>
			<div class='absolute bottom-6 left-8 w-1.5 h-1.5 bg-accent rounded-full animate-ping delay-2000'></div>
			<div class='absolute bottom-4 right-4 w-1 h-1 bg-info rounded-full animate-pulse delay-500'></div>

			<!-- グリッド背景 -->
			<div class='absolute inset-0 bg-grid-pattern opacity-5'></div>
		</div>
	</div>

	<div class='relative p-6 flex-1 flex flex-col'>
		<!-- ヘッダー -->
		<div class='flex items-center justify-between mb-6'>
			<div class='flex items-center space-x-3'>
				<div class='w-12 h-12 bg-linear-to-br from-primary to-secondary rounded-xl flex items-center justify-center shadow-lg'>
					<svg class='w-6 h-6 text-white' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
						<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d={renderIcon('brain')} />
					</svg>
				</div>
				<div>
					<h2 class='text-xl font-bold text-base-content'>AI インサイト</h2>
					<p class='text-sm text-base-content/60'>リアルタイム分析結果</p>
				</div>
			</div>

			<!-- 分析進捗 -->
			<div class='flex items-center space-x-2'>
				<span class='text-xs text-base-content/60'>分析中</span>
				<div class='w-20 h-2 bg-base-200 rounded-full overflow-hidden'>
					<div
						class='h-full bg-linear-to-r from-primary to-secondary transition-all duration-300 ease-out'
						style='width: {analysisProgress}%'
					></div>
				</div>
				<span class='text-xs font-mono text-base-content/80'>{analysisProgress}%</span>
			</div>
		</div>

		{#if currentInsight}
			<!-- メインインサイトカード -->
			<div class='transition-all duration-500 ease-in-out {priorityStyle.pulseColor}'>
				<div class='bg-base-100/80 backdrop-blur-sm rounded-xl p-5 border {priorityStyle.borderColor} shadow-lg hover:shadow-xl transition-shadow'>
					<div class='flex items-start space-x-4'>
						<!-- アイコン -->
						<div class='shrink-0'>
							<div class='w-10 h-10 {priorityStyle.bgColor} rounded-lg flex items-center justify-center'>
								<svg class='w-5 h-5 {priorityStyle.iconColor}' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
									<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d={renderIcon(currentInsight.icon)} />
								</svg>
							</div>
						</div>

						<!-- コンテンツ -->
						<div class='flex-1 min-w-0'>
							<div class='flex items-start justify-between'>
								<div class='min-w-0 flex-1'>
									<div class='flex items-center space-x-2 mb-1'>
										<h3 class='font-semibold text-base-content text-sm'>{currentInsight.title}</h3>
										<span class='px-2 py-1 text-xs font-medium rounded-full bg-{currentInsight.color}/20 text-{currentInsight.color}'>
											{currentInsight.type}
										</span>
									</div>
									<p class='text-sm text-base-content/70 mb-2'>{currentInsight.description}</p>

									{#if currentInsight.value}
										<div class='flex items-center space-x-2'>
											<span class='text-lg font-bold text-base-content'>
												{currentInsight.value.toLocaleString()}{currentInsight.unit || ''}
											</span>
											{#if currentInsight.change}
												<span class="text-xs px-2 py-1 rounded-full {currentInsight.change >= 0 ? 'bg-success/20 text-success' : 'bg-error/20 text-error'}">
													{currentInsight.change >= 0 ? '+' : ''}{currentInsight.change}%
												</span>
											{/if}
										</div>
									{/if}
								</div>

								<!-- 信頼度 -->
								<div class='flex flex-col items-end space-y-1'>
									<span class='text-xs text-base-content/60'>信頼度</span>
									<div class='flex items-center space-x-1'>
										<span class='text-sm font-bold text-base-content'>{currentInsight.confidence}%</span>
										<div class='w-8 h-1.5 bg-base-200 rounded-full'>
											<div
												class='h-full bg-linear-to-r from-success to-primary rounded-full transition-all duration-500'
												style='width: {currentInsight.confidence}%'
											></div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- インサイト一覧（コンパクト表示） -->
		<div class='mt-4 space-y-2 flex-1'>
			<div class='flex items-center justify-between'>
				<span class='text-sm font-medium text-base-content/70'>その他のインサイト</span>
				<div class='flex space-x-1'>
					{#each Array.from({ length: insights.length }, (_, i) => i) as index}
						<button
							type='button'
							class="w-2 h-2 rounded-full transition-all duration-300 {index === currentInsightIndex ? 'bg-primary' : 'bg-base-300 hover:bg-base-400'}"
							aria-label={`インサイト${index + 1}に切り替え`}
							onclick={() => currentInsightIndex = index}
						></button>
					{/each}
				</div>
			</div>

			<div class='grid grid-cols-1 sm:grid-cols-3 gap-3'>
				{#each insights.slice(0, 3) as insight, index}
					{#if index !== currentInsightIndex}
						{@const style = getPriorityStyle(insight.priority)}
						<button
							type='button'
							class='w-full bg-base-100/60 backdrop-blur-sm rounded-lg p-3 border border-base-300 hover:bg-base-200 transition-all group text-left'
							onclick={() => currentInsightIndex = insights.indexOf(insight)}
							aria-label={`インサイト「${insight.title}」を表示`}
						>
							<div class='flex items-center space-x-2'>
								<div class='w-6 h-6 {style.bgColor} rounded-md flex items-center justify-center'>
									<svg class='w-3 h-3 {style.iconColor}' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
										<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d={renderIcon(insight.icon)} />
									</svg>
								</div>
								<div class='min-w-0 flex-1'>
									<p class='text-xs font-medium text-base-content truncate'>{insight.title}</p>
									<p class='text-xs text-base-content/60'>{insight.confidence}%</p>
								</div>
							</div>
						</button>
					{/if}
				{/each}
			</div>
		</div>
	</div>
</div>

<style>
  .bg-grid-pattern {
    background-image:
      linear-gradient(rgba(var(--primary), 0.1) 1px, transparent 1px),
      linear-gradient(90deg, rgba(var(--primary), 0.1) 1px, transparent 1px);
    background-size: 20px 20px;
  }
</style>
