import { useEffect, useReducer, useRef } from 'react'

interface RunStreamEvent {
  type: string
  eventType?: string
  summary?: string
  status?: string
  created_at?: string
}

interface RunStreamState {
  events: RunStreamEvent[]
  latestSummary: string | null
  isComplete: boolean
}

type Action =
  | { type: 'event'; event: RunStreamEvent }
  | { type: 'reset' }

function reducer(state: RunStreamState, action: Action): RunStreamState {
  if (action.type === 'reset') return { events: [], latestSummary: null, isComplete: false }

  const event = action.event
  const events = [...state.events, event]

  if (event.type === 'run_completed') {
    return { events, latestSummary: event.summary ?? state.latestSummary, isComplete: true }
  }

  return {
    events,
    latestSummary: event.summary ?? state.latestSummary,
    isComplete: false,
  }
}

const INITIAL_STATE: RunStreamState = { events: [], latestSummary: null, isComplete: false }

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
        dispatch({ type: 'event', event })
      } catch {
        // ignore parse errors
      }
    }

    source.onerror = () => {
      // EventSource auto-reconnects
    }

    return () => {
      source.close()
      sourceRef.current = null
    }
  }, [runId])

  return state
}
