import { useMemo, useState } from "react"
import { AnimatePresence } from "framer-motion"
import { CaretDownIcon, CaretRightIcon } from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { TaskListItem } from "./task-list-item"
import { EmptyState } from "@/components/feedback/empty-state"
import { ListChecksIcon } from "@phosphor-icons/react"
import type { GroupOption, SortOption } from "./task-filters"

interface Task {
  id: string
  title: string
  description: string
  type: string
  status: string
  priority: string
  assigned_to?: string
  project?: string
  workflow?: string
  workflow_step?: string
  created_by: string
  created_at: string
  updated_at: string
  depends_on: string[]
  blocks: string[]
  [key: string]: unknown
}

interface TaskListProps {
  tasks: Task[]
  groupBy: GroupOption
  sortBy: SortOption
  searchQuery: string
  focusedIndex: number
  selectedIds: Set<string>
  onOpenTask: (id: string) => void
  onToggleSelection: (id: string) => void
}

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

const STATUS_ORDER: Record<string, number> = {
  in_progress: 0,
  review: 1,
  assigned: 2,
  blocked: 3,
  backlog: 4,
  draft: 5,
  done: 6,
  cancelled: 7,
}

function sortTasks(tasks: Task[], sortBy: SortOption): Task[] {
  return [...tasks].sort((a, b) => {
    if (sortBy === "priority") {
      return (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
    }
    if (sortBy === "updated_at") {
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    }
    // created_at
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

function filterBySearch(tasks: Task[], query: string): Task[] {
  if (!query.trim()) return tasks
  const lower = query.toLowerCase()
  return tasks.filter(
    (t) =>
      t.title.toLowerCase().includes(lower) ||
      t.id.toLowerCase().includes(lower) ||
      (t.assigned_to?.toLowerCase().includes(lower) ?? false) ||
      (t.description?.toLowerCase().includes(lower) ?? false),
  )
}

function groupTasks(
  tasks: Task[],
  groupBy: GroupOption,
): Map<string, Task[]> {
  const groups = new Map<string, Task[]>()

  for (const task of tasks) {
    let key: string
    switch (groupBy) {
      case "status":
        key = task.status
        break
      case "assignee":
        key = task.assigned_to ?? "unassigned"
        break
      case "workflow":
        key = task.workflow ?? "none"
        break
      case "priority":
        key = task.priority
        break
      case "project":
        key = task.project ?? "none"
        break
      default:
        key = task.status
    }
    const group = groups.get(key) ?? []
    group.push(task)
    groups.set(key, group)
  }

  // Sort groups by sensible order
  if (groupBy === "status") {
    const sorted = new Map<string, Task[]>()
    const statusKeys = [...groups.keys()].sort(
      (a, b) => (STATUS_ORDER[a] ?? 99) - (STATUS_ORDER[b] ?? 99),
    )
    for (const key of statusKeys) {
      const g = groups.get(key)
      if (g) sorted.set(key, g)
    }
    return sorted
  }

  if (groupBy === "priority") {
    const sorted = new Map<string, Task[]>()
    const priorityKeys = [...groups.keys()].sort(
      (a, b) => (PRIORITY_ORDER[a] ?? 99) - (PRIORITY_ORDER[b] ?? 99),
    )
    for (const key of priorityKeys) {
      const g = groups.get(key)
      if (g) sorted.set(key, g)
    }
    return sorted
  }

  return groups
}

function CollapsibleGroup({
  groupKey,
  groupBy,
  tasks,
  flatStartIndex,
  focusedIndex,
  selectedIds,
  onOpenTask,
  onToggleSelection,
}: {
  groupKey: string
  groupBy: GroupOption
  tasks: Task[]
  flatStartIndex: number
  focusedIndex: number
  selectedIds: Set<string>
  onOpenTask: (id: string) => void
  onToggleSelection: (id: string) => void
}) {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState(
    groupKey === "done" || groupKey === "cancelled",
  )

  const label = useMemo(() => {
    if (groupBy === "status") {
      const key = `tasks.status_${groupKey}` as const
      return t(key)
    }
    if (groupBy === "priority") {
      const key = `tasks.priority_${groupKey}` as const
      return t(key)
    }
    if (groupKey === "unassigned") return t("tasks.unassigned")
    if (groupKey === "none") return "---"
    return groupKey
  }, [groupBy, groupKey, t])

  return (
    <div>
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center gap-2 px-4 py-2 font-heading text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        {collapsed ? <CaretRightIcon size={12} /> : <CaretDownIcon size={12} />}
        <span>{label}</span>
        <span className="text-muted-foreground/60">({tasks.length})</span>
      </button>
      {!collapsed && (
        <AnimatePresence mode="popLayout">
          {tasks.map((task, idx) => (
            <TaskListItem
              key={task.id}
              task={task}
              isFocused={flatStartIndex + idx === focusedIndex}
              isSelected={selectedIds.has(task.id)}
              onSelect={() => onOpenTask(task.id)}
              onOpen={onOpenTask}
              onToggleSelection={onToggleSelection}
            />
          ))}
        </AnimatePresence>
      )}
    </div>
  )
}

export function TaskList({
  tasks,
  groupBy,
  sortBy,
  searchQuery,
  focusedIndex,
  selectedIds,
  onOpenTask,
  onToggleSelection,
}: TaskListProps) {
  const { t } = useTranslation()

  const filtered = useMemo(() => filterBySearch(tasks, searchQuery), [tasks, searchQuery])
  const sorted = useMemo(() => sortTasks(filtered, sortBy), [filtered, sortBy])
  const groups = useMemo(() => groupTasks(sorted, groupBy), [sorted, groupBy])

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={<ListChecksIcon size={32} />}
        message={t("tasks.no_tasks")}
        description={t("tasks.no_tasks_description")}
      />
    )
  }

  let flatIndex = 0

  return (
    <div className="flex flex-col">
      {Array.from(groups.entries()).map(([key, groupTasks]) => {
        const startIndex = flatIndex
        flatIndex += groupTasks.length
        return (
          <CollapsibleGroup
            key={key}
            groupKey={key}
            groupBy={groupBy}
            tasks={groupTasks}
            flatStartIndex={startIndex}
            focusedIndex={focusedIndex}
            selectedIds={selectedIds}
            onOpenTask={onOpenTask}
            onToggleSelection={onToggleSelection}
          />
        )
      })}
    </div>
  )
}

export type { Task }
