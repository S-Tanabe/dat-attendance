// コンポーネント
export { default as Sidebar } from './components/Sidebar.svelte'
export { default as SidebarItem } from './components/SidebarItem.svelte'
export { default as SidebarToggle } from './components/SidebarToggle.svelte'

// メニュー設定
export {
	findMenuItemByPath,
	getGroupedMenuItems,
	getParentIds,
	menuGroups,
	menuItems,
} from './menu-config'

// ストア
export {
	activeItemId,
	isCollapsed,
	isExpanded,
	isHover,
	isSidebarOpen,
	sidebarMode,
	sidebarStore,
} from './store'

// 型定義
export type {
	SidebarConfig,
	SidebarGroup,
	SidebarItem as SidebarItemType,
	SidebarMode,
	SidebarState,
} from './types'
