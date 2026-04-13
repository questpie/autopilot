import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { chatSessionKeys } from './use-chat-sessions'
import { queryKeys } from './use-queries'
import { taskKeys } from './use-tasks'
import type { AutopilotEvent } from '@/api/types'

/**
 * Subscribes to the SSE event stream at GET /api/events.
 * Invalidates relevant react-query caches when events arrive.
 */
export function useAutoEvents() {
  const queryClient = useQueryClient()
  const sourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    const source = new EventSource('/api/events', { withCredentials: true })
    sourceRef.current = source

    source.onmessage = (ev) => {
      let event: AutopilotEvent
      try {
        event = JSON.parse(ev.data) as AutopilotEvent
      } catch {
        return
      }

      switch (event.type) {
        case 'task_changed':
        case 'task_created':
          void queryClient.invalidateQueries({ queryKey: taskKeys.all })
          break

        case 'run_started':
        case 'run_completed':
        case 'run_event':
          void queryClient.invalidateQueries({ queryKey: ['runs'] })
          void queryClient.invalidateQueries({ queryKey: taskKeys.all })
          void queryClient.invalidateQueries({ queryKey: queryKeys.all })
          break

        case 'task_relation_created':
          void queryClient.invalidateQueries({ queryKey: taskKeys.all })
          break

        case 'worker_registered':
        case 'worker_offline':
          void queryClient.invalidateQueries({ queryKey: ['workers'] })
          break

        case 'settings_changed':
          void queryClient.invalidateQueries({ queryKey: ['agents'] })
          void queryClient.invalidateQueries({ queryKey: ['workflows'] })
          break

        // heartbeat — ignore
        case 'heartbeat':
          break
      }

      // Always refresh chat sessions on any non-heartbeat event
      if (event.type !== 'heartbeat') {
        void queryClient.invalidateQueries({ queryKey: chatSessionKeys.all })
      }
    }

    source.onerror = () => {
      // Browser will auto-reconnect. Nothing to do.
    }

    return () => {
      source.close()
      sourceRef.current = null
    }
  }, [queryClient])
}
