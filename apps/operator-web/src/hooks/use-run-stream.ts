import { useEffect, useReducer, useRef } from 'react'

interface RunStreamEvent {
  streamId?: string
  type: string
  eventType?: string
  summary?: string
  status?: string
  created_at?: string
  metadata?: Record<string, unknown>
}

interface RunStreamState {
  events: RunStreamEvent[]
  latestSummary: string | null
  isComplete: boolean
  seenStreamIds: Set<string>
}

type Action =
  | { type: 'event'; event: RunStreamEvent }
  | { type: 'reset' }

function reducer(state: RunStreamState, action: Action): RunStreamState {
  if (action.type === 'reset') return { events: [], latestSummary: null, isComplete: false, seenStreamIds: new Set() }

  const event = action.event
  if (event.streamId && state.seenStreamIds.has(event.streamId)) {
    return state
  }

  const events = [...state.events, event]
  const seenStreamIds = new Set(state.seenStreamIds)
  if (event.streamId) seenStreamIds.add(event.streamId)

  if (event.type === 'run_completed') {
    return { events, latestSummary: event.summary ?? state.latestSummary, isComplete: true, seenStreamIds }
  }

  return {
    events,
    latestSummary: event.summary ?? state.latestSummary,
    isComplete: false,
    seenStreamIds,
  }
}

const INITIAL_STATE: RunStreamState = {
  events: [],
  latestSummary: null,
  isComplete: false,
  seenStreamIds: new Set(),
}

export function useRunStream(runId: string | null): RunStreamState {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)
  const sourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!runId) {
      dispatch({ type: 'reset' })
      return
    }

    dispatch({ type: 'reset' })
    const source = new EventSource(`/api/runs/${runId}/stream`, { withCredentials: true })
    sourceRef.current = source

    source.onmessage = (ev) => {
      try {
        const event = JSON.parse(ev.data) as RunStreamEvent
        if (event.type === 'heartbeat') return
        dispatch({
          type: 'event',
          event: {
            ...event,
            streamId: event.streamId ?? ev.lastEventId ?? undefined,
          },
        })
      } catch {
        // ignore parse errors
      }
    }

    let retryCount = 0

    source.onerror = () => {
      if (source.readyState === EventSource.CLOSED) return
      retryCount++
      if (retryCount > 3) {
        source.close()
      }
    }

    source.onopen = () => {
      retryCount = 0
    }

    return () => {
      source.close()
      sourceRef.current = null
    }
  }, [runId])

  return state
}
