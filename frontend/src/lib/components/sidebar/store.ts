import type { SidebarConfig, SidebarMode, SidebarState } from './types'
import { browser } from '$app/environment'
import { derived, get, writable } from 'svelte/store'

/**
 * デフォルト設定
 */
const DEFAULT_CONFIG: Required<SidebarConfig> = {
	defaultMode: 'expanded',
	storageKey: 'sidebar_state',
	iconSize: 'md',
	transitionDuration: 200,
	hoverDelay: 100,
	maxDepth: 3,
	mobileBreakpoint: 768,
}

/**
 * 初期状態
 */
const INITIAL_STATE: SidebarState = {
	mode: 'expanded',
	expandedItems: [],
	activeItemId: undefined,
	expandedGroups: [],
	isOpen: false,
}

/**
 * サイドバー設定ストア
 */
function createConfigStore() {
	const { subscribe, set, update } = writable<Required<SidebarConfig>>(DEFAULT_CONFIG)

	return {
		subscribe,
		set,
		update,
		reset: () => set(DEFAULT_CONFIG),
	}
}

/**
 * サイドバー状態ストア
 */
function createSidebarStore() {
	const config = createConfigStore()
	const { subscribe, set, update } = writable<SidebarState>(INITIAL_STATE)
	let initialized = false // 初期化フラグを追加

	// localStorageから状態を復元
	function loadFromStorage(): SidebarState | null {
		if (!browser)
			return null

		const configValue = get(config)
		const stored = localStorage.getItem(configValue.storageKey)

		if (stored) {
			try {
				const parsed = JSON.parse(stored) as Partial<SidebarState>
				return {
					...INITIAL_STATE,
					...parsed,
				}
			} catch (error) {
				console.error('Failed to parse sidebar state from localStorage:', error)
				localStorage.removeItem(configValue.storageKey)
			}
		}
		return null
	}

	// localStorageに状態を保存
	function saveToStorage(state: SidebarState): void {
		if (!browser || !initialized)
			return // 初期化前は保存しない

		const configValue = get(config)
		try {
			localStorage.setItem(configValue.storageKey, JSON.stringify(state))
		} catch (error) {
			console.error('Failed to save sidebar state to localStorage:', error)
		}
	}

	// ストアの変更を監視してlocalStorageに保存
	if (browser) {
		subscribe((state) => {
			saveToStorage(state)
		})
	}

	return {
		subscribe,
		config,

		/**
		 * 初期化
		 */
		init(): void {
			// localStorageから復元
			const storedState = loadFromStorage()

			if (storedState) {
				// 保存された状態がある場合はそれを使用
				set(storedState)
			} else {
				// 初回の場合のみモバイル判定
				if (browser) {
					const configValue = get(config)
					const isMobile = window.innerWidth < configValue.mobileBreakpoint
					if (isMobile) {
						update((state) => ({
							...state,
							mode: 'hover',
							isOpen: false,
						}))
					}
				}
			}

			// 初期化完了フラグを立てる
			initialized = true

			// 初期化後に現在の状態を保存
			const currentState = get({ subscribe })
			saveToStorage(currentState)
		},

		/**
		 * モードを設定
		 */
		setMode(mode: SidebarMode): void {
			update((state) => {
				const newState = {
					...state,
					mode,
				}
				saveToStorage(newState)
				return newState
			})
		},

		/**
		 * モードをトグル
		 */
		toggleMode(): void {
			update((state) => {
				const newMode: SidebarMode = state.mode === 'expanded' ? 'hover' : 'expanded'
				const newState = {
					...state,
					mode: newMode,
				}
				saveToStorage(newState)
				return newState
			})
		},

		/**
		 * アイテムの展開状態をトグル
		 */
		toggleItem(itemId: string): void {
			update((state) => {
				const expandedItems = state.expandedItems.includes(itemId)
					? state.expandedItems.filter((id) => id !== itemId)
					: [...state.expandedItems, itemId]

				const newState = {
					...state,
					expandedItems,
				}
				saveToStorage(newState)
				return newState
			})
		},

		/**
		 * アイテムを展開
		 */
		expandItem(itemId: string): void {
			update((state) => {
				if (!state.expandedItems.includes(itemId)) {
					const newState = {
						...state,
						expandedItems: [...state.expandedItems, itemId],
					}
					saveToStorage(newState)
					return newState
				}
				return state
			})
		},

		/**
		 * アイテムを折りたたむ
		 */
		collapseItem(itemId: string): void {
			update((state) => {
				const newState = {
					...state,
					expandedItems: state.expandedItems.filter((id) => id !== itemId),
				}
				saveToStorage(newState)
				return newState
			})
		},

		/**
		 * すべてのアイテムを展開
		 */
		expandAll(itemIds: string[]): void {
			update((state) => {
				const newState = {
					...state,
					expandedItems: itemIds,
				}
				saveToStorage(newState)
				return newState
			})
		},

		/**
		 * すべてのアイテムを折りたたむ
		 */
		collapseAll(): void {
			update((state) => {
				const newState = {
					...state,
					expandedItems: [],
				}
				saveToStorage(newState)
				return newState
			})
		},

		/**
		 * アクティブなアイテムを設定
		 */
		setActiveItem(itemId: string | undefined): void {
			update((state) => {
				const newState = {
					...state,
					activeItemId: itemId,
				}
				saveToStorage(newState)
				return newState
			})
		},

		/**
		 * グループの展開状態をトグル
		 */
		toggleGroup(groupId: string): void {
			update((state) => {
				const expandedGroups = state.expandedGroups.includes(groupId)
					? state.expandedGroups.filter((id) => id !== groupId)
					: [...state.expandedGroups, groupId]

				const newState = {
					...state,
					expandedGroups,
				}
				saveToStorage(newState)
				return newState
			})
		},

		/**
		 * サイドバーの開閉をトグル（モバイル用）
		 */
		toggle(): void {
			update((state) => {
				const newState = {
					...state,
					isOpen: !state.isOpen,
				}
				saveToStorage(newState)
				return newState
			})
		},

		/**
		 * サイドバーを開く
		 */
		open(): void {
			update((state) => {
				const newState = {
					...state,
					isOpen: true,
				}
				saveToStorage(newState)
				return newState
			})
		},

		/**
		 * サイドバーを閉じる
		 */
		close(): void {
			update((state) => {
				const newState = {
					...state,
					isOpen: false,
				}
				saveToStorage(newState)
				return newState
			})
		},

		/**
		 * 状態をリセット
		 */
		reset(): void {
			set(INITIAL_STATE)
			if (browser) {
				const configValue = get(config)
				localStorage.removeItem(configValue.storageKey)
			}
		},

		/**
		 * 親アイテムを自動展開
		 */
		expandParents(parentIds: string[]): void {
			update((state) => {
				const newExpandedItems = new Set([...state.expandedItems, ...parentIds])
				const newState = {
					...state,
					expandedItems: Array.from(newExpandedItems),
				}
				saveToStorage(newState)
				return newState
			})
		},
	}
}

