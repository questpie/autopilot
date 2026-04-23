import { useSetLayoutMode } from '@/features/shell/layout-mode-context'
import { useTasksScreen } from '../hooks/use-tasks-screen'
import { TaskList } from './task-list'
import { TaskDetail } from './task-detail'

export function TasksScreen() {
	useSetLayoutMode('immersive')
	const {
		allTasks,
		tasks,
		childToParent,
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
			allTasks={allTasks}
			tasks={tasks}
			childToParent={childToParent}
			filter={filter}
			onFilterChange={setFilter}
			onSelect={selectTask}
			isLoading={isLoading}
		/>
	)
}
