import { useEffect, useRef, useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { SSEClient } from "@/lib/sse-client"
import type { SSEStatus } from "@/lib/sse-client"
import { queryKeys } from "@/lib/query-keys"
import { useAppStore } from "@/stores/app.store"
import { toast } from "sonner"
import { t } from "@/lib/i18n"
import { API_BASE } from "@/lib/api"

/**
 * Map backend SSE event types to TanStack Query invalidations.
 */
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

/**
 * Hook that maintains a persistent SSE connection and dispatches
 * TanStack Query invalidations based on backend events.
 * Shows toast when offline and actions are attempted.
 */
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
          // Non-JSON messages (e.g. heartbeat) are ignored
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

/**
 * Hook to get a retry function for the SSE client.
 * Used in the connection indicator to manually retry.
 */
export function useSSERetry() {
  const sseStatus = useAppStore((s) => s.sseStatus)

  const retry = useCallback(() => {
    // Dispatch a custom event that the SSE hook listens for
    // For simplicity, we'll reload the page on manual retry
    // since the SSEClient is managed in a ref
    window.location.reload()
  }, [])

  const showOfflineToast = useCallback(() => {
    if (sseStatus === "offline") {
      toast.error(t("sse.offline_action_blocked"))
    }
  }, [sseStatus])

  return { retry, showOfflineToast, isOffline: sseStatus === "offline" }
}
