import { useEffect, useState, useCallback, useRef } from "react"
import { API_BASE } from "@/lib/api"

interface TypingAgent {
  agentId: string
  sessionId: string
  startedAt: number
}

/**
 * D17: Hook that listens to SSE events for agent_typing started/stopped.
 * Returns a list of agents currently typing and a session lookup.
 *
 * Uses the existing /api/events SSE endpoint (shared connection via EventSource).
 */
export function useTypingIndicator() {
  const [typingAgents, setTypingAgents] = useState<TypingAgent[]>([])
  const sourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    const source = new EventSource(`${API_BASE}/api/events`, { withCredentials: true })
    sourceRef.current = source

    source.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data as string) as {
          type: string
          agentId?: string
          status?: string
          sessionId?: string
        }

        if (parsed.type === "agent_typing") {
          if (parsed.status === "started" && parsed.agentId && parsed.sessionId) {
            setTypingAgents((prev) => {
              // Deduplicate
              if (prev.some((a) => a.agentId === parsed.agentId)) return prev
              return [...prev, { agentId: parsed.agentId!, sessionId: parsed.sessionId!, startedAt: Date.now() }]
            })
          } else if (parsed.status === "stopped" && parsed.agentId) {
            setTypingAgents((prev) => prev.filter((a) => a.agentId !== parsed.agentId))
          }
        }
      } catch {
        // Ignore non-JSON (heartbeat)
      }
    }

    return () => {
      source.close()
      sourceRef.current = null
    }
  }, [])

  // Auto-expire typing state after 5 minutes (safety net)
  useEffect(() => {
    const interval = setInterval(() => {
      const fiveMinAgo = Date.now() - 5 * 60 * 1000
      setTypingAgents((prev) => prev.filter((a) => a.startedAt > fiveMinAgo))
    }, 30_000)
    return () => clearInterval(interval)
  }, [])

  const getSessionForAgent = useCallback(
    (agentId: string) => typingAgents.find((a) => a.agentId === agentId)?.sessionId ?? null,
    [typingAgents],
  )

  return { typingAgents, getSessionForAgent }
}
