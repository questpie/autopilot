import { useMemo } from 'react'
import { Wrench, CheckCircle, XCircle, ArrowsClockwise, Brain, Globe, FileText, File, Robot } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { Markdown } from '@/components/ui/markdown'

// ── Types ─────────────────────────────────────────────────────────────────

interface RunStreamEvent {
  type: string
  eventType?: string
  summary?: string
  status?: string
  created_at?: string
  metadata?: Record<string, unknown>
}

interface RunEventFeedProps {
  events: RunStreamEvent[]
  isStreaming: boolean
}

// ── ToolCallCard ──────────────────────────────────────────────────────────

export interface ToolCallCardProps {
  summary: string
  status: 'running' | 'done' | 'error'
}

const STATUS_ICONS = {
  running: <ArrowsClockwise size={10} className="text-muted-foreground animate-spin" />,
  error: <XCircle size={10} className="text-destructive" />,
  done: <CheckCircle size={10} className="text-muted-foreground/60" />,
} as const

export function ToolCallCard({ summary, status }: ToolCallCardProps) {
  return (
    <div className="flex items-center gap-2 py-0.5 font-mono text-xs text-muted-foreground">
      <Wrench size={10} className="shrink-0" />
      <span className="truncate flex-1">{summary}</span>
      {STATUS_ICONS[status]}
    </div>
  )
}

// ── ThinkingBlock ─────────────────────────────────────────────────────────

export interface ThinkingBlockProps {
  isActive: boolean
}

export function ThinkingBlock({ isActive }: ThinkingBlockProps) {
  const Icon = isActive ? ArrowsClockwise : Brain

  return (
    <div className="flex items-center gap-2 py-0.5 font-mono text-xs text-muted-foreground italic">
      <Icon size={10} className={isActive ? 'animate-spin shrink-0' : 'shrink-0'} />
      <span className="truncate">{isActive ? 'Thinking…' : 'Thought'}</span>
    </div>
  )
}

// ── ArtifactEventCard ─────────────────────────────────────────────────────

export interface ArtifactEventCardProps {
  title: string
  previewUrl?: string | null
  kind?: string
}

export function ArtifactEventCard({ title, previewUrl, kind }: ArtifactEventCardProps) {
  let Icon = File
  if (previewUrl) Icon = Globe
  else if (kind === 'doc') Icon = FileText

  return (
    <div className="flex items-center gap-2 py-0.5 font-mono text-xs text-muted-foreground">
      <Icon size={10} className="shrink-0" />
      <span className="truncate flex-1">{title}</span>
      {previewUrl && (
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground shrink-0"
        >
          open
        </a>
      )}
    </div>
  )
}

// ── RunEventFeed ──────────────────────────────────────────────────────────

function findLastIndex(events: RunStreamEvent[], match: (et: string) => boolean): number {
  for (let i = events.length - 1; i >= 0; i--) {
    const et = events[i].eventType ?? events[i].type
    if (match(et)) return i
  }
  return -1
}

function deduplicateEvents(events: RunStreamEvent[]): RunStreamEvent[] {
  const result: RunStreamEvent[] = []
  for (let i = 0; i < events.length; i++) {
    const et = events[i].eventType ?? events[i].type
    const nextEt = i + 1 < events.length
      ? (events[i + 1].eventType ?? events[i + 1].type)
      : null
    if ((et === 'thinking' || et === 'reasoning' || et === 'progress') && et === nextEt) {
      continue
    }
    result.push(events[i])
  }
  return result
}

