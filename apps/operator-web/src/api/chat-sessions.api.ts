import type { Session, SessionMessage } from './types'
import { api, ApiError, configFetch } from '@/lib/api'

export async function getChatSessions(): Promise<Session[]> {
  const res = await api.api['chat-sessions'].$get({ query: {} })
  if (!res.ok) throw new ApiError(res.status, res.statusText)
  const data = await res.json()
  return (data as { sessions: Session[] }).sessions
}

export async function getChatSessionMessages(id: string): Promise<SessionMessage[]> {
  return configFetch<SessionMessage[]>(`/api/chat-sessions/${encodeURIComponent(id)}/messages`)
}

export async function createChatSession(
  agentId: string,
  message: string,
): Promise<{ session_id: string; query_id: string; run_id: string }> {
  const res = await api.api['chat-sessions'].$post({ json: { agentId, message } })
  if (!res.ok) throw new ApiError(res.status, res.statusText)
  return res.json() as Promise<{ session_id: string; query_id: string; run_id: string }>
}

export async function sendChatMessage(
  sessionId: string,
  message: string,
): Promise<{ session_id: string; query_id: string; run_id: string; queued?: boolean }> {
  const res = await fetch(`/api/chat-sessions/${encodeURIComponent(sessionId)}/messages`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  if (!res.ok) throw new ApiError(res.status, res.statusText)
  return res.json() as Promise<{
    session_id: string
    query_id: string
    run_id: string
    queued?: boolean
  }>
}
