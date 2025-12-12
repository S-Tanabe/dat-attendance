import { writable } from 'svelte/store'

export type ToastType = 'success' | 'error' | 'info' | 'warning'
export interface Toast {
	id: number
	type: ToastType
	message: string
	description?: string
	timeout?: number // ms
}

let idSeq = 1
const { subscribe, update } = writable<Toast[]>([])

export const toasts = { subscribe }

export function notify(t: Omit<Toast, 'id'>) {
	const id = idSeq++
	const toast: Toast = { id, timeout: 3500, ...t }
	update((list) => [...list, toast])
	if (toast.timeout && toast.timeout > 0) {
		setTimeout(() => close(id), toast.timeout)
	}
}

export function close(id: number) {
	update((list) => list.filter((t) => t.id !== id))
}

export const toast = {
	success: (message: string, description?: string) => notify({ type: 'success', message, description }),
	error: (message: string, description?: string) => notify({ type: 'error', message, description, timeout: 6000 }),
	info: (message: string, description?: string) => notify({ type: 'info', message, description }),
	warning: (message: string, description?: string) => notify({ type: 'warning', message, description }),
}
