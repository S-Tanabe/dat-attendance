<script lang='ts'>
	import type { ProgressData } from '../types'
	import { onMount } from 'svelte'

	interface Props {
		progress: ProgressData
		size?: 'sm' | 'md' | 'lg'
		animationDelay?: number
	}

	const { progress, size = 'md', animationDelay = 0 }: Props = $props()

	let animatedProgress = $state(0)
	let isVisible = $state(false)

	// サイズ設定
	const sizes = {
		sm: { width: 80, strokeWidth: 8, textSize: 'text-sm' },
		md: { width: 120, strokeWidth: 10, textSize: 'text-lg' },
		lg: { width: 160, strokeWidth: 12, textSize: 'text-xl' },
	}

	const config = sizes[size]
	const radius = (config.width - config.strokeWidth) / 2
	const circumference = 2 * Math.PI * radius

	// 進捗率の計算
	const progressPercent = $derived(Math.min((progress.current / progress.target) * 100, 100))

	// アニメーション用の計算
	$effect(() => {
		if (isVisible) {
			const duration = 2000
			const startTime = Date.now()
			const startValue = 0
			const endValue = progressPercent

			const animate = () => {
				const elapsed = Date.now() - startTime
				const progress = Math.min(elapsed / duration, 1)

				// イージング関数（ease-out-cubic）
				const easeOut = 1 - (1 - progress) ** 3
				animatedProgress = startValue + (endValue - startValue) * easeOut

				if (progress < 1) {
					requestAnimationFrame(animate)
				}
			}

			setTimeout(() => {
				animate()
			}, animationDelay)
		}
	})

	// SVGの描画計算
	const strokeDasharray = $derived(circumference)
	const strokeDashoffset = $derived(circumference - (animatedProgress / 100) * circumference)

	onMount(() => {
		// 即座にアニメーションを開始
		setTimeout(() => {
			isVisible = true
		}, animationDelay)
	})

	// 色の設定
	const getColorClasses = (color: string) => {
		const colorMap = {
			primary: 'text-primary stroke-primary',
			secondary: 'text-secondary stroke-secondary',
			accent: 'text-accent stroke-accent',
			success: 'text-success stroke-success',
			warning: 'text-warning stroke-warning',
			error: 'text-error stroke-error',
		}
		return colorMap[color as keyof typeof colorMap] || colorMap.primary
	}

	const colorClasses = getColorClasses(progress.color)
</script>

<div
	id="progress-{progress.title.replace(/\s+/g, '-').toLowerCase()}"
	class='flex flex-col items-center space-y-3 p-4'
>
	<!-- 円形プログレス -->
	<div class='relative'>
		<svg
			width={config.width}
			height={config.width}
			class='transform -rotate-90'
		>
			<!-- 背景の円 -->
			<circle
				cx={config.width / 2}
				cy={config.width / 2}
				r={radius}
				stroke='currentColor'
				stroke-width={config.strokeWidth}
				fill='transparent'
				class='text-base-300'
			/>

			<!-- 進捗の円 -->
			<circle
				cx={config.width / 2}
				cy={config.width / 2}
				r={radius}
				stroke='currentColor'
				stroke-width={config.strokeWidth}
				fill='transparent'
				class={colorClasses}
				style:stroke-dasharray={strokeDasharray}
				style:stroke-dashoffset={strokeDashoffset}
				style:transition='stroke-dashoffset 0.3s ease'
				stroke-linecap='round'
			/>
		</svg>

		<!-- 中央のテキスト -->
		<div class='absolute inset-0 flex items-center justify-center'>
			<div class='text-center'>
				<div class='font-bold {config.textSize} {colorClasses}'>
					{Math.round(animatedProgress)}%
				</div>
				{#if size === 'lg'}
					<div class='text-xs text-base-content/60 mt-1'>
						{progress.current.toLocaleString()} / {progress.target.toLocaleString()}
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- タイトルと説明 -->
	<div class='text-center'>
		<h3 class='font-semibold text-base-content text-sm'>
			{progress.title}
		</h3>
		{#if progress.description}
			<p class='text-xs text-base-content/60 mt-1'>
				{progress.description}
			</p>
		{/if}
		{#if size !== 'lg'}
			<p class='text-xs text-base-content/50 mt-1'>
				{progress.current.toLocaleString()} / {progress.target.toLocaleString()}
			</p>
		{/if}
	</div>
</div>
