import { useState } from 'react'
import { CaretRight, ChatCircle } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Markdown } from '@/components/ui/markdown'
import { surfaceCardVariants } from '@/components/ui/surface-card'
import { useChatWorkspace } from '@/features/chat/chat-workspace-context'
import { setDraggedChatAttachment } from '@/features/chat/lib/chat-dnd'
import type { TimelineEntry } from '../lib/build-timeline'
import { formatDuration } from '../lib/build-timeline'

interface WorkflowTimelineProps {
  entries: TimelineEntry[]
  className?: string
  runSessionIds?: Record<string, string>
}

const STATUS_ICON: Record<string, { icon: string; color: string }> = {
  done: { icon: '✓', color: 'text-success' },
  running: { icon: '●', color: 'text-primary animate-pulse' },
  pending: { icon: '○', color: 'text-foreground-subtle' },
  failed: { icon: '✗', color: 'text-destructive' },
  empty: { icon: '⚠', color: 'text-warning' },
}

/** Running and failed steps start expanded; everything else starts collapsed. */
function defaultExpanded(entries: TimelineEntry[]): Set<number> {
  const set = new Set<number>()
  entries.forEach((e, i) => {
    if (e.status === 'running' || e.status === 'failed') set.add(i)
  })
  return set
}

export function WorkflowTimeline({ entries, className, runSessionIds = {} }: WorkflowTimelineProps) {
  const [expanded, setExpanded] = useState(() => defaultExpanded(entries))
  const { openSession } = useChatWorkspace()

  if (entries.length === 0) return null

  function toggle(index: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  return (
    <div className={cn('space-y-0', className)}>
      {entries.map((entry, i) => {
        const isLast = i === entries.length - 1
        const isAnnotation = entry.annotation !== undefined && !entry.run
        const { icon, color } = STATUS_ICON[entry.status] ?? STATUS_ICON['pending']!

        // Annotation rows (revision arrows)
        if (isAnnotation) {
          return (
            <div key={`${entry.stepId}-ann-${i}`} className="flex gap-3 pl-1">
              <div className="flex w-5 flex-col items-center">
                <div className={cn('w-px flex-1', !isLast && 'bg-border')} />
              </div>
              <div className="pb-2">
                <p className="text-xs text-foreground-subtle italic">
                  {entry.label} — &quot;{entry.annotation}&quot;
                </p>
              </div>
            </div>
          )
        }

        const duration = entry.run ? formatDuration(entry.run.started_at, entry.run.ended_at) : ''
        const hasDetails = !!(entry.run?.summary || entry.run?.error || entry.run)
        const isOpen = expanded.has(i)
        const sessionId = entry.run ? runSessionIds[entry.run.id] : undefined

        return (
          <div key={`${entry.stepId}-${i}`} className="flex gap-3 pl-1">
            {/* Icon + connecting line */}
            <div className="flex w-5 flex-col items-center">
              <div
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center font-mono text-[12px]',
                  color,
                )}
              >
                {icon}
              </div>
              {!isLast && <div className="w-px flex-1 bg-border" />}
            </div>

            {/* Content */}
            <div className={cn('flex-1 pb-3', isLast && 'pb-0')}>
              {/* Header row — clickable if has details */}
              <button
                type="button"
                onClick={hasDetails ? () => toggle(i) : undefined}
                draggable={!!entry.run}
                onDragStart={entry.run ? (e) => {
                  setDraggedChatAttachment(e.dataTransfer, {
                    type: 'ref',
                    source: 'drag',
                    label: `Run ${entry.run!.id.slice(0, 8)} ${entry.label}`,
                    refType: 'run',
                    refId: entry.run!.id,
                    metadata: { runId: entry.run!.id, taskId: entry.run!.task_id, stepId: entry.stepId },
                  })
                } : undefined}
                className={cn(
                  'flex w-full items-center gap-2 text-left',
                  hasDetails && 'cursor-pointer',
                  !hasDetails && 'cursor-default',
                )}
              >
                {hasDetails && (
                  <CaretRight
                    size={10}
                    weight="bold"
                    className={cn(
                      'shrink-0 text-foreground-subtle transition-transform duration-150',
                      isOpen && 'rotate-90',
                    )}
                  />
                )}
                <span
                  className={cn(
                    'text-[13px] font-medium',
                    entry.status === 'running' && 'text-primary',
                    entry.status === 'done' && 'text-foreground',
                    entry.status === 'failed' && 'text-destructive',
                    entry.status === 'pending' && 'text-foreground-subtle',
                    entry.status === 'empty' && 'text-foreground-muted',
                  )}
                >
                  {entry.label}
                </span>
                {entry.isHumanApproval && (
                  <span className="rounded-full bg-warning-surface px-2 py-0.5 text-[10px] font-medium text-warning">
                    approval
                  </span>
                )}
                {duration && (
                  <span className="text-xs text-foreground-subtle tabular-nums">{duration}</span>
                )}
                {entry.run && !isOpen && (
                  <span className="ml-auto max-w-[200px] truncate text-xs text-foreground-subtle">
                    {entry.run.agent_id}
                  </span>
                )}
              </button>

              {(sessionId || entry.run?.runtime_session_ref) && (
                <div className="mt-1 ml-4 flex flex-wrap gap-1.5">
						{sessionId ? (
							<Button
								onClick={() => openSession(sessionId)}
								size="xs"
								variant="secondary"
								draggable
								onDragStart={(e) => {
									setDraggedChatAttachment(e.dataTransfer, {
										type: 'ref',
										source: 'drag',
										label: `Session ${sessionId.slice(0, 8)}`,
										refType: 'session',
										refId: sessionId,
										metadata: { sessionId, runId: entry.run?.id },
									})
								}}
							>
								<ChatCircle data-icon="inline-start" />
								session:{sessionId.slice(0, 8)}
							</Button>
						) : (
							<Badge variant="outline">
								<ChatCircle data-icon="inline-start" />
								runtime:{entry.run?.runtime_session_ref?.slice(0, 8) ?? 'unknown'}
							</Badge>
						)}
                </div>
              )}

              {/* Collapsible details */}
              {hasDetails && isOpen && (
                <div className="mt-1.5 ml-4 space-y-1.5">
                  {/* Agent + run ID */}
                  {entry.run && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-foreground-subtle">
                        {entry.run.agent_id}
                      </span>
                      <span className="text-xs text-foreground-subtle tabular-nums">
                        {entry.run.id.slice(0, 12)}&hellip;
                      </span>
                      {entry.run.model && (
                        <span className="text-xs text-foreground-subtle">
                          {entry.run.model}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Summary */}
                  {entry.run?.summary && (
                    <div className={surfaceCardVariants({ size: 'sm' })}>
                      <Markdown content={entry.run.summary} className="text-[12px]" />
                    </div>
                  )}

                  {/* Error */}
                  {entry.run?.error && (
                    <div className="rounded-xl border border-destructive/15 bg-destructive-surface px-3 py-3 shadow-xs">
                      <Markdown content={entry.run.error} className="text-[12px] text-destructive" />
                    </div>
                  )}

                  {/* Human approval hint */}
                  {entry.isHumanApproval && entry.status === 'pending' && (
                      <p className="text-xs text-foreground-subtle italic">
                        Waiting for human approval
                      </p>
                  )}
                </div>
              )}

              {/* Non-collapsible hints for pending steps */}
              {!hasDetails && entry.isHumanApproval && entry.status === 'pending' && (
                <p className="mt-1 text-xs text-foreground-subtle italic">
                  Waiting for human approval
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
