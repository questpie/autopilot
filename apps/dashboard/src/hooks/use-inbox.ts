import { useQuery } from '@tanstack/react-query'
import { apiFetch, queryKeys } from '@/lib/api'
import type { InboxData } from '@/lib/types'

export function useInbox() {
	return useQuery({
		queryKey: queryKeys.inbox,
		queryFn: () => apiFetch<InboxData>('/api/inbox'),
	})
}
