import { useEffect, useState, useCallback, useRef } from "react"
import { API_BASE } from "@/lib/api"

interface TypingAgent {
  agentId: string
  sessionId: string
  startedAt: number
}

interface TypingUser {
  userId: string
  channelId: string
  lastSeenAt: number
}

const AGENT_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes
const AGENT_CLEANUP_INTERVAL_MS = 30_000
const USER_EXPIRY_MS = 5_000
const USER_CLEANUP_INTERVAL_MS = 1_000

/**
 * Hook that listens to SSE events for agent_typing and user_typing.
 * Returns separate lists for agents and humans currently typing.
 *
 * Uses the existing /api/events SSE endpoint (shared connection via EventSource).
 */
export function useTypingIndicator(currentUserId?: string | null) {
  const [typingAgents, setTypingAgents] = useState<TypingAgent[]>([])
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([])
  const currentUserIdRef = useRef(currentUserId)
  currentUserIdRef.current = currentUserId

  useEffect(() => {
    let disposed = false
    let source: EventSource | null = null

    function handleMessage(event: MessageEvent) {
      try {
        const parsed = JSON.parse(event.data as string) as Record<string, unknown>

        if (parsed.type === "agent_typing") {
          const agentId = parsed.agentId as string | undefined
          const status = parsed.status as string | undefined
          const sessionId = parsed.sessionId as string | undefined

          if (status === "started" && agentId && sessionId) {
            setTypingAgents((prev) => {
              if (prev.some((a) => a.agentId === agentId)) return prev
              return [...prev, { agentId, sessionId, startedAt: Date.now() }]
            })
          } else if (status === "stopped" && agentId) {
            setTypingAgents((prev) => prev.filter((a) => a.agentId !== agentId))
          }
        }

        if (parsed.type === "user_typing") {
          const userId = parsed.userId as string | undefined
          const channelId = parsed.channelId as string | undefined

          // Skip our own typing events
          if (!userId || !channelId || userId === currentUserIdRef.current) return

          setTypingUsers((prev) => {
            const existing = prev.find((u) => u.userId === userId && u.channelId === channelId)
            if (existing) {
              return prev.map((u) =>
                u.userId === userId && u.channelId === channelId
                  ? { ...u, lastSeenAt: Date.now() }
                  : u,
              )
            }
            return [...prev, { userId, channelId, lastSeenAt: Date.now() }]
          })
        }
      } catch {
        // Ignore non-JSON (heartbeat)
      }
    }

    function connect() {
      if (disposed) return

      source = new EventSource(`${API_BASE}/api/events`, { withCredentials: true })
      source.onmessage = handleMessage
      source.onerror = () => {
        // EventSource auto-reconnects on error; no manual action needed.
        // Clear stale typing state since we may have missed "stopped" events.
        setTypingAgents([])
        setTypingUsers([])
      }
    }

    connect()

    return () => {
      disposed = true
      source?.close()
    }
  }, [])

  // Auto-expire agent typing state after 5 minutes (safety net)
  useEffect(() => {
    const interval = setInterval(() => {
      const cutoff = Date.now() - AGENT_EXPIRY_MS
      setTypingAgents((prev) => {
        const filtered = prev.filter((a) => a.startedAt > cutoff)
        return filtered.length === prev.length ? prev : filtered
      })
    }, AGENT_CLEANUP_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  // Auto-expire human typing state after 5 seconds of no events
  useEffect(() => {
    const interval = setInterval(() => {
      const cutoff = Date.now() - USER_EXPIRY_MS
      setTypingUsers((prev) => {
        const filtered = prev.filter((u) => u.lastSeenAt > cutoff)
        return filtered.length === prev.length ? prev : filtered
      })
    }, USER_CLEANUP_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  const getSessionForAgent = useCallback(
    (agentId: string) => typingAgents.find((a) => a.agentId === agentId)?.sessionId ?? null,
    [typingAgents],
  )

  const getTypingUsersForChannel = useCallback(
    (channelId: string) => typingUsers.filter((u) => u.channelId === channelId),
    [typingUsers],
  )

  return { typingAgents, typingUsers, getSessionForAgent, getTypingUsersForChannel }
}
