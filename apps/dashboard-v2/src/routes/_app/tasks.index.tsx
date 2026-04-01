import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { useState, useMemo, useCallback } from "react"
import { PlusIcon, ListIcon, SquaresFourIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet"
import { useTranslation } from "@/lib/i18n"
import { useTaskUIStore } from "@/features/tasks/task-ui.store"
import { tasksQuery } from "@/features/tasks/task.queries"
import { TaskList } from "@/features/tasks/task-list"
import { TaskBoard } from "@/features/tasks/task-board"
import { TaskCreateForm } from "@/features/tasks/task-create-form"
import { TaskFilters } from "@/features/tasks/task-filters"
import { useTaskKeyboardNav } from "@/features/tasks/use-task-keyboard-nav"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { PageTransition } from "@/components/layouts/page-transition"
import type { SortOption, GroupOption } from "@/features/tasks/task-filters"

export const Route = createFileRoute("/_app/tasks/")({
  component: TasksPage,
})

function TasksPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const viewMode = useTaskUIStore((s) => s.viewMode)
  const setViewMode = useTaskUIStore((s) => s.setViewMode)

  // Filters
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<SortOption>("created_at")
  const [groupBy, setGroupBy] = useState<GroupOption>("status")

  // Task creation sheet
  const [createOpen, setCreateOpen] = useState(false)

  // Build query filters
  const filters = useMemo(() => {
    const f: Record<string, string> = {}
    if (statusFilter !== "all") f.status = statusFilter
    return f
  }, [statusFilter])

  const { data, isLoading } = useQuery(tasksQuery(filters))

  const tasks = useMemo(() => {
    const list = (data ?? []) as Array<{
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
    }>

    // Apply priority filter client-side
    if (priorityFilter !== "all") {
      return list.filter((task) => task.priority === priorityFilter)
    }
    return list
  }, [data, priorityFilter])

  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks])

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const handleToggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const handleOpenTask = useCallback(
    (id: string) => {
      void navigate({ to: "/tasks/$id", params: { id } })
    },
    [navigate],
  )

  // Keyboard nav
  const { focusedIndex } = useTaskKeyboardNav({
    taskIds,
    onOpenTask: handleOpenTask,
    onToggleSelection: handleToggleSelection,
    onClearSelection: handleClearSelection,
    enabled: !createOpen,
  })

  // Cmd+Enter to create new task
  const newTaskBindings = useMemo(
    () => ({
      "$mod+Enter": (e: KeyboardEvent) => {
        e.preventDefault()
        setCreateOpen(true)
      },
    }),
    [],
  )
  useKeyboardShortcuts(newTaskBindings)

  return (
    <PageTransition className="flex flex-1 flex-col">
      {/* Page header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-2xl font-semibold">
            {t("tasks.title")}
          </h1>
          {tasks.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {tasks.length}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center border border-border">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="icon-sm"
              onClick={() => setViewMode("list")}
              title={t("tasks.view_list")}
            >
              <ListIcon size={14} />
            </Button>
            <Button
              variant={viewMode === "board" ? "default" : "ghost"}
              size="icon-sm"
              onClick={() => setViewMode("board")}
              title={t("tasks.view_board")}
            >
              <SquaresFourIcon size={14} />
            </Button>
          </div>

          {/* New task */}
          <Button
            className="gap-1.5"
            onClick={() => setCreateOpen(true)}
          >
            <PlusIcon size={14} />
            {t("tasks.new_task")}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-border px-6 py-2">
        <TaskFilters
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          priorityFilter={priorityFilter}
          onPriorityFilterChange={setPriorityFilter}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <TaskListSkeleton />
      ) : viewMode === "list" ? (
        <TaskList
          tasks={tasks}
          groupBy={groupBy}
          sortBy={sortBy}
          searchQuery={searchQuery}
          focusedIndex={focusedIndex}
          selectedIds={selectedIds}
          onOpenTask={handleOpenTask}
          onToggleSelection={handleToggleSelection}
        />
      ) : (
        <TaskBoard
          tasks={tasks}
          searchQuery={searchQuery}
          onOpenTask={handleOpenTask}
        />
      )}

      {/* Create task sheet */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[500px]"
        >
          <TaskCreateForm onClose={() => setCreateOpen(false)} />
        </SheetContent>
      </Sheet>
    </PageTransition>
  )
}

function TaskListSkeleton() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-0" aria-busy="true" aria-label={t("a11y.loading_tasks")}>
      {/* Group header skeleton */}
      <div className="px-4 py-2">
        <div className="h-4 w-32 animate-pulse motion-reduce:animate-none bg-muted" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-3">
          <div className="h-3 w-3 animate-pulse motion-reduce:animate-none bg-muted" />
          <div className="h-2.5 w-2.5 animate-pulse motion-reduce:animate-none bg-muted" />
          <div className="h-3 w-16 animate-pulse motion-reduce:animate-none bg-muted" />
          <div className="h-3 flex-1 animate-pulse motion-reduce:animate-none bg-muted" />
          <div className="h-3 w-12 animate-pulse motion-reduce:animate-none bg-muted" />
          <div className="h-3 w-10 animate-pulse motion-reduce:animate-none bg-muted" />
        </div>
      ))}
      {/* Second group */}
      <div className="px-4 py-2">
        <div className="h-4 w-24 animate-pulse motion-reduce:animate-none bg-muted" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={`g2-${i}`} className="flex items-center gap-3 border-b border-border px-4 py-3">
          <div className="h-3 w-3 animate-pulse motion-reduce:animate-none bg-muted" />
          <div className="h-2.5 w-2.5 animate-pulse motion-reduce:animate-none bg-muted" />
          <div className="h-3 w-16 animate-pulse motion-reduce:animate-none bg-muted" />
          <div className="h-3 flex-1 animate-pulse motion-reduce:animate-none bg-muted" />
          <div className="h-3 w-12 animate-pulse motion-reduce:animate-none bg-muted" />
          <div className="h-3 w-10 animate-pulse motion-reduce:animate-none bg-muted" />
        </div>
      ))}
    </div>
  )
}
