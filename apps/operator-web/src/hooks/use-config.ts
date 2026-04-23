import { deleteConfigRecord, getConfigRecords, saveConfigRecord } from '@/api/config.api'
import type { ConfigEntityType } from '@/api/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const configKeys = {
	all: ['config'] as const,
	list: (type: ConfigEntityType, projectId?: string | null) =>
		['config', 'list', type, projectId ?? null] as const,
}

export function useConfigRecords(type: ConfigEntityType, projectId?: string | null) {
	return useQuery({
		queryKey: configKeys.list(type, projectId),
		queryFn: () => getConfigRecords(type, projectId),
	})
}

export function useSaveConfigRecord() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({
			type,
			id,
			data,
			projectId,
		}: {
			type: ConfigEntityType
			id: string
			data: unknown
			projectId?: string | null
		}) => saveConfigRecord(type, id, data, projectId),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: configKeys.all })
			await queryClient.invalidateQueries()
		},
	})
}

export function useDeleteConfigRecord() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({
			type,
			id,
			projectId,
		}: {
			type: ConfigEntityType
			id: string
			projectId?: string | null
		}) => deleteConfigRecord(type, id, projectId),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: configKeys.all })
			await queryClient.invalidateQueries()
		},
	})
}
