import { useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { SSEClient } from "@/lib/sse-client"
import type { SSEStatus } from "@/lib/sse-client"
import { queryKeys } from "@/lib/query-keys"
import { useAppStore } from "@/stores/app.store"
import { API_BASE } from "@/lib/api"

const EVENT_INVALIDATION_MAP: Record<string, readonly (readonly string[])[]> = {
  task_changed: [queryKeys.tasks.root, queryKeys.dashboard.root, queryKeys.inbox.root],
  message: [queryKeys.channels.root],
  activity: [queryKeys.activity.root, queryKeys.dashboard.root],
  pin_changed: [queryKeys.pins.root, queryKeys.dashboard.root, queryKeys.inbox.root],
  agent_session: [queryKeys.sessions.root, queryKeys.agents.root, queryKeys.status.root, queryKeys.dashboard.root],
  file_changed: [queryKeys.files.root, queryKeys.dashboard.root],
  workflow_advanced: [queryKeys.tasks.root, queryKeys.dashboard.root],
  channel_created: [queryKeys.channels.root],
  channel_deleted: [queryKeys.channels.root],
  channel_member_changed: [queryKeys.channels.root],
} as const

interface SSEEvent {
  type: string
  data?: unknown
}

export function useSSE(): void {
  const queryClient = useQueryClient()
  const setSSEStatus = useAppStore((s) => s.setSSEStatus)
  const clientRef = useRef<SSEClient | null>(null)

  useEffect(() => {
    const client = new SSEClient({
      url: `${API_BASE}/api/events`,
      onStatusChange: (status: SSEStatus, retryCount: number) => {
        setSSEStatus(status, retryCount)
      },
      onMessage: (event: MessageEvent) => {
        try {
          const parsed = JSON.parse(event.data as string) as SSEEvent
          const keysToInvalidate = EVENT_INVALIDATION_MAP[parsed.type]
          if (keysToInvalidate) {
            for (const key of keysToInvalidate) {
              void queryClient.invalidateQueries({ queryKey: [...key] })
            }
          }
        } catch {
          // Heartbeat or non-JSON messages ignored
        }
      },
    })

    clientRef.current = client
    client.connect()

    return () => {
      client.disconnect()
      clientRef.current = null
    }
  }, [queryClient, setSSEStatus])
}
