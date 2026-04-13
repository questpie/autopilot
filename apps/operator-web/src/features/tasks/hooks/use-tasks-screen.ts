import { useNavigate, useLocation } from '@tanstack/react-router'
import { useTasks, useTaskDetail } from '@/hooks/use-tasks'

export type TaskFilter = 'all' | 'active' | 'backlog' | 'done' | 'failed'

const FILTER_STATUSES: Record<TaskFilter, string[] | null> = {
  all: null,
  active: ['active', 'blocked'],
  backlog: ['backlog'],
  done: ['done'],
  failed: ['failed'],
}

export function useTasksScreen() {
  const location = useLocation()
  const search = location.search as { taskId?: string; filter?: TaskFilter }
  const selectedTaskId = search.taskId ?? null
  const filter = search.filter ?? 'all'
  const navigate = useNavigate()

  const tasksQuery = useTasks()
  const detailQuery = useTaskDetail(selectedTaskId ?? null)

  function setFilter(next: TaskFilter) {
    void navigate({ to: '/tasks', search: { filter: next === 'all' ? undefined : next } })
  }

  function selectTask(id: string) {
    void navigate({ to: '/tasks', search: { ...search, taskId: id || undefined } })
  }

  const allTasks = tasksQuery.data ?? []
  const statuses = FILTER_STATUSES[filter]
  const tasks = statuses ? allTasks.filter((t) => statuses.includes(t.status)) : allTasks

  return {
    tasks,
    isLoading: tasksQuery.isLoading,
    filter: filter ?? 'all',
    setFilter,
    selectedTaskId: selectedTaskId ?? null,
    selectTask,
    taskDetail: detailQuery.data,
    isDetailLoading: detailQuery.isLoading,
  }
}
