/**
 * QueryEventsSection — renders persisted run events for a completed query.
 *
 * Renders inline, same visual as the live RunEventFeed.
 * Groups consecutive tool_use events (2+) into a collapsible section.
 */

import { useState } from 'react'
import { CaretRight, CaretDown, Wrench } from '@phosphor-icons/react'
import { useRunEvents } from '@/hooks/use-runs'
import { ToolCallCard, ThinkingBlock, ArtifactEventCard } from './run-event-feed'
import type { RunEvent } from '@/api/types'

function parseEventMeta(event: RunEvent): Record<string, unknown> {
  try {
    return JSON.parse(event.metadata || '{}') as Record<string, unknown>
  } catch {
    return {}
  }
}

interface EventGroup {
  type: string
  events: RunEvent[]
}

/** Collapse consecutive same-type events into groups.
 *  For thinking: only the last event in a streak survives (has full accumulated text).
 *  For tool_use: all events in a streak are kept (each is a distinct tool call). */
function groupEvents(events: RunEvent[]): EventGroup[] {
  const groups: EventGroup[] = []
  for (const event of events) {
    const last = groups[groups.length - 1]
    if (last && event.type === last.type) {
      if (event.type === 'thinking') {
        // Replace — last event has the most complete text
        last.events = [event]
      } else {
        last.events.push(event)
      }
    } else {
      groups.push({ type: event.type, events: [event] })
    }
  }
  return groups
}

function ToolCallGroup({ events }: { events: RunEvent[] }) {
  const [open, setOpen] = useState(false)
  const CaretIcon = open ? CaretDown : CaretRight

  return (
    <div>
		<button
			type="button"
			onClick={() => setOpen((v) => !v)}
			className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left transition-colors hover:bg-muted/40"
		>
        <CaretIcon className="size-3 shrink-0 text-muted-foreground" />
        <Wrench size={12} className="text-muted-foreground shrink-0" />
				<span className="text-sm text-muted-foreground">
					{events.length} tool call{events.length === 1 ? '' : 's'}
				</span>
      </button>
      {open && (
        <div className="flex flex-col gap-0.5 mt-0.5">
          {events.map((event) => (
            <ToolCallCard
              key={event.id}
              summary={event.summary ?? 'tool call'}
              status="done"
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function QueryEventsSection({ runId }: { runId: string }) {
  const { data: events } = useRunEvents(runId)

  if (!events || events.length === 0) return null

  // Only keep tool calls, thinking, and artifacts — everything else is noise in history
  const meaningful = events
    .filter((e) => e.type === 'tool_use' || e.type === 'thinking' || e.type === 'artifact')
    .sort((a, b) => a.created_at.localeCompare(b.created_at))

  if (meaningful.length === 0) return null

  const groups = groupEvents(meaningful)

  return (
    <div className="flex w-full justify-start">
      <div className="flex flex-col gap-0.5 w-full max-w-[85%] px-1">
        {groups.map((group, idx) => {
          if (group.type === 'tool_use' && group.events.length > 1) {
            return <ToolCallGroup key={idx} events={group.events} />
          }
          if (group.type === 'artifact' && group.events.length > 1) {
            return group.events.map((ev) => {
              const meta = parseEventMeta(ev)
              return (
                <ArtifactEventCard
                  key={ev.id}
                  title={ev.summary ?? 'artifact'}
                  previewUrl={typeof meta.preview_url === 'string' ? meta.preview_url : null}
                  kind={typeof meta.kind === 'string' ? meta.kind : undefined}
                />
              )
            })
          }
          const event = group.events[0]
          if (event.type === 'tool_use') {
            return (
              <ToolCallCard
                key={event.id}
                summary={event.summary ?? 'tool call'}
                status="done"
              />
            )
          }
          if (event.type === 'artifact') {
            const meta = parseEventMeta(event)
            return (
              <ArtifactEventCard
                key={event.id}
                title={event.summary ?? 'artifact'}
                previewUrl={typeof meta.preview_url === 'string' ? meta.preview_url : null}
                kind={typeof meta.kind === 'string' ? meta.kind : undefined}
              />
            )
          }
          return (
            <ThinkingBlock
              key={event.id}
              isActive={false}
            />
          )
        })}
      </div>
    </div>
  )
}
