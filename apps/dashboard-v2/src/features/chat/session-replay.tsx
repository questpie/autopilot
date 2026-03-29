import { useState } from "react"
import { cn } from "@/lib/utils"
import { API_BASE } from "@/lib/api"
import {
  CaretRightIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  PlayIcon,
} from "@phosphor-icons/react"

interface StreamEvent {
  at: number
  type: string
  content?: string
  tool?: string
}

interface SessionReplayProps {
  sessionId: string
}

/**
 * D19: Session segment replay — fetches the session's durable stream
 * and shows tool call history inline within a message bubble.
 */
export function SessionReplay({ sessionId }: SessionReplayProps) {
  const [expanded, setExpanded] = useState(false)
  const [events, setEvents] = useState<StreamEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const toolCalls = events.filter((e) => e.type === "tool_call")
  const duration = events.length > 0
    ? Math.round((events[events.length - 1].at - events[0].at) / 1000)
    : 0

  const handleExpand = async () => {
    if (expanded) {
      setExpanded(false)
      return
    }
    setExpanded(true)

    if (loaded) return

    // Fetch the session stream (non-live replay)
    setLoading(true)
    try {
      const res = await fetch(
        `${API_BASE}/api/agent-sessions/${encodeURIComponent(sessionId)}/stream`,
        { credentials: "include" },
      )
      if (res.ok) {
        const text = await res.text()
        // Parse SSE format or JSON array depending on response
        const parsed: StreamEvent[] = []
        // Try JSON array first
        try {
          const arr = JSON.parse(text)
          if (Array.isArray(arr)) {
            for (const item of arr) {
              if (item.type === "tool_call" || item.type === "tool_result" || item.type === "error") {
                parsed.push(item as StreamEvent)
              }
            }
          }
        } catch {
          // SSE format — parse line by line
          for (const line of text.split("\n")) {
            if (line.startsWith("data: ")) {
              try {
                const evt = JSON.parse(line.slice(6)) as StreamEvent
                if (evt.type === "tool_call" || evt.type === "tool_result" || evt.type === "error") {
                  parsed.push(evt)
                }
              } catch {
                // skip
              }
            }
          }
        }
        setEvents(parsed)
      }
      setLoading(false)
      setLoaded(true)
    } catch {
      // Silently fail
      setLoading(false)
      setLoaded(true)
    }
  }

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={handleExpand}
        className="flex items-center gap-1.5 text-[11px] text-primary/70 hover:text-primary"
      >
        <PlayIcon size={12} />
        <span>
          {loaded
            ? `View session (${toolCalls.length} tool calls${duration > 0 ? `, ${duration}s` : ""})`
            : "View session"}
        </span>
        <CaretRightIcon
          size={10}
          className={cn("transition-transform", expanded && "rotate-90")}
        />
      </button>

      {expanded && (
        <div className="mt-1 rounded border border-border/50 bg-muted/20">
          {loading && (
            <div className="flex items-center gap-1.5 px-2 py-2 text-[11px] text-muted-foreground">
              <CircleNotchIcon size={12} className="animate-spin text-primary/50" />
              Loading session...
            </div>
          )}
          {!loading && events.length === 0 && loaded && (
            <div className="px-2 py-2 text-[11px] text-muted-foreground">
              No tool calls in this session.
            </div>
          )}
          {!loading && events.length > 0 && (
            <div className="max-h-64 overflow-y-auto px-2 py-1.5">
              {events.map((evt) => (
                <ReplayEventRow key={`${evt.at}-${evt.type}-${evt.tool ?? ''}`} event={evt} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ReplayEventRow({ event }: { event: StreamEvent }) {
  const [showContent, setShowContent] = useState(false)

  if (event.type === "tool_call") {
    return (
      <div className="flex items-center gap-1.5 py-0.5 text-[11px] text-muted-foreground">
        <CaretRightIcon size={10} className="shrink-0 text-primary/40" />
        <span className="font-mono">{event.tool}</span>
      </div>
    )
  }

  if (event.type === "tool_result") {
    return (
      <div className="py-0.5">
        <button
          type="button"
          onClick={() => setShowContent(!showContent)}
          className="flex w-full items-center gap-1.5 text-left text-[11px] text-muted-foreground hover:text-foreground"
        >
          <CheckCircleIcon size={11} className="shrink-0 text-green-500/70" />
          <span className="font-mono">{event.tool}</span>
          {event.content && (
            <CaretRightIcon
              size={9}
              className={cn("ml-auto shrink-0 transition-transform", showContent && "rotate-90")}
            />
          )}
        </button>
        {showContent && event.content && (
          <pre className="ml-4 mt-0.5 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-muted-foreground/70">
            {event.content}
          </pre>
        )}
      </div>
    )
  }

  if (event.type === "error") {
    return (
      <div className="py-0.5 text-[11px] text-destructive">Error: {event.content}</div>
    )
  }

  return null
}