export function RunEventFeed({ events, isStreaming }: RunEventFeedProps) {
  const dedupedEvents = useMemo(() => deduplicateEvents(events), [events])

  const lastToolUseIdx = useMemo(() => findLastIndex(dedupedEvents, (et) => et === 'tool_use'), [dedupedEvents])
  const lastThinkingIdx = useMemo(() => findLastIndex(dedupedEvents, (et) => et === 'thinking' || et === 'reasoning'), [dedupedEvents])
  const lastProgressIdx = useMemo(() => findLastIndex(dedupedEvents, (et) => et === 'progress'), [dedupedEvents])
  const lastEventIdx = dedupedEvents.length - 1

  if (events.length === 0) return null

  return (
    <div className="flex w-full justify-start">
      <div className="max-w-[85%] px-4 py-3">
        <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
          Assistant
        </p>
        <div className="flex flex-col gap-0.5">
          {dedupedEvents.map((ev, idx) => {
            const et = ev.eventType ?? ev.type
            return (
              <EventRow
                key={idx}
                event={ev}
                eventType={et}
                isRunning={isStreaming && idx === lastToolUseIdx && idx === lastEventIdx}
                isActiveThinking={isStreaming && idx === lastThinkingIdx && idx === lastEventIdx}
                isActiveProgress={isStreaming && idx === lastProgressIdx && idx === lastEventIdx}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── EventRow ─────────────────────────────────────────────────────────────

interface EventRowProps {
  event: RunStreamEvent
  eventType: string
  isRunning: boolean
  isActiveThinking: boolean
  isActiveProgress: boolean
}

function EventRow({ event, eventType, isRunning, isActiveThinking, isActiveProgress }: EventRowProps) {
  if (eventType === 'tool_use') {
    const isAgent = (event.summary ?? '').startsWith('Agent:')
    if (isAgent) {
      const status = isRunning ? 'running' : 'done'
      return (
        <div className="flex items-center gap-2 py-0.5 font-mono text-xs text-muted-foreground pl-4">
          <Robot size={10} className="shrink-0" />
          <span className="truncate flex-1">{event.summary}</span>
          {STATUS_ICONS[status]}
        </div>
      )
    }
    return (
      <ToolCallCard
        summary={event.summary ?? 'tool call'}
        status={isRunning ? 'running' : 'done'}
      />
    )
  }

  if (eventType === 'thinking' || eventType === 'reasoning') {
    return (
      <ThinkingBlock
        isActive={isActiveThinking}
      />
    )
  }

  if (eventType === 'progress') {
    if (!event.summary) return null
    return (
      <div className="py-0.5">
        <Markdown content={event.summary} className="prose prose-sm font-sans text-sm" />
        {isActiveProgress && (
          <span className="inline-block w-[7px] h-[13px] bg-foreground ml-0.5 align-text-bottom animate-pulse" />
        )}
      </div>
    )
  }

  if (eventType === 'run_completed') {
    const isError = event.status === 'failed'
    return (
      <div className={cn('flex items-center gap-2 py-0.5 font-mono text-xs', isError ? 'text-destructive' : 'text-muted-foreground')}>
        {isError ? <XCircle size={10} /> : <CheckCircle size={10} />}
        <span>{isError ? 'Run failed' : 'Run completed'}</span>
        {event.summary && <span className="text-muted-foreground truncate">— {event.summary}</span>}
      </div>
    )
  }

  if (eventType === 'error') {
    return (
      <div className="flex items-center gap-2 py-0.5 font-mono text-xs text-destructive">
        <XCircle size={10} />
        <span className="truncate">{event.summary ?? 'error'}</span>
      </div>
    )
  }

  if (eventType === 'started' || eventType === 'message_sent') {
    return null
  }

  if (eventType === 'artifact') {
    const meta = event.metadata ?? {}
    const previewUrl = typeof meta.preview_url === 'string' ? meta.preview_url : null
    const kind = typeof meta.kind === 'string' ? meta.kind : undefined
    return (
      <ArtifactEventCard
        title={event.summary ?? 'artifact produced'}
        previewUrl={previewUrl}
        kind={kind}
      />
    )
  }

  if (!event.summary) return null

  return (
    <p className="font-mono text-xs text-muted-foreground py-0.5 truncate">
      {event.summary}
    </p>
  )
}
