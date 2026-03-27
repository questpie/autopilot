import { useState, useEffect, useRef, useCallback } from "react"
import {
  CircleIcon,
  ArrowDownIcon,
  SpinnerIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { API_BASE } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import {
  SessionEventItem,
  type SessionEvent,
  type ViewMode,
} from "./session-event-item"
import { SessionActions } from "./session-actions"

interface SessionViewProps {
  agentId: string
  agentName: string
  /** Pre-loaded events for replay mode. When set, SSE is not used. */
  events?: SessionEvent[]
  /** Whether this is a live (SSE) session or replay. */
  live?: boolean
}

export function SessionView({ agentId, agentName, events: preloadedEvents, live = true }: SessionViewProps) {
  const { t } = useTranslation()
  const [events, setEvents] = useState<SessionEvent[]>(preloadedEvents ?? [])
  const [mode, setMode] = useState<ViewMode>("full")
  const [autoScroll, setAutoScroll] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const isLive = live && !preloadedEvents

  // SSE connection for live mode
  useEffect(() => {
    if (!isLive) return

    const es = new EventSource(`${API_BASE}/api/events`, { withCredentials: true })
    let eventCounter = 0

    es.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data as string) as Record<string, unknown>

        // Filter for this agent's events
        if (data.type === "agent_session" && data.agentId === agentId) {
          // Session start/end meta events — skip content rendering
          return
        }

        if (data.type === "activity" && data.agent === agentId) {
          eventCounter++
          const sessionEvent: SessionEvent = {
            id: `sse-${eventCounter}`,
            type: mapActivityToEventType(data.toolName as string | undefined),
            timestamp: (data.at as string) ?? new Date().toISOString(),
            content: (data.summary as string) ?? "",
            toolName: data.toolName as string | undefined,
            filePath: (data.details as Record<string, string> | undefined)?.path,
            diff: (data.details as Record<string, string> | undefined)?.diff,
            lineCount: (data.details as Record<string, number> | undefined)?.lineCount,
            agentId,
          }
          setEvents((prev) => [...prev, sessionEvent])
        }
      } catch {
        // Ignore non-JSON heartbeat messages
      }
    }

    return () => {
      es.close()
    }
  }, [agentId, isLive])

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [events, autoScroll])

  // Detect user scroll to toggle auto-scroll
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const atBottom = scrollHeight - scrollTop - clientHeight < 40
    setAutoScroll(atBottom)
  }, [])

  return (
    <div className="flex flex-1 flex-col">
      {/* Mode toggle header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-2">
          {isLive && (
            <div className="flex items-center gap-1.5">
              <CircleIcon size={8} weight="fill" className="animate-pulse text-green-500 motion-reduce:animate-none" />
              <span className="font-heading text-[10px] font-medium text-green-500">
                {t("team.session_live")}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {(["full", "compact", "tools"] as ViewMode[]).map((m) => (
            <Button
              key={m}
              variant={mode === m ? "default" : "ghost"}
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={() => setMode(m)}
            >
              {t(`team.session_${m}` as `team.session_full`)}
            </Button>
          ))}
        </div>
      </div>

      {/* Event stream */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex flex-1 flex-col overflow-y-auto"
      >
        {events.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16">
            {isLive ? (
              <>
                <SpinnerIcon size={20} className="animate-spin text-muted-foreground" />
                <p className="font-heading text-xs text-muted-foreground">
                  {t("team.session_waiting")}
                </p>
              </>
            ) : (
              <>
                <p className="font-heading text-sm text-muted-foreground">
                  {t("team.session_no_events")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("team.session_no_events_description")}
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col">
            {events.map((event) => (
              <SessionEventItem key={event.id} event={event} mode={mode} />
            ))}
          </div>
        )}
      </div>

      {/* Auto-scroll toggle */}
      {!autoScroll && events.length > 0 && (
        <div className="absolute bottom-20 right-6">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => {
              setAutoScroll(true)
              if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight
              }
            }}
            title={t("team.session_auto_scroll")}
          >
            <ArrowDownIcon size={14} />
          </Button>
        </div>
      )}

      {/* Actions bar (only in live mode) */}
      {isLive && (
        <SessionActions agentId={agentId} agentName={agentName} />
      )}
    </div>
  )
}

/** Map activity tool names to session event types. */
function mapActivityToEventType(toolName?: string): SessionEvent["type"] {
  if (!toolName) return "text"
  const name = toolName.toLowerCase()
  if (name === "thinking" || name === "plan") return "thinking"
  if (name.includes("error")) return "error"
  if (name.includes("result")) return "tool_result"
  return "tool_call"
}
