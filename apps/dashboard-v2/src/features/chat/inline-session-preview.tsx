import { useEffect, useRef, useReducer, useState } from "react"
import { cn } from "@/lib/utils"
import { API_BASE } from "@/lib/api"
import { CaretRightIcon, CheckCircleIcon, CircleNotchIcon, XIcon } from "@phosphor-icons/react"

interface StreamEvent {
  at: number
  type: string
  content?: string
  tool?: string
}

interface InlineSessionPreviewProps {
  sessionId: string
  /** Close the preview. */
  onClose: () => void
  compact?: boolean
}

/**
 * D18: Inline session preview — connects to the durable stream SSE
 * and shows live tool calls when "Watch live" is clicked.
 */
type StreamAction =
  | { type: "CONNECTED" }
  | { type: "DISCONNECTED" }
  | { type: "ADD_EVENT"; event: StreamEvent }

interface StreamState {
  events: StreamEvent[]
  connected: boolean
}

function streamReducer(state: StreamState, action: StreamAction): StreamState {
  switch (action.type) {
    case "CONNECTED":
      return { ...state, connected: true }
    case "DISCONNECTED":
      return { ...state, connected: false }
    case "ADD_EVENT":
      return { ...state, events: [...state.events.slice(-50), action.event] }
  }
}

export function InlineSessionPreview({ sessionId, onClose, compact = false }: InlineSessionPreviewProps) {
  const [{ events, connected }, dispatch] = useReducer(streamReducer, { events: [], connected: false })
  const sourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    const url = `${API_BASE}/api/agent-sessions/${encodeURIComponent(sessionId)}/stream?live=sse`
    const source = new EventSource(url, { withCredentials: true })
    sourceRef.current = source

    source.onopen = () => dispatch({ type: "CONNECTED" })
    source.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data as string) as StreamEvent
        // Only show tool calls and results for a concise view
        if (parsed.type === "tool_call" || parsed.type === "tool_result" || parsed.type === "error") {
          dispatch({ type: "ADD_EVENT", event: parsed })
        }
      } catch {
        // Ignore non-JSON
      }
    }
    source.onerror = () => dispatch({ type: "DISCONNECTED" })

    return () => {
      source.close()
      sourceRef.current = null
    }
  }, [sessionId])

  return (
    <div className={cn("mx-4 mb-2 rounded border border-border/60 bg-muted/20", compact && "mx-3")}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-muted-foreground">
            Live session
          </span>
          <span className="font-mono text-[10px] text-muted-foreground/50">{sessionId.slice(0, 20)}...</span>
          {connected && (
            <span className="flex items-center gap-1 text-[10px] text-success/70">
              <span className="inline-block size-1.5 animate-pulse rounded-full bg-success/60" />
              connected
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground/50 hover:text-foreground"
        >
          <XIcon size={14} />
        </button>
      </div>

      {/* Events */}
      <div className="max-h-48 overflow-y-auto px-3 py-1.5">
        {events.length === 0 && (
          <div className="flex items-center gap-1.5 py-2 text-[11px] text-muted-foreground">
            <CircleNotchIcon size={12} className="animate-spin text-primary/50" />
            Waiting for tool calls...
          </div>
        )}
        {events.map((evt) => (
          <SessionEventRow key={`${evt.at}-${evt.type}-${evt.tool ?? ''}`} event={evt} />
        ))}
      </div>
    </div>
  )
}

function SessionEventRow({ event }: { event: StreamEvent }) {
  const [expanded, setExpanded] = useState(false)

  if (event.type === "tool_call") {
    return (
      <div className="flex items-center gap-1.5 py-0.5 text-[11px] text-muted-foreground">
        <CircleNotchIcon size={11} className="shrink-0 animate-spin text-primary/50" />
        <span className="font-mono">{event.tool}</span>
      </div>
    )
  }

  if (event.type === "tool_result") {
    const preview = event.content && event.content.length > 60
      ? `${event.content.slice(0, 60)}...`
      : event.content

    return (
      <div className="py-0.5">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center gap-1.5 text-left text-[11px] text-muted-foreground hover:text-foreground"
        >
          <CheckCircleIcon size={11} className="shrink-0 text-success/70" />
          <span className="font-mono">{event.tool}</span>
          {event.content && (
            <CaretRightIcon
              size={9}
              className={cn("ml-auto shrink-0 transition-transform", expanded && "rotate-90")}
            />
          )}
        </button>
        {expanded && event.content && (
          <pre className="ml-4 mt-0.5 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-muted-foreground/70">
            {event.content}
          </pre>
        )}
        {!expanded && preview && (
          <div className="ml-4 truncate text-[10px] text-muted-foreground/40">{preview}</div>
        )}
      </div>
    )
  }

  if (event.type === "error") {
    return (
      <div className="py-0.5 text-[11px] text-destructive">
        Error: {event.content}
      </div>
    )
  }

  return null
}
