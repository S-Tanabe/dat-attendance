<script lang='ts'>
	import type { SidebarItem as ISidebarItem, SidebarGroup } from '../types'
	import { onDestroy, onMount } from 'svelte'
	import { filterGroupsByRole, getFilteredGroupedMenuItems, getMenuGroups } from '../menu-config'
	import { isHover, sidebarMode, sidebarStore } from '../store'
	import SidebarItem from './SidebarItem.svelte'
	import SidebarToggle from './SidebarToggle.svelte'

	const { isDevelopment = false, userRole = null } = $props<{ isDevelopment?: boolean, userRole?: string | null }>()

	const groupedItems = $state<Map<string, ISidebarItem[]>>(
		getFilteredGroupedMenuItems(isDevelopment, userRole),
	)
	let groups = $state<SidebarGroup[]>([])
	let isHovered = $state(false)
	let hoverTimeout: ReturnType<typeof setTimeout>

	// 初期化
	onMount(() => {
		sidebarStore.init()
		// グループをフィルタリング済みのアイテムから取得
		const uniqueGroups = new Set<string>()
		groupedItems.forEach((items, groupId) => {
			if (groupId !== '__default__') {
				uniqueGroups.add(groupId)
			}
		})

		// グループ情報を取得（フィルタリング済み）
		const allGroups = getMenuGroups(isDevelopment)
		groups = filterGroupsByRole(allGroups, userRole).filter((g) => uniqueGroups.has(g.id))
	})

	onDestroy(() => {
		if (hoverTimeout)
			clearTimeout(hoverTimeout)
	})

	// ホバーモードの処理
	function handleMouseEnter() {
		if ($isHover) {
			if (hoverTimeout)
				clearTimeout(hoverTimeout)
			isHovered = true
		}
	}

	function handleMouseLeave() {
		if ($isHover) {
			if (hoverTimeout)
				clearTimeout(hoverTimeout)
			hoverTimeout = setTimeout(() => {
				isHovered = false
			}, 100) // 300ms から 100ms に短縮
		}
	}

	// 実効幅の計算
	const effectiveWidth = $derived($isHover && !isHovered ? 'w-16' : 'w-64')
	const showLabels = $derived($sidebarMode === 'expanded' || ($isHover && isHovered))
</script>

<aside
	class='h-screen sticky top-0 bg-base-100 border-r border-base-300 flex flex-col {effectiveWidth}'
	style='transition: width 150ms ease-in-out;'
	onmouseenter={handleMouseEnter}
	onmouseleave={handleMouseLeave}
	role='navigation'
	aria-label='メインナビゲーション'
>
	<!-- ヘッダー -->
	<div class='shrink-0 p-4 border-b border-base-300 h-[72px] flex items-center justify-center'>
		{#if showLabels}
			<div class='flex flex-col items-center leading-tight' aria-label='FLOW' title='FLOW'>
				<span class='logo-primary text-xl md:text-2xl' aria-hidden='true'>FOX</span>
				<span class='logo-secondary text-sm md:text-base' aria-hidden='true'>HOUND</span>
			</div>
		{:else}
			<div class='w-10 h-10 flex items-center justify-center' aria-label='FLOW' title='FLOW'>
				<span class='logo-compact' aria-hidden='true'>KF</span>
			</div>
		{/if}
	</div>

	<!-- メニューコンテンツ -->
	<div class='flex-1 overflow-y-auto overflow-x-hidden px-2 py-2'>
		<nav>
			{#if groupedItems.size === 0}
				<div class='text-center py-8 text-base-content/50'>
					<p class='text-sm whitespace-nowrap'>メニューアイテムがありません</p>
				</div>
			{:else}
				<!-- グループなしアイテム -->
				{#if groupedItems.has('__default__')}
					<ul class={showLabels ? 'space-y-1' : 'space-y-0'}>
						{#each groupedItems.get('__default__') || [] as item (item.id)}
							<SidebarItem {item} {showLabels} />
						{/each}
					</ul>
				{/if}

				<!-- グループ付きアイテム -->
				{#each groups as group (group.id)}
					{#if groupedItems.has(group.id)}
						<div class={showLabels ? 'mt-6' : 'mt-2'}>
							{#if showLabels}
								<h3 class='px-4 text-xs font-semibold text-base-content/70 uppercase tracking-wider mb-2 whitespace-nowrap'>
									{group.label}
								</h3>
							{:else}
								<div class='divider my-1'></div>
							{/if}
							<ul class={showLabels ? 'space-y-1' : 'space-y-0'}>
								{#each groupedItems.get(group.id) || [] as item (item.id)}
									<SidebarItem {item} {showLabels} />
								{/each}
							</ul>
						</div>
					{/if}
				{/each}

				<!-- グループなし（__default__以外）のグループ -->
				{#each Array.from(groupedItems.keys()).filter((key) => key !== '__default__' && !groups.some((g) => g.id === key)) as ungroupedKey}
					<div class={showLabels ? 'mt-6' : 'mt-2'}>
						{#if showLabels}
							<h3 class='px-4 text-xs font-semibold text-base-content/70 uppercase tracking-wider mb-2 whitespace-nowrap'>
								{ungroupedKey}
							</h3>
						{:else}
							<div class='divider my-1'></div>
						{/if}
						<ul class={showLabels ? 'space-y-1' : 'space-y-0'}>
							{#each groupedItems.get(ungroupedKey) || [] as item (item.id)}
								<SidebarItem {item} {showLabels} />
							{/each}
						</ul>
					</div>
				{/each}
			{/if}
		</nav>
	</div>

	<!-- フッター（トグルボタン） - flexレイアウトで自然に最下部に配置 -->
	<div class='shrink-0 border-t border-base-300 p-2 bg-base-100'>
		<SidebarToggle {showLabels} />
	</div>
</aside>

<style>
  /* スクロールバーのスタイル */
  .overflow-y-auto {
    scrollbar-width: thin;
  }

  .overflow-y-auto::-webkit-scrollbar {
    width: 6px;
  }

  .overflow-y-auto::-webkit-scrollbar-track {
    background: transparent;
  }

  .overflow-y-auto::-webkit-scrollbar-thumb {
    background-color: hsl(var(--b3));
    border-radius: 3px;
  }

  .overflow-y-auto::-webkit-scrollbar-thumb:hover {
    background-color: hsl(var(--b2));
  }
</style>
