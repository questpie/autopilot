/**
 * Chat Sessions API — wired to /api/chat-sessions.
 * Dashboard-specific session endpoints (provider_id = 'dashboard').
 */
import type { Session, SessionMessage } from './types'
import { apiFetch } from '@/lib/api-client'

export async function getChatSessions(): Promise<Session[]> {
  const data = await apiFetch<{ sessions: Session[] }>('/api/chat-sessions')
  return data.sessions
}

export async function getChatSessionMessages(id: string): Promise<SessionMessage[]> {
  return apiFetch<SessionMessage[]>(`/api/chat-sessions/${encodeURIComponent(id)}/messages`)
}

export async function createChatSession(
  agentId: string,
  message: string,
): Promise<{ session_id: string; query_id: string; run_id: string }> {
  return apiFetch('/api/chat-sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, message }),
  })
}

export async function sendChatMessage(
  sessionId: string,
  message: string,
): Promise<{ session_id: string; query_id: string; run_id: string; queued?: boolean }> {
  return apiFetch(`/api/chat-sessions/${encodeURIComponent(sessionId)}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
}
