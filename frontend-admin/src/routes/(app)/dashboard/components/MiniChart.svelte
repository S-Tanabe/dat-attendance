<script lang='ts'>
	import type { ChartDataPoint } from '../types'
	import { onMount } from 'svelte'

	interface Props {
		data: ChartDataPoint[]
		title: string
		height?: number
		type?: 'line' | 'bar'
		color?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error'
		animationDelay?: number
	}

	const {
		data,
		title,
		height = 100,
		type = 'line',
		color = 'primary',
		animationDelay = 0,
	}: Props = $props()

	let animatedData = $state<ChartDataPoint[]>([])
	let isVisible = $state(false)
	let chartContainer = $state<HTMLDivElement>()

	// データの最大値を計算
	const maxValue = $derived(Math.max(...data.map((d) => d.value)))
	const minValue = $derived(Math.min(...data.map((d) => d.value)))
	const valueRange = $derived(maxValue - minValue)

	// アニメーション
	$effect(() => {
		if (isVisible && data.length > 0) {
			const duration = 1500
			const startTime = Date.now()

			const animate = () => {
				const elapsed = Date.now() - startTime
				const progress = Math.min(elapsed / duration, 1)

				// イージング関数
				const easeOut = 1 - (1 - progress) ** 3

				animatedData = data.map((point) => ({
					...point,
					value: point.value * easeOut,
				}))

				if (progress < 1) {
					requestAnimationFrame(animate)
				}
			}

			setTimeout(() => {
				animate()
			}, animationDelay)
		}
	})

	// SVG パスの生成（ライン用）
	const generatePath = (points: ChartDataPoint[], width: number, height: number) => {
		if (points.length < 2)
			return ''

		const stepX = width / (points.length - 1)

		let path = ''
		points.forEach((point, index) => {
			const x = index * stepX
			const y = height - ((point.value - minValue) / valueRange) * height

			if (index === 0) {
				path += `M ${x} ${y}`
			} else {
				// スムーズなカーブ
				const prevX = (index - 1) * stepX
				const prevY = height - ((points[index - 1].value - minValue) / valueRange) * height
				const midX = (prevX + x) / 2

				path += ` Q ${midX} ${prevY} ${x} ${y}`
			}
		})

		return path
	}

	// 色設定
	const getColorClass = (colorName: string) => {
		const colorMap = {
			primary: 'text-primary stroke-primary fill-primary',
			secondary: 'text-secondary stroke-secondary fill-secondary',
			accent: 'text-accent stroke-accent fill-accent',
			success: 'text-success stroke-success fill-success',
			warning: 'text-warning stroke-warning fill-warning',
			error: 'text-error stroke-error fill-error',
		}
		return colorMap[colorName as keyof typeof colorMap] || colorMap.primary
	}

	const colorClass = getColorClass(color)

	onMount(() => {
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

		if (chartContainer) {
			observer.observe(chartContainer)
		}

		return () => observer.disconnect()
	})
</script>

<div bind:this={chartContainer} class='w-full'>
	<!-- タイトル -->
	<div class='mb-3'>
		<h3 class='text-sm font-semibold text-base-content mb-1'>{title}</h3>
		<div class='flex items-center space-x-4 text-xs text-base-content/60'>
			<span>最高値: {maxValue.toLocaleString()}</span>
			<span>最低値: {minValue.toLocaleString()}</span>
		</div>
	</div>

	<!-- チャート -->
	<div class='relative' style:height='{height}px'>
		<svg width='100%' {height} class='overflow-visible'>
			{#if type === 'line'}
				<!-- ライングラフ -->
				{#if animatedData.length > 1}
					<!-- グラデーション定義 -->
					<defs>
						<linearGradient id='gradient-{color}' x1='0%' y1='0%' x2='0%' y2='100%'>
							<stop offset='0%' style='stop-color:currentColor;stop-opacity:0.3' class={colorClass} />
							<stop offset='100%' style='stop-color:currentColor;stop-opacity:0.05' class={colorClass} />
						</linearGradient>
					</defs>

					<!-- エリアの塗りつぶし -->
					<path
						d='{generatePath(animatedData, chartContainer?.clientWidth || 300, height)} L {chartContainer?.clientWidth || 300} {height} L 0 {height} Z'
						fill='url(#gradient-{color})'
					/>

					<!-- 線 -->
					<path
						d={generatePath(animatedData, chartContainer?.clientWidth || 300, height)}
						stroke='currentColor'
						stroke-width='3'
						fill='none'
						class={colorClass}
						style:filter='drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
					/>

					<!-- データポイント -->
					{#each animatedData as point, index}
						<circle
							cx={index * ((chartContainer?.clientWidth || 300) / (animatedData.length - 1))}
							cy={height - ((point.value - minValue) / valueRange) * height}
							r='4'
							fill='currentColor'
							class='{colorClass} opacity-80 hover:opacity-100 transition-opacity'
						>
							<title>{point.label}: {point.value.toLocaleString()}</title>
						</circle>
					{/each}
				{/if}
			{:else}
				<!-- バーチャート -->
				{#each animatedData as point, index}
					{@const barWidth = (chartContainer?.clientWidth || 300) / data.length * 0.8}
					{@const normalizedValue = Math.max(0, (point.value - minValue) / (valueRange || 1))}
					{@const barHeight = Math.max(0, normalizedValue * height)}
					{@const x = index * ((chartContainer?.clientWidth || 300) / data.length) + ((chartContainer?.clientWidth || 300) / data.length - barWidth) / 2}

					<rect
						{x}
						y={height - barHeight}
						width={barWidth}
						height={barHeight}
						fill='currentColor'
						class='{colorClass} opacity-80 hover:opacity-100 transition-all hover:scale-105'
						rx='2'
					>
						<title>{point.label}: {point.value.toLocaleString()}</title>
					</rect>
				{/each}
			{/if}
		</svg>

		<!-- X軸ラベル（オプション） -->
		{#if data.length <= 7}
			<div class='flex justify-between mt-2 text-xs text-base-content/50'>
				{#each data as point}
					<span class='text-center' style='width: {100 / data.length}%'>
						{point.label}
					</span>
				{/each}
			</div>
		{/if}
	</div>
</div>
