<script lang='ts'>
	import type { Theme } from '$lib/stores/theme'
	import { themeStore } from '$lib/stores/theme'
	import { onMount } from 'svelte'

	let currentTheme: Theme = 'light'

	// ストアの購読
	$: currentTheme = $themeStore

	onMount(() => {
		// 初期化
		themeStore.init()
	})

	function selectTheme(theme: Theme) {
		themeStore.set(theme)
	}

	// テーマのカテゴリ分け
	const lightThemes: Theme[] = ['light', 'cupcake', 'bumblebee', 'emerald', 'corporate', 'retro', 'valentine', 'garden', 'aqua', 'lofi', 'pastel', 'fantasy', 'wireframe', 'cmyk', 'autumn', 'acid', 'lemonade', 'winter']
	const darkThemes: Theme[] = ['dark', 'synthwave', 'halloween', 'forest', 'black', 'luxury', 'dracula', 'business', 'night', 'coffee', 'dim', 'nord', 'sunset', 'cyberpunk']
</script>

<div class='space-y-6'>
	<div>
		<h3 class='text-lg font-medium mb-4'>テーマ設定</h3>
		<p class='text-sm text-base-content/70 mb-6'>
			お好みのテーマを選択してください。選択したテーマは即座に適用され、自動的に保存されます。
		</p>
	</div>

	<!-- 現在のテーマ表示 -->
	<div class='alert alert-info'>
		<svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' class='stroke-current shrink-0 w-6 h-6'>
			<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'></path>
		</svg>
		<span>現在のテーマ: <strong class='capitalize'>{currentTheme}</strong></span>
	</div>

	<!-- ライトテーマ -->
	<div>
		<h4 class='text-sm font-medium text-base-content/70 mb-3'>ライトテーマ</h4>
		<div class='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3'>
			{#each lightThemes as theme}
				<button
					onclick={() => selectTheme(theme)}
					class="group relative overflow-hidden rounded-lg border-2 transition-all hover:scale-105 {currentTheme === theme ? 'border-primary ring-2 ring-primary ring-offset-2' : 'border-base-300 hover:border-primary/50'}"
					data-theme={theme}
				>
					<div class='p-3'>
						<!-- テーマプレビュー -->
						<div class='flex gap-1 mb-2'>
							<div class='w-2 h-2 rounded-full bg-primary'></div>
							<div class='w-2 h-2 rounded-full bg-secondary'></div>
							<div class='w-2 h-2 rounded-full bg-accent'></div>
							<div class='w-2 h-2 rounded-full bg-neutral'></div>
						</div>
						<div class='text-xs font-medium capitalize'>{theme}</div>
					</div>
					{#if currentTheme === theme}
						<div class='absolute top-1 right-1'>
							<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='currentColor' class='w-4 h-4 text-primary'>
								<path fill-rule='evenodd' d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z' clip-rule='evenodd' />
							</svg>
						</div>
					{/if}
				</button>
			{/each}
		</div>
	</div>

	<!-- ダークテーマ -->
	<div>
		<h4 class='text-sm font-medium text-base-content/70 mb-3'>ダークテーマ</h4>
		<div class='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3'>
			{#each darkThemes as theme}
				<button
					onclick={() => selectTheme(theme)}
					class="group relative overflow-hidden rounded-lg border-2 transition-all hover:scale-105 {currentTheme === theme ? 'border-primary ring-2 ring-primary ring-offset-2' : 'border-base-300 hover:border-primary/50'}"
					data-theme={theme}
				>
					<div class='p-3'>
						<!-- テーマプレビュー -->
						<div class='flex gap-1 mb-2'>
							<div class='w-2 h-2 rounded-full bg-primary'></div>
							<div class='w-2 h-2 rounded-full bg-secondary'></div>
							<div class='w-2 h-2 rounded-full bg-accent'></div>
							<div class='w-2 h-2 rounded-full bg-neutral'></div>
						</div>
						<div class='text-xs font-medium capitalize'>{theme}</div>
					</div>
					{#if currentTheme === theme}
						<div class='absolute top-1 right-1'>
							<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='currentColor' class='w-4 h-4 text-primary'>
								<path fill-rule='evenodd' d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z' clip-rule='evenodd' />
							</svg>
						</div>
					{/if}
				</button>
			{/each}
		</div>
	</div>
</div>
