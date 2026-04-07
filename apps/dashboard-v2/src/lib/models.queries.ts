import { queryOptions } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface ModelListItem {
	id: string
	name: string
	provider: string
	pricing: {
		prompt?: string | null
		completion?: string | null
	}
	context_length?: number | null
	top_provider?: boolean
}

export interface ModelsResponse {
	models: ModelListItem[]
}

export const modelsQuery = queryOptions({
	queryKey: ['models'],
	queryFn: async (): Promise<ModelsResponse> => {
		const res = await api.api.settings.models.$get()
		if (!res.ok) throw new Error('Failed to fetch models')
		return res.json()
	},
	staleTime: 60 * 60 * 1000,
	gcTime: 2 * 60 * 60 * 1000,
})
