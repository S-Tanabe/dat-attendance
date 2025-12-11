import type { SidebarGroup, SidebarItem } from './types'

/**
 * サイドバーメニュー設定
 * このファイルを編集してメニュー構造をカスタマイズできます
 */

// グループ定義（基本）
const baseGroups: SidebarGroup[] = [
	{ id: 'main', label: 'メイン', order: 50 },
	{ id: 'management', label: '管理', order: 200, requiredRole: 'admin' },
]

// 開発用グループ（条件付きで追加）
const devGroup: SidebarGroup = {
	id: 'development',
	label: '開発',
	order: 500,
	requiredRole: 'super_admin', // super_adminのみ表示
}

// 環境に応じてグループを構築
export function getMenuGroups(isDevelopment: boolean = false): SidebarGroup[] {
	return isDevelopment ? [...baseGroups, devGroup] : baseGroups
}

// 後方互換性のため、デフォルトエクスポートも提供
export const menuGroups = baseGroups

// メニューアイテム定義 - sample
export const menuItems: SidebarItem[] = [
	// 既存メインメニュー
	{ id: 'dashboard', label: 'ダッシュボード', icon: 'home', href: '/dashboard', group: 'main', order: 50 },

	// // 管理
	{
		id: 'users_admin',
		label: 'ユーザー管理',
		icon: 'users',
		href: '/users',
		group: 'management',
		order: 400,
		requiredRole: 'admin',
		activeMatch: ['/users'],
	},
]

// 開発用メニューアイテム
export const devMenuItems: SidebarItem[] = [
	{
		id: 'dev_tools',
		label: 'セキュリティ',
		icon: 'spy',
		href: '/dev_tools',
		group: 'development',
		order: 510,
		requiredRole: 'super_admin', // super_adminのみ表示
		activeMatch: ['/dev_tools'],
		children: [
			{
				id: 'dev_tools_sessions',
				label: 'セッション管理',
				icon: 'users',
				href: '/dev_tools/sessions',
				order: 511,
			},
			{
				id: 'dev_tools_security_ip_trust',
				label: 'IPアドレス信頼度',
				icon: 'shieldCheck',
				href: '/dev_tools/security/ip-trust',
				order: 513,
				activeMatch: ['/dev_tools/security/ip-trust'],
			},
			{
				id: 'dev_tools_devices',
				label: 'デバイス管理',
				icon: 'devicePhoneMobile',
				href: '/dev_tools/devices',
				order: 514,
				activeMatch: ['/dev_tools/devices'],
			},
			// {
			//   id: 'dev_tools_storage',
			//   label: 'バケットエクスプローラー',
			//   icon: 'folder',
			//   href: '/dev_tools/storage',
			//   order: 515
			// }
		],
	},
	{
		id: 'dev_tools_storage',
		label: 'バケットエクスプローラー',
		icon: 'folder',
		href: '/dev_tools/storage',
		group: 'development',
		order: 515,
		activeMatch: ['/dev_tools/storage'],
	},
	{
		id: 'dev_tools_notifications',
		label: '通知のテスト',
		icon: 'chart',
		group: 'development',
		href: '/dev_tools/notifications',
		order: 516,
		activeMatch: ['/dev_tools/notifications'],
	},
	{
		id: 'dev_tools_error_testing',
		label: 'エラーハンドリングテスト',
		icon: 'exclamation',
		group: 'development',
		href: '/dev_tools/error-testing',
		order: 517,
		activeMatch: ['/dev_tools/error-testing'],
	},
]

// 環境に応じてメニューアイテムを取得
export function getAllMenuItems(isDevelopment: boolean = false): SidebarItem[] {
	return isDevelopment ? [...menuItems, ...devMenuItems] : menuItems
}

/**
 * メニューをグループごとに整理して取得
 */
export function getGroupedMenuItems(isDevelopment: boolean = false): Map<string, SidebarItem[]> {
	const grouped = new Map<string, SidebarItem[]>()
	const allItems = getAllMenuItems(isDevelopment)
	const allGroups = getMenuGroups(isDevelopment)

	// グループなしアイテム
	const noGroup = allItems.filter((item) => !item.group)
	if (noGroup.length > 0) {
		grouped.set('__default__', sortItems(noGroup))
	}

	// グループ付きアイテム
	allGroups.forEach((group) => {
		const items = allItems.filter((item) => item.group === group.id)
		if (items.length > 0) {
			grouped.set(group.id, sortItems(items))
		}
	})

	return grouped
}

// （注）同等の関数は下部に既存実装があるため重複定義を削除しました。

/**
 * パスから該当するメニューアイテムを検索
 */
export function findMenuItemByPath(path: string): SidebarItem | undefined {
	for (const item of menuItems) {
		if (matchesItem(path, item)) {
			return item
		}
		if (item.children) {
			const found = findInChildren(item.children, path)
			if (found)
				return found
		}
	}
	return undefined
}

