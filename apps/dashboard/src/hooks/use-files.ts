import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPut, apiPost, apiDelete, apiUpload, queryKeys } from '@/lib/api'
import { toast } from '@/hooks/use-toast'

export function useSaveFile() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ path, content }: { path: string; content: string }) =>
			apiPut(`/api/files/${path}`, { content }),
		onSuccess: () => {
			toast('File saved', 'success')
		},
		onSettled: (_data, _err, variables) => {
			queryClient.invalidateQueries({ queryKey: queryKeys.file(variables.path) })
		},
	})
}

export function useCreateFile() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ path, content }: { path: string; content: string }) =>
			apiPost(`/api/files/${path}`, { content }),
		onSuccess: () => {
			toast('File created', 'success')
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ['directory'] })
		},
	})
}

export function useDeleteFile() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (path: string) => apiDelete(`/api/files/${path}`),
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ['directory'] })
		},
	})
}

export function useUploadFile() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ file, targetDir }: { file: File; targetDir?: string }) =>
			apiUpload('/api/upload', file, targetDir),
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ['directory'] })
		},
	})
}
