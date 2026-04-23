import type { Session, SessionMessage } from './types'
import { api } from '@/lib/api'

export async function getSessions(filters?: { provider_id?: string; status?: string; mode?: string; task_id?: string }): Promise<Session[]> {
	const query: Record<string, string> = {}
	if (filters?.provider_id) query.provider_id = filters.provider_id
	if (filters?.status) query.status = filters.status
	if (filters?.mode) query.mode = filters.mode
	if (filters?.task_id) query.task_id = filters.task_id

	const res = await api.api.sessions.$get({ query })
	if (!res.ok) throw new Error(`Failed to fetch sessions: ${res.status}`)
	return res.json() as Promise<Session[]>
}

export async function getSessionMessages(sessionId: string, limit = 200): Promise<SessionMessage[]> {
	const res = await api.api.sessions[':id'].messages.$get({
		param: { id: sessionId },
		query: { limit: String(limit) },
	})
	if (!res.ok) throw new Error(`Failed to fetch session messages: ${res.status}`)
	return res.json() as Promise<SessionMessage[]>
}
