import { useMemo, useState } from 'react'
import { CaretRight, ChatCircle, Timer, Lightning } from '@phosphor-icons/react'
import { FilterTabs } from '@/components/ui/filter-tabs'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import { SmartText } from '@/lib/smart-links'
import type { Task } from '@/api/types'
import type { TaskFilter } from '../hooks/use-tasks-screen'

const FILTER_TABS = ['all', 'active', 'backlog', 'done', 'failed'] as const satisfies readonly TaskFilter[]

const FILTER_LABELS: Record<TaskFilter, string> = {
  all: 'All',
  active: 'Active',
  backlog: 'Backlog',
  done: 'Done',
  failed: 'Failed',
}

/** Display order for status groups — active first, terminal last. */
const STATUS_GROUP_ORDER: string[] = [
  'active',
  'blocked',
  'backlog',
  'done',
  'failed',
]

function statusGroupLabel(status: string): string {
  switch (status) {
    case 'active': return 'Active'
    case 'blocked': return 'Blocked'
    case 'backlog': return 'Backlog'
    case 'done': return 'Done'
    case 'failed': return 'Failed'
    default: return status
  }
}

interface TaskListProps {
  tasks: Task[]
  filter: TaskFilter
  onFilterChange: (filter: TaskFilter) => void
  onSelect: (id: string) => void
  isLoading: boolean
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}

function shortId(id: string): string {
  return id.slice(0, 8)
}

