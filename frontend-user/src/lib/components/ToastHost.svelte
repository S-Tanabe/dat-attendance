<script lang='ts'>
	import type { Toast } from '$lib/stores/toast'
	import { close, toasts } from '$lib/stores/toast'
	import { fade, fly } from 'svelte/transition'

	const ALERT_CLASS: Record<Toast['type'], string> = {
		success: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700',
		error: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700',
		info: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700',
		warning: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700',
	}

	const TYPE_ICON: Record<Toast['type'], string> = {
		success: 'M5 13l4 4L19 7',
		error: 'M6 18L18 6M6 6l12 12',
		info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
		warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
	}

	const TYPE_LABEL: Record<Toast['type'], string> = {
		success: '成功',
		error: 'エラー',
		info: '情報',
		warning: '警告',
	}
</script>

<div class='fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-sm z-50' aria-live='assertive' aria-atomic='true'>
	{#each $toasts as t (t.id)}
		<article
			class='mb-2 p-4 rounded-xl border shadow-lg {ALERT_CLASS[t.type]}'
			in:fly={{ y: 24, duration: 200 }}
			out:fade={{ duration: 150 }}
			role='status'
			aria-label='{TYPE_LABEL[t.type]}: {t.message}'
		>
			<div class='flex items-start gap-3'>
				<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5 flex-shrink-0 mt-0.5' fill='none' viewBox='0 0 24 24' stroke='currentColor' stroke-width='2'>
					<path stroke-linecap='round' stroke-linejoin='round' d={TYPE_ICON[t.type]} />
				</svg>
				<div class='flex-1 min-w-0'>
					<p class='text-sm font-medium'>{t.message}</p>
					{#if t.description}
						<p class='text-xs mt-1 opacity-80'>{t.description}</p>
					{/if}
				</div>
				<button
					class='flex-shrink-0 p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors'
					type='button'
					onclick={() => close(t.id)}
					aria-label='この通知を閉じる'
				>
					<svg xmlns='http://www.w3.org/2000/svg' class='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' stroke-width='2'>
						<path stroke-linecap='round' stroke-linejoin='round' d='M6 18L18 6M6 6l12 12' />
					</svg>
				</button>
			</div>
		</article>
	{/each}
</div>
