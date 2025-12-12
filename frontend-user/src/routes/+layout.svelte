<script lang='ts'>
	import type { Snippet } from 'svelte'
	import ToastHost from '$lib/components/ToastHost.svelte'
	import '../app.css'

	const { children }: { children: Snippet } = $props()
</script>

<svelte:head>
	<title>DAT Attendance - ユーザーポータル</title>
</svelte:head>

{@render children()}
<ToastHost />
