import { m } from "framer-motion"
import { ClockIcon } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

interface TaskListItemProps {
  task: {
    id: string
    title: string
    status: string
    priority: string
    assigned_to?: string
    workflow?: string
    workflow_step?: string
    updated_at: string
  }
  isSelected: boolean
  isFocused: boolean
  onSelect: (id: string) => void
  onOpen: (id: string) => void
  onToggleSelection: (id: string) => void
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted-foreground",
  backlog: "bg-muted-foreground",
  assigned: "bg-blue-500",
  in_progress: "bg-primary",
  review: "bg-amber-500",
  blocked: "bg-red-500",
  done: "bg-green-500",
  cancelled: "bg-muted-foreground/50",
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-amber-500",
  low: "bg-muted-foreground",
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

function formatTaskId(id: string): string {
  // Extract numeric portion or truncate
  const match = id.match(/\d+/)
  if (match) return `QP-${match[0].slice(-3).padStart(3, "0")}`
  return id.slice(0, 8)
}

export function TaskListItem({
  task,
  isSelected,
  isFocused,
  onSelect: _onSelect,
  onOpen,
  onToggleSelection,
}: TaskListItemProps) {
  return (
    <m.div
      layout
      layoutId={task.id}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "flex cursor-pointer items-center gap-3 border-b border-border px-4 py-2.5 transition-colors",
        isFocused && "border-l-2 border-l-primary bg-primary/5",
        isSelected && "bg-accent/50",
        !isFocused && !isSelected && "hover:bg-accent/30",
      )}
      onClick={() => onOpen(task.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(task.id)
        if (e.key === "x") onToggleSelection(task.id)
      }}
      role="button"
      tabIndex={0}
    >
      {/* Selection checkbox area */}
      <button
        type="button"
        className="flex h-4 w-4 shrink-0 items-center justify-center"
        onClick={(e) => {
          e.stopPropagation()
          onToggleSelection(task.id)
        }}
      >
        <div
          className={cn(
            "h-3 w-3 border transition-colors",
            isSelected
              ? "border-primary bg-primary"
              : "border-muted-foreground/50",
          )}
        />
      </button>

      {/* Status dot */}
      <div
        className={cn(
          "h-2.5 w-2.5 shrink-0",
          STATUS_COLORS[task.status] ?? "bg-muted-foreground",
        )}
        title={task.status}
      />

      {/* Task ID */}
      <span className="shrink-0 font-heading text-[11px] text-muted-foreground">
        {formatTaskId(task.id)}
      </span>

      {/* Title */}
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
        {task.title}
      </span>

      {/* Priority dot */}
      <div
        className={cn(
          "h-2 w-2 shrink-0",
          PRIORITY_COLORS[task.priority] ?? "bg-muted-foreground",
        )}
        title={task.priority}
      />

      {/* Assignee */}
      {task.assigned_to && (
        <span className="shrink-0 font-heading text-[11px] text-muted-foreground">
          {task.assigned_to}
        </span>
      )}

      {/* Workflow step */}
      {task.workflow_step && (
        <span className="hidden shrink-0 font-heading text-[11px] text-muted-foreground md:inline">
          {task.workflow_step}
        </span>
      )}

      {/* Time */}
      <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
        <ClockIcon size={11} />
        {formatTimeAgo(task.updated_at)}
      </span>
    </m.div>
  )
}

export { STATUS_COLORS, PRIORITY_COLORS, formatTimeAgo, formatTaskId }
