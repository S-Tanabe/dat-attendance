<script lang='ts'>
	import { sidebarMode, sidebarStore } from '../store'
	import { IconPaths } from '../types'

	interface Props {
		showLabels?: boolean
	}

	const { showLabels = true }: Props = $props()

	function toggleMode() {
		// 単純にモードを切り替える
		const newMode = $sidebarMode === 'expanded' ? 'hover' : 'expanded'
		sidebarStore.setMode(newMode)
	}

	// 現在のモードに応じた表示
	const buttonIcon = $derived($sidebarMode === 'expanded' ? 'eye' : 'eyeSlash')
	const buttonTooltip = $derived($sidebarMode === 'expanded' ? '自動的に隠す' : '常に表示')
</script>

<button
	class="btn btn-ghost btn-sm w-full {showLabels ? 'justify-start' : 'justify-center'}"
	onclick={toggleMode}
	aria-label={buttonTooltip}
	title={buttonTooltip}
>
	<svg
		class='w-5 h-5'
		fill='none'
		stroke='currentColor'
		stroke-width='2'
		viewBox='0 0 24 24'
	>
		<path
			stroke-linecap='round'
			stroke-linejoin='round'
			d={IconPaths[buttonIcon]}
		/>
	</svg>
	{#if showLabels}
		<span class='ml-2'>{buttonTooltip}</span>
	{/if}
</button>