function StatusIcon({ status }: { status: string }) {
  const base = 'size-4 shrink-0'

  switch (status) {
    case 'active':
      return (
        <svg className={cn(base, 'text-info')} viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="12 20" />
        </svg>
      )
    case 'blocked':
      return (
        <svg className={cn(base, 'text-warning')} viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" />
          <path d="M5 8H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )
    case 'done':
      return (
        <svg className={cn(base, 'text-success')} viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" />
          <path d="M5.5 8L7 9.5L10.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'failed':
      return (
        <svg className={cn(base, 'text-destructive')} viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" />
          <path d="M6 6L10 10M10 6L6 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )
    default: // backlog
      return (
        <svg className={cn(base, 'text-muted-foreground')} viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
        </svg>
      )
  }
}

const TASK_TYPE_CONFIG: Record<string, { icon: typeof ChatCircle; label: string; className: string }> = {
  query: {
    icon: ChatCircle,
    label: 'query',
    className: 'bg-info-surface text-info',
  },
  scheduled: {
    icon: Timer,
    label: 'scheduled',
    className: 'bg-warning-surface text-warning',
  },
  task: {
    icon: Lightning,
    label: 'task',
    className: 'bg-primary-surface text-primary',
  },
}

function TaskTypeBadge({ type }: { type: string }) {
  const config = TASK_TYPE_CONFIG[type]
  if (!config) {
    return (
      <span className="inline-flex items-center gap-1 bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
        {type}
      </span>
    )
  }
  const Icon = config.icon
  return (
    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 font-mono text-[10px]', config.className)}>
      <Icon size={10} weight="bold" />
      {config.label}
    </span>
  )
}

/** Linear-style stacked-bar priority icons. 3 bars, filled count = urgency. */
function PriorityIcon({ priority }: { priority: string }) {
  const base = 'size-3.5 shrink-0'
  switch (priority) {
    case 'high':
      return (
        <svg className={cn(base, 'text-warning')} viewBox="0 0 16 16" fill="none" aria-label="High priority">
          <rect x="2" y="10" width="3" height="4" rx="0.5" fill="currentColor" />
          <rect x="6.5" y="6" width="3" height="8" rx="0.5" fill="currentColor" />
          <rect x="11" y="2" width="3" height="12" rx="0.5" fill="currentColor" />
        </svg>
      )
    case 'medium':
      return (
        <svg className={cn(base, 'text-muted-foreground')} viewBox="0 0 16 16" fill="none" aria-label="Medium priority">
          <rect x="2" y="10" width="3" height="4" rx="0.5" fill="currentColor" />
          <rect x="6.5" y="6" width="3" height="8" rx="0.5" fill="currentColor" />
          <rect x="11" y="2" width="3" height="12" rx="0.5" fill="currentColor" opacity="0.2" />
        </svg>
      )
    case 'low':
      return (
        <svg className={cn(base, 'text-muted-foreground')} viewBox="0 0 16 16" fill="none" aria-label="Low priority">
          <rect x="2" y="10" width="3" height="4" rx="0.5" fill="currentColor" />
          <rect x="6.5" y="6" width="3" height="8" rx="0.5" fill="currentColor" opacity="0.2" />
          <rect x="11" y="2" width="3" height="12" rx="0.5" fill="currentColor" opacity="0.2" />
        </svg>
      )
    default:
      return (
        <svg className={cn(base, 'text-muted-foreground')} viewBox="0 0 16 16" fill="none" aria-label="No priority">
          <rect x="2" y="10" width="3" height="4" rx="0.5" fill="currentColor" opacity="0.2" />
          <rect x="6.5" y="6" width="3" height="8" rx="0.5" fill="currentColor" opacity="0.2" />
          <rect x="11" y="2" width="3" height="12" rx="0.5" fill="currentColor" opacity="0.2" />
        </svg>
      )
  }
}

export function TaskList({ tasks, filter, onFilterChange, onSelect, isLoading }: TaskListProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  const groups = useMemo(() => {
    const byStatus = new Map<string, Task[]>()
    for (const task of tasks) {
      const key = task.status
      const list = byStatus.get(key) ?? []
      list.push(task)
      byStatus.set(key, list)
    }
    return STATUS_GROUP_ORDER
      .filter((s) => byStatus.has(s))
      .map((s) => ({ status: s, label: statusGroupLabel(s), tasks: byStatus.get(s)! }))
  }, [tasks])

  function toggleGroup(status: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 bg-muted/30 px-4 py-3 shrink-0">
        <h1 className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground">Tasks</h1>
        <FilterTabs
          tabs={FILTER_TABS}
          active={filter}
          getLabel={(tab) => FILTER_LABELS[tab]}
          onChange={onFilterChange}
        />
        {isLoading && <Spinner className="ml-auto text-muted-foreground" />}
      </div>

      {/* Rows — grouped by status */}
      <div className="flex-1 overflow-y-auto">
        {!isLoading && tasks.length === 0 && (
          <EmptyState
            title="No tasks"
            description="No tasks match this filter."
            height="h-48"
            className="m-4"
          />
        )}
        {groups.map((group) => {
          const isCollapsed = collapsedGroups.has(group.status)
          return (
            <div key={group.status}>
              {/* Group header */}
              <button
                type="button"
                onClick={() => toggleGroup(group.status)}
                className="sticky top-0 z-10 flex w-full items-center gap-2 bg-muted/40 px-4 py-1.5"
              >
                <CaretRight
                  size={10}
                  weight="bold"
                  className={cn(
                    'shrink-0 text-muted-foreground transition-transform duration-150',
                    !isCollapsed && 'rotate-90',
                  )}
                />
                <StatusIcon status={group.status} />
                <span className="font-mono text-[11px] font-medium text-muted-foreground">
                  {group.label}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {group.tasks.length}
                </span>
              </button>
              {/* Group rows */}
              {!isCollapsed && group.tasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onSelect(task.id)}
                  className="group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted"
                >
                  <div className="w-4" /> {/* indent to align with group header icon */}
                  <PriorityIcon priority={task.priority} />
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground shrink-0">{shortId(task.id)}</span>
                    <SmartText text={task.title} className="truncate text-[13px] text-foreground" />
                  </div>
                  <TaskTypeBadge type={task.type} />
                  <span className="w-24 truncate text-right font-mono text-[11px] text-muted-foreground">{task.assigned_to ?? '—'}</span>
                  <span className="w-12 text-right font-mono text-[11px] text-muted-foreground tabular-nums">{formatRelativeTime(task.updated_at)}</span>
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
