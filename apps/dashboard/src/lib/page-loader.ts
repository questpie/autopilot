import { lazy, type LazyExoticComponent, type ComponentType } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

// ── Types ──────────────────────────────────────────────────────

export interface CustomPage {
	id: string
	title: string
	path: string
	icon: string
	file: string
	nav?: boolean
}

export interface PageRegistry {
	pages: CustomPage[]
}

// ── Hook ───────────────────────────────────────────────────────

export function useCustomPages() {
	return useQuery({
		queryKey: ['dashboard-pages'],
		queryFn: async () => {
			try {
				const data = await apiFetch<PageRegistry>('/api/dashboard/pages')
				return data.pages ?? []
			} catch {
				return []
			}
		},
		staleTime: 30_000,
		retry: false,
	})
}

// ── Lazy Page Loader ───────────────────────────────────────────

const pageCache = new Map<string, LazyExoticComponent<ComponentType>>()

export function getCustomPageComponent(file: string): LazyExoticComponent<ComponentType> {
	if (!pageCache.has(file)) {
		const LazyPage = lazy(async () => {
			const module = await import(
				/* @vite-ignore */
				`/fs/dashboard/pages/${file}`
			)
			return { default: module.default }
		})
		pageCache.set(file, LazyPage)
	}
	return pageCache.get(file)!
}
