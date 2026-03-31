import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { queryOptions } from '@tanstack/react-query'

export const statusQuery = queryOptions({
	queryKey: queryKeys.status.root,
	queryFn: async () => {
		const res = await api.api.status.$get()
		if (!res.ok) throw new Error('Failed to fetch status')
		return res.json()
	},
})

export const pinsQuery = queryOptions({
	queryKey: queryKeys.pins.list(),
	queryFn: async () => {
		const res = await api.api.pins.$get()
		if (!res.ok) throw new Error('Failed to fetch pins')
		return res.json()
	},
})

export const inboxQuery = queryOptions({
	queryKey: queryKeys.inbox.list(),
	queryFn: async () => {
		const res = await api.api.inbox.$get()
		if (!res.ok) throw new Error('Failed to fetch inbox')
		return res.json()
	},
})

export function activityQuery(filters?: { agent?: string; limit?: number }) {
	return queryOptions({
		queryKey: queryKeys.activity.list(filters),
		queryFn: async () => {
			const res = await api.api.activity.$get({
				query: {
					agent: filters?.agent,
					limit: filters?.limit?.toString(),
				},
			})
			if (!res.ok) throw new Error('Failed to fetch activity')
			return res.json()
		},
	})
}

export const dashboardGroupsQuery = queryOptions({
	queryKey: queryKeys.dashboard.list({ type: 'groups' }),
	queryFn: async () => {
		const res = await api.api.dashboard.groups.$get()
		if (!res.ok) throw new Error('Failed to fetch groups')
		return res.json() as Promise<{
			groups: Array<{ id: string; title: string; icon?: string; position: number }>
		}>
	},
})

export const dashboardWidgetsQuery = queryOptions({
	queryKey: queryKeys.dashboard.list({ type: 'widgets' }),
	queryFn: async () => {
		const res = await api.api.dashboard.widgets.$get()
		if (!res.ok) throw new Error('Failed to fetch widgets')
		return res.json()
	},
})
