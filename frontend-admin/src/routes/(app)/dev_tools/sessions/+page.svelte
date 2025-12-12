<script lang='ts'>
	import type { dev_tools } from '$lib/generated/client'
	import SessionManager from '../components/SessionManager.svelte'

	// Svelte 5 Runes mode - use $props() instead of export let
	const { data, form } = $props()

	type PageData = { stats: dev_tools.SessionStatsResponse | null, error?: string }
	const pageData = data as PageData
</script>

<svelte:head>
	<title>セッション管理 - 開発者ツール - FOX HOUND</title>
</svelte:head>

<div class='container mx-auto px-4 py-8'>
	<div class='mb-6'>
		<div class='flex items-center gap-3 mb-4'>
			<span class='text-3xl'>👥</span>
			<h1 class='text-3xl font-bold'>セッション管理</h1>
		</div>
		<p class='text-base-content/70 text-lg'>
			アクティブセッションの監視・制御・クリーンアップを行います
		</p>
	</div>

	<SessionManager stats={pageData.stats} form={form} />
</div>
