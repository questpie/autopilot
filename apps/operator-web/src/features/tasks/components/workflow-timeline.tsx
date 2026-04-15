import { useState } from 'react'
import { CaretRight } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { Markdown } from '@/components/ui/markdown'
import type { TimelineEntry } from '../lib/build-timeline'
import { formatDuration } from '../lib/build-timeline'

interface WorkflowTimelineProps {
  entries: TimelineEntry[]
  className?: string
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

export function WorkflowTimeline({ entries, className }: WorkflowTimelineProps) {
  const [expanded, setExpanded] = useState(() => defaultExpanded(entries))

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
                <p className="font-mono text-[11px] text-foreground-subtle italic">
                  {entry.label} — &quot;{entry.annotation}&quot;
                </p>
              </div>
            </div>
          )
        }

        const duration = entry.run ? formatDuration(entry.run.started_at, entry.run.ended_at) : ''
        const hasDetails = !!(entry.run?.summary || entry.run?.error || entry.run)
        const isOpen = expanded.has(i)

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
                  <span className="bg-warning-surface px-1 py-0.5 font-mono text-[10px] text-warning">
                    approval
                  </span>
                )}
                {duration && (
                  <span className="font-mono text-[11px] text-foreground-subtle">{duration}</span>
                )}
                {entry.run && !isOpen && (
                  <span className="ml-auto truncate max-w-[200px] font-mono text-[11px] text-foreground-subtle">
                    {entry.run.agent_id}
                  </span>
                )}
              </button>

              {/* Collapsible details */}
              {hasDetails && isOpen && (
                <div className="mt-1.5 ml-4 space-y-1.5">
                  {/* Agent + run ID */}
                  {entry.run && (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-foreground-subtle">
                        {entry.run.agent_id}
                      </span>
                      <span className="font-mono text-[10px] text-foreground-subtle">
                        {entry.run.id.slice(0, 12)}&hellip;
                      </span>
                      {entry.run.model && (
                        <span className="font-mono text-[10px] text-foreground-subtle">
                          {entry.run.model}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Summary */}
                  {entry.run?.summary && (
                    <div className="bg-muted/40 px-3 py-2">
                      <Markdown content={entry.run.summary} className="text-[12px]" />
                    </div>
                  )}

                  {/* Error */}
                  {entry.run?.error && (
                    <div className="bg-destructive-surface px-3 py-2">
                      <Markdown content={entry.run.error} className="text-[12px] text-destructive" />
                    </div>
                  )}

                  {/* Human approval hint */}
                  {entry.isHumanApproval && entry.status === 'pending' && (
                    <p className="font-mono text-[11px] text-foreground-subtle italic">
                      Waiting for human approval
                    </p>
                  )}
                </div>
              )}

              {/* Non-collapsible hints for pending steps */}
              {!hasDetails && entry.isHumanApproval && entry.status === 'pending' && (
                <p className="mt-1 font-mono text-[11px] text-foreground-subtle italic">
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
