import { useSyncExternalStore, useCallback } from 'react'

export type ToastVariant = 'success' | 'warning' | 'error' | 'info'

export interface Toast {
	id: string
	message: string
	variant: ToastVariant
}

let toasts: Toast[] = []
let listeners: Array<() => void> = []
let counter = 0

function emit() {
	for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
	listeners = [...listeners, listener]
	return () => {
		listeners = listeners.filter((l) => l !== listener)
	}
}

function getSnapshot() {
	return toasts
}

export function toast(message: string, variant: ToastVariant = 'success') {
	const id = `toast-${++counter}`
	toasts = [...toasts, { id, message, variant }]
	emit()
	setTimeout(() => {
		toasts = toasts.filter((t) => t.id !== id)
		emit()
	}, 3000)
}

export function useToasts() {
	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function useDismissToast() {
	return useCallback((id: string) => {
		toasts = toasts.filter((t) => t.id !== id)
		emit()
	}, [])
}
