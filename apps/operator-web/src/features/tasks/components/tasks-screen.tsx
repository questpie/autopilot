import { useSetLayoutMode } from '@/features/shell/layout-mode-context'
import { useTasksScreen } from '../hooks/use-tasks-screen'
import { TaskList } from './task-list'
import { TaskDetail } from './task-detail'

export function TasksScreen() {
  useSetLayoutMode('immersive')
  const {
    tasks,
    isLoading,
    filter,
    setFilter,
    selectedTaskId,
    selectTask,
    taskDetail,
    isDetailLoading,
  } = useTasksScreen()

  if (selectedTaskId) {
    return (
      <TaskDetail
        detail={taskDetail}
        isLoading={isDetailLoading}
        onBack={() => selectTask('')}
        onSelectTask={selectTask}
      />
    )
  }

  return (
    <TaskList
      tasks={tasks}
      filter={filter}
      onFilterChange={setFilter}
      onSelect={selectTask}
      isLoading={isLoading}
    />
  )
}
