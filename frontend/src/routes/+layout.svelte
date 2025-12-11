<script lang='ts'>
	import ErrorBoundary from '$lib/components/ErrorBoundary.svelte'
	import ErrorToast from '$lib/components/ErrorToast.svelte'
	import { globalError } from '$lib/stores/error'
	import '../app.css'
</script>

<ErrorBoundary>
	<!-- グローバルエラートースト -->
	{#if $globalError}
		<ErrorToast error={$globalError} />
	{/if}

	<slot />
</ErrorBoundary>