/**
 * 子要素から検索（再帰）
 */
function findInChildren(children: SidebarItem[], path: string): SidebarItem | undefined {
	for (const child of children) {
		if (matchesItem(path, child)) {
			return child
		}
		if (child.children) {
			const found = findInChildren(child.children, path)
			if (found)
				return found
		}
	}
	return undefined
}

function matchesItem(path: string, item: SidebarItem): boolean {
	const candidates = new Set<string>()
	if (item.href) {
		candidates.add(item.href)
	}
	if (item.activeMatch) {
		for (const candidate of item.activeMatch) {
			candidates.add(candidate)
		}
	}
	for (const candidate of candidates) {
		if (matchesPath(path, candidate)) {
			return true
		}
	}
	return false
}

function matchesPath(path: string, candidate: string): boolean {
	if (!candidate)
		return false
	const normalized = candidate.endsWith('/') && candidate !== '/' ? candidate.slice(0, -1) : candidate
	if (path === normalized)
		return true
	if (normalized === '/')
		return path === '/'
	return path.startsWith(`${normalized}/`)
}

/**
 * アイテムをソート
 */
function sortItems(items: SidebarItem[]): SidebarItem[] {
	const sorted = [...items].sort((a, b) => (a.order ?? 999) - (b.order ?? 999))

	// 子アイテムも再帰的にソート
	return sorted.map((item) => ({
		...item,
		children: item.children ? sortItems(item.children) : undefined,
	}))
}

/**
 * アイテムのすべての親IDを取得
 */
export function getParentIds(itemId: string): string[] {
	const parentIds: string[] = []

	function findParents(items: SidebarItem[], targetId: string, currentPath: string[] = []): boolean {
		for (const item of items) {
			if (item.id === targetId) {
				parentIds.push(...currentPath)
				return true
			}
			if (item.children) {
				const found = findParents(item.children, targetId, [...currentPath, item.id])
				if (found)
					return true
			}
		}
		return false
	}

	findParents(menuItems, itemId)
	return parentIds
}

/**
 * 権限に基づいてメニューアイテムをフィルタリング
 */
export function filterMenuItemsByRole(
	items: SidebarItem[],
	userRole?: string | null,
): SidebarItem[] {
	return items.filter((item) => {
		// requiredRoleが設定されていない場合は全員に表示
		if (!item.requiredRole)
			return true

		// ユーザーのロールがない場合は非表示
		if (!userRole)
			return false

		// ロールレベルでチェック
		const roleLevel = getRoleLevel(userRole)
		const requiredLevel = getRoleLevel(item.requiredRole)

		return roleLevel >= requiredLevel
	}).map((item) => ({
		...item,
		children: item.children ? filterMenuItemsByRole(item.children, userRole) : undefined,
	}))
}

/**
 * 権限に基づいてグループをフィルタリング
 */
export function filterGroupsByRole(
	groups: SidebarGroup[],
	userRole?: string | null,
): SidebarGroup[] {
	return groups.filter((group) => {
		// requiredRoleが設定されていない場合は全員に表示
		if (!group.requiredRole)
			return true

		// ユーザーのロールがない場合は非表示
		if (!userRole)
			return false

		// ロールレベルでチェック
		const roleLevel = getRoleLevel(userRole)
		const requiredLevel = getRoleLevel(group.requiredRole)

		return roleLevel >= requiredLevel
	})
}

/**
 * ロールレベルを取得
 */
function getRoleLevel(role: string): number {
	switch (role) {
		case 'super_admin':
			return 1000
		case 'admin':
			return 100
		case 'user':
			return 10
		default:
			return 0
	}
}

/**
 * 権限を考慮したグループごとのメニュー取得
 */
export function getFilteredGroupedMenuItems(
	isDevelopment: boolean = false,
	userRole?: string | null,
): Map<string, SidebarItem[]> {
	const grouped = new Map<string, SidebarItem[]>()
	const allItems = getAllMenuItems(isDevelopment)
	const allGroups = getMenuGroups(isDevelopment)

	// 権限でフィルタリング
	const filteredItems = filterMenuItemsByRole(allItems, userRole)
	const filteredGroups = filterGroupsByRole(allGroups, userRole)

	// グループなしアイテム
	const noGroup = filteredItems.filter((item) => !item.group)
	if (noGroup.length > 0) {
		grouped.set('__default__', sortItems(noGroup))
	}

	// グループ付きアイテム
	filteredGroups.forEach((group) => {
		const items = filteredItems.filter((item) => item.group === group.id)
		if (items.length > 0) {
			grouped.set(group.id, sortItems(items))
		}
	})

	return grouped
}
