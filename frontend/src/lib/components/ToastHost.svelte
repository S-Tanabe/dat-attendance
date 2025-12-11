<script lang='ts'>
	import type { Toast } from '$lib/stores/toast'
	import { close, toasts } from '$lib/stores/toast'
	import { fade, fly } from 'svelte/transition'

	const ALERT_CLASS: Record<Toast['type'], string> = {
		success: 'alert-success',
		error: 'alert-error',
		info: 'alert-info',
		warning: 'alert-warning',
	}

	const TYPE_LABEL: Record<Toast['type'], string> = {
		success: '成功',
		error: 'エラー',
		info: '情報',
		warning: '警告',
	}
</script>

<div class='toast toast-end toast-bottom z-[1000] max-w-sm' aria-live='assertive' aria-atomic='true'>
	{#each $toasts as t (t.id)}
		<article
			class={`alert shadow-lg transition-all duration-200 ${ALERT_CLASS[t.type]}`}
			in:fly={{ x: 24, duration: 150 }}
			out:fade
			role='status'
			aria-label={`${TYPE_LABEL[t.type]}: ${t.message}`}
		>
			<div class='flex flex-1 items-start gap-3'>
				<div class='space-y-1 text-base-content'>
					<header class='text-xs font-semibold uppercase tracking-wide opacity-80'>{TYPE_LABEL[t.type]}</header>
					<p class='text-sm font-medium leading-snug'>{t.message}</p>
					{#if t.description}
						<p class='text-xs leading-snug opacity-80'>{t.description}</p>
					{/if}
				</div>
				<button
					class='btn btn-ghost btn-xs text-base-content/80 hover:bg-base-content/10'
					type='button'
					onclick={() => close(t.id)}
					aria-label='この通知を閉じる'
				>
					閉じる
				</button>
			</div>
		</article>
	{/each}
</div>
