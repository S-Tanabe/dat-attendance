<script lang='ts'>
	import type { KPIMetric } from '../types'
	import { onMount } from 'svelte'

	interface Props {
		metric: KPIMetric
		animationDelay?: number
	}

	const { metric, animationDelay = 0 }: Props = $props()

	let animatedValue = $state(0)
	let isVisible = $state(false)

	// アニメーション用の値計算
	$effect(() => {
		if (isVisible) {
			// 数値のカウントアップアニメーション
			const duration = 2000 // 2秒
			const startTime = Date.now()
			const startValue = 0
			const endValue = metric.value

			const animate = () => {
				const elapsed = Date.now() - startTime
				const progress = Math.min(elapsed / duration, 1)

				// イージング関数（ease-out）
				const easeOut = 1 - (1 - progress) ** 3
				animatedValue = Math.floor(startValue + (endValue - startValue) * easeOut)

				if (progress < 1) {
					requestAnimationFrame(animate)
				}
			}

			setTimeout(() => {
				animate()
			}, animationDelay)
		}
	})

	onMount(() => {
		// IntersectionObserver for animation trigger
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						isVisible = true
						observer.disconnect()
					}
				})
			},
			{ threshold: 0.1 },
		)

		const element = document.getElementById(`kpi-${metric.id}`)
		if (element) {
			observer.observe(element)
		}

		return () => observer.disconnect()
	})

	// トレンドの表示計算
	const getTrendDisplay = () => {
		if (!metric.trendValue)
			return null

		const isPositive = metric.trendValue > 0
		const symbol = isPositive ? '+' : ''
		const percentage = Math.abs(metric.trendValue)

		return {
			text: `${symbol}${percentage}%`,
			isPositive,
			icon: isPositive ? 'trending-up' : 'trending-down',
		}
	}

	const trendDisplay = getTrendDisplay()
</script>

<div
	id='kpi-{metric.id}'
	class='card bg-linear-to-br from-base-100 to-base-200 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 border border-base-300'
	class:animate-pulse={!isVisible}
>
	<div class='card-body p-6'>
		<!-- アイコンとタイトル -->
		<div class='flex items-start justify-between'>
			<div class='flex-1'>
				<h3 class='card-title text-base font-medium text-base-content/70 mb-2'>
					{metric.title}
				</h3>
			</div>
			<div class='flex-none'>
				<div class='w-12 h-12 rounded-xl bg-{metric.color}/20 flex items-center justify-center'>
					{#if metric.icon === 'users'}
						<svg class='w-6 h-6 text-{metric.color}' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
							<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' />
						</svg>
					{:else if metric.icon === 'chart-bar'}
						<svg class='w-6 h-6 text-{metric.color}' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
							<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' />
						</svg>
					{:else if metric.icon === 'check-circle'}
						<svg class='w-6 h-6 text-{metric.color}' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
							<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' />
						</svg>
					{:else if metric.icon === 'currency-dollar'}
						<svg class='w-6 h-6 text-{metric.color}' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
							<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1' />
						</svg>
					{:else}
						<svg class='w-6 h-6 text-{metric.color}' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
							<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' />
						</svg>
					{/if}
				</div>
			</div>
		</div>

		<!-- メインの値 -->
		<div class='mb-3'>
			<div class='text-3xl font-bold text-base-content'>
				{animatedValue.toLocaleString()}{metric.unit || ''}
			</div>
		</div>

		<!-- トレンドと説明 -->
		<div class='flex items-center justify-between'>
			{#if trendDisplay}
				<div class='flex items-center space-x-1'>
					<div class="w-4 h-4 rounded-full flex items-center justify-center bg-{trendDisplay.isPositive ? 'success' : 'error'}/20">
						{#if trendDisplay.isPositive}
							<svg class='w-3 h-3 text-success' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
								<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M7 17l9.2-9.2M17 17V7h-10' />
							</svg>
						{:else}
							<svg class='w-3 h-3 text-error' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
								<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M17 7l-9.2 9.2M7 7v10h10' />
							</svg>
						{/if}
					</div>
					<span class="text-sm font-medium text-{trendDisplay.isPositive ? 'success' : 'error'}">
						{trendDisplay.text}
					</span>
				</div>
			{:else}
				<div></div>
			{/if}

			{#if metric.description}
				<span class='text-xs text-base-content/60'>
					{metric.description}
				</span>
			{/if}
		</div>
	</div>
</div>
