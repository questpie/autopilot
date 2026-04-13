import { useMemo } from 'react'
import { Wrench, CheckCircle, XCircle, ArrowsClockwise, ChatTeardrop, Lightning } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────

interface RunStreamEvent {
  type: string
  eventType?: string
  summary?: string
  status?: string
  created_at?: string
}

interface RunEventFeedProps {
  events: RunStreamEvent[]
}

// ── ToolCallCard ──────────────────────────────────────────────────────────

interface ToolCallCardProps {
  summary: string
  status: 'running' | 'done' | 'error'
}

function ToolCallCard({ summary, status }: ToolCallCardProps) {
  // The summary for tool_use events typically reads: "tool_name(args...)" or just a description.
  // We extract whatever is present.
  const statusLabel =
    status === 'running' ? 'running' : status === 'error' ? 'error' : 'done'

  const statusIcon =
    status === 'running' ? (
      <ArrowsClockwise size={10} className="text-muted-foreground animate-spin" />
    ) : status === 'error' ? (
      <XCircle size={10} className="text-destructive" />
    ) : (
      <CheckCircle size={10} className="text-muted-foreground" />
    )

  return (
    <details className="border border-border">
      <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer font-mono text-xs hover:bg-muted list-none">
        <Wrench size={12} className="text-muted-foreground shrink-0" />
        <span className="font-medium text-primary truncate flex-1">{summary}</span>
        <span className="flex items-center gap-1 text-muted-foreground ml-auto shrink-0">
          {statusIcon}
          <span>{statusLabel}</span>
        </span>
      </summary>
      <div className="border-t border-border px-3 py-2 font-mono text-[11px] text-muted-foreground">
        <pre className="whitespace-pre-wrap break-all">{summary}</pre>
      </div>
    </details>
  )
}

// ── StreamingMessage ──────────────────────────────────────────────────────

interface StreamingMessageProps {
  text: string
}

function StreamingMessage({ text }: StreamingMessageProps) {
  if (!text) return null
  return (
    <div className="flex w-full justify-start">
      <div className="max-w-[85%] bg-transparent px-4 py-3">
        <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
          Assistant
        </p>
        <p className="font-sans text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">
          {text}
          <span className="inline-block w-[7px] h-[13px] bg-foreground ml-0.5 align-text-bottom animate-pulse" />
        </p>
      </div>
    </div>
  )
}

// ── RunEventFeed ──────────────────────────────────────────────────────────

export function RunEventFeed({ events }: RunEventFeedProps) {
  // Accumulate text_delta / content_delta / message_sent text for streaming display.
  // In practice the backend emits 'message_sent' with the assembled message text as summary.
  const streamingText = useMemo(() => {
    const parts: string[] = []
    for (const ev of events) {
      const et = ev.eventType ?? ev.type
      if (et === 'text_delta' || et === 'content_delta') {
        parts.push(ev.summary ?? '')
      }
    }
    return parts.join('')
  }, [events])

  if (events.length === 0) return null

  return (
    <div className="flex w-full justify-start">
      <div className="flex flex-col gap-1 w-full max-w-[85%] px-1">
        {events.map((ev, idx) => {
          const et = ev.eventType ?? ev.type
          return <EventRow key={idx} event={ev} eventType={et} />
        })}

        {streamingText && <StreamingMessage text={streamingText} />}
      </div>
    </div>
  )
}

// ── EventRow ─────────────────────────────────────────────────────────────

interface EventRowProps {
  event: RunStreamEvent
  eventType: string
}

function EventRow({ event, eventType }: EventRowProps) {
  if (eventType === 'tool_use') {
    return (
      <ToolCallCard
        summary={event.summary ?? 'tool call'}
        status="done"
      />
    )
  }

  if (eventType === 'thinking' || eventType === 'reasoning') {
    return (
      <p className="font-mono text-xs italic text-muted-foreground px-1 py-0.5">
        {event.summary ?? 'thinking…'}
      </p>
    )
  }

  if (eventType === 'text_delta' || eventType === 'content_delta') {
    // Accumulated in streamingText above — skip individual rows.
    return null
  }

  if (eventType === 'run_completed') {
    const isError = event.status === 'failed'
    return (
      <div className={cn('flex items-center gap-2 px-1 py-1 font-mono text-xs', isError ? 'text-destructive' : 'text-muted-foreground')}>
        {isError ? <XCircle size={12} /> : <CheckCircle size={12} />}
        <span>{isError ? 'Run failed' : 'Run completed'}</span>
        {event.summary && <span className="text-muted-foreground truncate">— {event.summary}</span>}
      </div>
    )
  }

  if (eventType === 'error') {
    return (
      <div className="flex items-center gap-2 px-1 py-1 font-mono text-xs text-destructive">
        <XCircle size={12} />
        <span className="truncate">{event.summary ?? 'error'}</span>
      </div>
    )
  }

  if (eventType === 'started') {
    return (
      <div className="flex items-center gap-2 px-1 py-0.5 font-mono text-xs text-muted-foreground">
        <Lightning size={12} />
        <span>Run started</span>
      </div>
    )
  }

  if (eventType === 'message_sent') {
    // Final assembled message — skip; will appear as a real ChatMessage once conversation refreshes.
    return null
  }

  if (eventType === 'artifact') {
    return (
      <div className="flex items-center gap-2 px-1 py-0.5 font-mono text-xs text-muted-foreground">
        <ChatTeardrop size={12} />
        <span className="truncate">{event.summary ?? 'artifact produced'}</span>
      </div>
    )
  }

  // progress, task_updated, external_action, steer, approval_needed, and any unknown
  if (!event.summary) return null

  return (
    <p className="font-mono text-xs text-muted-foreground px-1 py-0.5 truncate">
      {event.summary}
    </p>
  )
}
