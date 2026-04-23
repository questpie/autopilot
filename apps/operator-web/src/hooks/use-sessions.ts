import { useQuery } from '@tanstack/react-query'
import { getSessions, getSessionMessages } from '@/api/sessions.api'

type SessionFilters = { provider_id?: string; status?: string; mode?: string; task_id?: string }

export const sessionKeys = {
	all: ['sessions'] as const,
	list: (filters?: SessionFilters) => ['sessions', 'list', filters] as const,
	messages: (sessionId: string) => ['sessions', 'messages', sessionId] as const,
}

export function useSessions(filters?: SessionFilters) {
	return useQuery({
		queryKey: sessionKeys.list(filters),
		queryFn: () => getSessions(filters),
	})
}

export function useSessionMessages(
	sessionId: string | null,
	options?: { refetchInterval?: number | false },
) {
	return useQuery({
		queryKey: sessionId ? sessionKeys.messages(sessionId) : ['sessions', 'messages', null],
		queryFn: () => {
			if (!sessionId) return []
			return getSessionMessages(sessionId)
		},
		enabled: !!sessionId,
		refetchInterval: options?.refetchInterval,
	})
}

export function useTaskThread(taskId: string | null, isActive = false) {
	const sessionsQuery = useSessions(
		taskId ? { task_id: taskId, provider_id: 'dashboard', mode: 'task_thread' } : undefined,
	)

	const session = sessionsQuery.data?.[0] ?? null

	const messagesQuery = useSessionMessages(session?.id ?? null, {
		refetchInterval: isActive ? 3000 : false,
	})

	return {
		session,
		messages: messagesQuery.data ?? [],
		isLoading: sessionsQuery.isLoading || messagesQuery.isLoading,
	}
}
