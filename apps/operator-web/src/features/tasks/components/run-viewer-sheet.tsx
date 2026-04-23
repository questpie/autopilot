import { useRunStream } from '@/hooks/use-run-stream'
import { useRunDetail, useRunEvents } from '@/hooks/use-runs'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { StatusPill } from '@/components/ui/status-pill'
import { Spinner } from '@/components/ui/spinner'
import { setDraggedChatAttachment } from '@/features/chat/lib/chat-dnd'
import { taskStatusToPill } from '@/lib/status-colors'

// ── helpers ──────────────────────────────────────────────────────────────────

function formatTs(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatDuration(startedAt: string | null, endedAt: string | null): string | null {
  if (!startedAt) return null
  const end = endedAt ? new Date(endedAt) : new Date()
  const ms = end.getTime() - new Date(startedAt).getTime()
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const mins = Math.floor(ms / 60_000)
  const secs = Math.floor((ms % 60_000) / 1000)
  return `${mins}m ${secs}s`
}

const LIVE_STATUSES = new Set(['pending', 'claimed', 'running'])

// ── event type label mapping ──────────────────────────────────────────────────

function eventTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    started: 'started',
    progress: 'progress',
    tool_use: 'tool call',
    artifact: 'artifact',
    message_sent: 'message',
    task_updated: 'task updated',
    approval_needed: 'approval needed',
    error: 'error',
    completed: 'completed',
    external_action: 'external action',
    steer: 'steer',
  }
  return labels[type] ?? type
}

// ── event type accent color ───────────────────────────────────────────────────

function eventDotClass(type: string): string {
  if (type === 'error') return 'bg-destructive'
  if (type === 'completed') return 'bg-success'
  if (type === 'started') return 'bg-info'
  if (type === 'tool_use') return 'bg-warning'
  if (type === 'artifact') return 'bg-primary'
  return 'bg-border'
}

// ── timeline item ─────────────────────────────────────────────────────────────

interface TimelineEventItem {
  key: string | number
  type: string
  summary: string | null
  created_at?: string
}

function TimelineItem({ event, isLast }: { event: TimelineEventItem; isLast: boolean }) {
	return (
		<div className="flex gap-3 py-2">
			<div className="flex flex-col items-center">
				<div className={`size-2 shrink-0 rounded-full ${eventDotClass(event.type)}`} />
				{!isLast && <div className="w-px flex-1 bg-border" />}
			</div>
			<div className="flex-1 min-w-0 pb-1">
				<div className="flex items-center gap-2">
					<p className="text-xs font-medium text-muted-foreground">{eventTypeLabel(event.type)}</p>
					{event.created_at && (
						<p className="ml-auto shrink-0 text-xs text-muted-foreground/60 tabular-nums">
							{formatTs(event.created_at)}
						</p>
					)}
				</div>
				{event.summary && (
					<p className="mt-0.5 break-words text-sm text-foreground">{event.summary}</p>
				)}
			</div>
    </div>
  )
}

// ── live timeline (SSE) ───────────────────────────────────────────────────────

function LiveTimeline({ runId }: { runId: string }) {
  const stream = useRunStream(runId)

  if (stream.events.length === 0) {
		return (
			<div className="flex items-center gap-2 py-4 text-muted-foreground">
				<Spinner size="sm" />
				<span className="text-sm">Waiting for events…</span>
			</div>
		)
  }

  return (
    <div>
      {stream.events.map((ev, i) => (
        <TimelineItem
          key={i}
          event={{
            key: i,
            type: ev.eventType ?? ev.type,
            summary: ev.summary ?? null,
            created_at: ev.created_at,
          }}
          isLast={i === stream.events.length - 1 && stream.isComplete}
        />
      ))}
		{!stream.isComplete && (
			<div className="flex items-center gap-2 py-2 text-muted-foreground">
				<Spinner size="sm" />
				<span className="text-sm">Running…</span>
			</div>
		)}
    </div>
  )
}

// ── persisted timeline ────────────────────────────────────────────────────────

function PersistedTimeline({ runId }: { runId: string }) {
  const eventsQuery = useRunEvents(runId)

  if (eventsQuery.isLoading) {
		return (
			<div className="flex items-center gap-2 py-4 text-muted-foreground">
				<Spinner size="sm" />
				<span className="text-sm">Loading events…</span>
			</div>
		)
	}

  if (eventsQuery.isError) {
		return <p className="py-4 text-sm text-destructive">Failed to load events.</p>
  }

  const events = eventsQuery.data ?? []

  if (events.length === 0) {
		return <p className="py-4 text-sm text-muted-foreground">No events recorded.</p>
  }

  return (
    <div>
      {events.map((ev, i) => (
        <TimelineItem
          key={ev.id}
          event={{
            key: ev.id,
            type: ev.type,
            summary: ev.summary,
            created_at: ev.created_at,
          }}
          isLast={i === events.length - 1}
        />
      ))}
    </div>
  )
}

// ── main sheet ────────────────────────────────────────────────────────────────

interface RunViewerSheetProps {
  runId: string | null
  onClose: () => void
}

export function RunViewerSheet({ runId, onClose }: RunViewerSheetProps) {
  const runQuery = useRunDetail(runId)
  const run = runQuery.data ?? null
  const isLive = run ? LIVE_STATUSES.has(run.status) : false

  return (
    <Sheet open={!!runId} onOpenChange={(open) => { if (!open) onClose() }}>
		<SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
			{/* Header */}
			<SheetHeader
				className="gap-1 border-b border-border/60 bg-muted/20 px-4 py-3"
				draggable={!!run}
				onDragStart={run ? (e) => {
					setDraggedChatAttachment(e.dataTransfer, {
						type: 'ref',
						source: 'drag',
						label: `Run ${run.id.slice(0, 8)}`,
						refType: 'run',
						refId: run.id,
						metadata: { runId: run.id, taskId: run.task_id, agentId: run.agent_id },
					})
				} : undefined}
			>
				<div className="flex items-center gap-2 pr-8">
					<SheetTitle className="text-sm font-medium text-muted-foreground tabular-nums">
						{runId ? `${runId.slice(0, 16)}…` : '—'}
					</SheetTitle>
            {run && (
              <StatusPill
                status={taskStatusToPill(run.status)}
                pulse={isLive}
              />
            )}
          </div>

				{run && (
					<div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
						{run.agent_id && (
							<span className="text-xs text-muted-foreground">
								<span className="mr-1 text-muted-foreground/60">agent</span>
								{run.agent_id}
							</span>
						)}
						{run.model && (
							<span className="text-xs text-muted-foreground">
								<span className="mr-1 text-muted-foreground/60">model</span>
								{run.model}
							</span>
						)}
						{run.started_at && (
							<span className="text-xs text-muted-foreground tabular-nums">
								<span className="mr-1 text-muted-foreground/60">duration</span>
								{formatDuration(run.started_at, run.ended_at) ?? '—'}
							</span>
						)}
            </div>
          )}
        </SheetHeader>

        {/* Timeline body */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {!runId && null}

			{runId && runQuery.isLoading && (
				<div className="flex items-center gap-2 py-4 text-muted-foreground">
					<Spinner size="sm" />
					<span className="text-sm">Loading run…</span>
				</div>
			)}

			{runId && !runQuery.isLoading && !run && (
				<p className="py-4 text-sm text-muted-foreground">Run not found.</p>
			)}

			{runId && run && (
				<>
					<p className="mb-3 text-sm font-medium text-muted-foreground">
						Event Timeline
					</p>
              {isLive ? (
                <LiveTimeline runId={runId} />
              ) : (
                <PersistedTimeline runId={runId} />
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