// ストアインスタンスをエクスポート
export const sidebarStore = createSidebarStore()

// 派生ストア
export const sidebarMode = derived(
	sidebarStore,
	($sidebarStore) => $sidebarStore.mode,
)

export const isExpanded = derived(
	sidebarStore,
	($sidebarStore) => $sidebarStore.mode === 'expanded',
)

// collapsed モードは廃止されたが、互換性のために残す
export const isCollapsed = derived(
	sidebarStore,
	() => false,
)

export const isHover = derived(
	sidebarStore,
	($sidebarStore) => $sidebarStore.mode === 'hover',
)

export const isSidebarOpen = derived(
	sidebarStore,
	($sidebarStore) => $sidebarStore.isOpen,
)

export const activeItemId = derived(
	sidebarStore,
	($sidebarStore) => $sidebarStore.activeItemId,
)

/**
 * ウィンドウサイズ監視
 */
if (browser) {
	let resizeTimeout: ReturnType<typeof setTimeout>

	window.addEventListener('resize', () => {
		clearTimeout(resizeTimeout)
		resizeTimeout = setTimeout(() => {
			const configValue = get(sidebarStore.config)
			const isMobile = window.innerWidth < configValue.mobileBreakpoint

			// モバイル時のみ、かつ現在のモードがexpandedの場合のみ変更
			if (isMobile && get(sidebarMode) === 'expanded') {
				sidebarStore.setMode('hover')
				sidebarStore.close()
			}
		}, 200)
	})
}
