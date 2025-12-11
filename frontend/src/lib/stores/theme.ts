import { browser } from '$app/environment'
import { writable } from 'svelte/store'

// DaisyUIの利用可能なテーマ
export const themes = [
	'light',
	'dark',
	'cupcake',
	'bumblebee',
	'emerald',
	'corporate',
	'synthwave',
	'retro',
	'cyberpunk',
	'valentine',
	'halloween',
	'garden',
	'forest',
	'aqua',
	'lofi',
	'pastel',
	'fantasy',
	'wireframe',
	'black',
	'luxury',
	'dracula',
	'cmyk',
	'autumn',
	'business',
	'acid',
	'lemonade',
	'night',
	'coffee',
	'winter',
	'dim',
	'nord',
	'sunset',
] as const

export type Theme = typeof themes[number]

function createThemeStore() {
	const { subscribe, set } = writable<Theme>('light')

	return {
		subscribe,
		set: (theme: Theme) => {
			if (browser) {
				// localStorageに保存
				localStorage.setItem('theme', theme)
				// data-theme属性を設定
				document.documentElement.setAttribute('data-theme', theme)
			}
			set(theme)
		},
		init: () => {
			if (browser) {
				// localStorageから読み込み
				const savedTheme = localStorage.getItem('theme')
				if (savedTheme && themes.includes(savedTheme as Theme)) {
					document.documentElement.setAttribute('data-theme', savedTheme)
					set(savedTheme as Theme)
				}
			}
		},
	}
}

export const themeStore = createThemeStore()
