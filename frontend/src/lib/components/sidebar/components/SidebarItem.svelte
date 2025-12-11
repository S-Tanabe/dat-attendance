<script lang='ts'>
	import type { SidebarItem } from '../types'
	import { page } from '$app/stores'
	import { activeItemId, sidebarStore } from '../store'
	import { IconPaths } from '../types'
	import Self from './SidebarItem.svelte'

	interface Props {
		item: SidebarItem
		depth?: number
		showLabels?: boolean
	}

	const { item, depth = 0, showLabels = true }: Props = $props()

	let isExpanded = $state(false)

	function matchesPath(path: string, candidate: string, allowPrefixMatch: boolean): boolean {
		if (!candidate)
			return false
		const normalized = candidate.endsWith('/') && candidate !== '/' ? candidate.slice(0, -1) : candidate
		if (path === normalized)
			return true
		if (normalized === '/')
			return path === '/'
		// 子メニューがある親メニューの場合は前方一致を無効化
		// 選択中の子メニューのみアクティブにする
		if (!allowPrefixMatch)
			return false
		return path.startsWith(`${normalized}/`)
	}

	const isActive = $derived.by(() => {
		const path = $page.url.pathname
		const candidates = new Set<string>()
		if (item.href)
			candidates.add(item.href)
		if (item.activeMatch) {
			for (const candidate of item.activeMatch) {
				candidates.add(candidate)
			}
		}
		// 子メニューがある場合は前方一致を無効化（完全一致のみ）
		const allowPrefixMatch = !item.children || item.children.length === 0
		for (const candidate of candidates) {
			if (matchesPath(path, candidate, allowPrefixMatch)) {
				return true
			}
		}
		return false
	})

	// 子メニューのいずれかがアクティブかチェック
	const hasActiveChild = $derived.by(() => {
		if (!item.children || item.children.length === 0)
			return false
		const path = $page.url.pathname
		return item.children.some((child) => {
			const candidates = new Set<string>()
			if (child.href)
				candidates.add(child.href)
			if (child.activeMatch) {
				for (const candidate of child.activeMatch) {
					candidates.add(candidate)
				}
			}
			for (const candidate of candidates) {
				if (matchesPath(path, candidate, true)) {
					return true
				}
			}
			return false
		})
	})

	// 展開状態をストアと同期
	$effect(() => {
		const state = $sidebarStore
		isExpanded = state.expandedItems.includes(item.id)
	})

	// 子メニューがアクティブな場合は親メニューを自動展開
	$effect(() => {
		if (hasActiveChild && !isExpanded) {
			sidebarStore.toggleItem(item.id)
		}
	})

	// URLが変更されたらアクティブアイテムを更新
	$effect(() => {
		if (isActive && item.href) {
			sidebarStore.setActiveItem(item.id)
		} else if (!isActive && $activeItemId === item.id) {
			// このアイテムがアクティブでなくなったらストアをクリア
			sidebarStore.setActiveItem(undefined)
		}
	})

	async function handleClick(e: MouseEvent) {
		if (item.disabled) {
			e.preventDefault()
			return
		}

		// 子要素がある場合は展開/折りたたみ（モードに関係なく動作）
		if (item.children && item.children.length > 0) {
			e.preventDefault()
			sidebarStore.toggleItem(item.id)
		} else if (item.action) {
			e.preventDefault()
			await item.action()
		} else if (item.href) {
			// SvelteKitのナビゲーションに任せる
			sidebarStore.setActiveItem(item.id)

			// モバイルの場合はサイドバーを閉じる
			if (window.innerWidth < 768) {
				sidebarStore.close()
			}
		}
	}

	// インデントクラス
	const indentClass = depth === 0 ? '' : depth === 1 ? 'pl-8' : 'pl-12'

	// アイコンサイズ
	const iconSize = depth === 0 ? 'w-5 h-5' : 'w-4 h-4'
</script>

<li class='relative'>
	<!-- メインアイテム -->
	<a
		href={item.href || '#'}
		class="{isActive ? 'bg-primary hover:bg-primary/80 text-primary-content' : 'hover:bg-base-200'}
			flex items-center gap-3 px-4 py-2 rounded-lg transition-colors {indentClass}
			{item.disabled ? 'opacity-50 cursor-not-allowed' : ''}
			{!showLabels && depth === 0 ? 'justify-center' : ''}"
		onclick={handleClick}
		aria-disabled={item.disabled}
		aria-current={isActive ? 'page' : undefined}
		title={!showLabels ? item.label : undefined}
	>
		<!-- アイコン -->
		{#if item.icon && IconPaths[item.icon]}
			<svg
				class='{iconSize} shrink-0'
				fill='none'
				stroke='currentColor'
				stroke-width='2'
				viewBox='0 0 24 24'
				aria-hidden='true'
			>
				<path stroke-linecap='round' stroke-linejoin='round' d={IconPaths[item.icon]} />
			</svg>
		{:else if item.children && item.children.length > 0 && showLabels}
			<svg
				class='{iconSize} shrink-0'
				class:rotate-90={isExpanded}
				fill='none'
				stroke='currentColor'
				stroke-width='2'
				viewBox='0 0 24 24'
				aria-hidden='true'
			>
				<path stroke-linecap='round' stroke-linejoin='round' d={IconPaths.chevronRight} />
			</svg>
		{:else if showLabels}
			<span class='{iconSize} shrink-0'></span>
		{/if}

		<!-- ラベル（showLabelsがtrueの時のみ表示） -->
		{#if showLabels}
			<span class='flex-1 text-sm whitespace-nowrap overflow-hidden text-ellipsis'>
				{item.label}
			</span>

			<!-- バッジ -->
			{#if item.badge}
				<span class='badge badge-sm shrink-0' class:badge-primary={!isActive}>
					{item.badge}
				</span>
			{/if}

			<!-- 子要素がある場合の展開アイコン -->
			{#if item.children && item.children.length > 0 && item.icon}
				<svg
					class='w-4 h-4 shrink-0'
					class:rotate-90={isExpanded}
					fill='none'
					stroke='currentColor'
					stroke-width='2'
					viewBox='0 0 24 24'
					aria-hidden='true'
				>
					<path stroke-linecap='round' stroke-linejoin='round' d={IconPaths.chevronRight} />
				</svg>
			{/if}
		{/if}
	</a>

	<!-- 子要素（展開時に表示、ただしshowLabelsがfalseの時は非表示） -->
	{#if item.children && item.children.length > 0 && isExpanded && depth < 2 && showLabels}
		<ul class='mt-1'>
			{#each item.children as child (child.id)}
				<Self item={child} depth={depth + 1} {showLabels} />
			{/each}
		</ul>
	{/if}
</li>
