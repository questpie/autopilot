import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useTasks, useUpdateTaskStatus } from '@/hooks/use-tasks'
import { useKanban, COLUMN_LABELS, type GroupBy } from '@/hooks/use-kanban'
import { KanbanCard } from './kanban-card'
import { KanbanFilterBar } from './kanban-filter-bar'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/feedback/empty-state'
import type { Task } from '@/lib/types'

export function KanbanBoard() {
	const { data: tasks, isLoading, isError } = useTasks()
	const kanban = useKanban(tasks)
	const updateStatus = useUpdateTaskStatus()
	const navigate = useNavigate()
	const [draggedTask, setDraggedTask] = useState<string | null>(null)

	if (isLoading) {
		return (
			<div className="flex gap-4 p-6 overflow-x-auto">
				{Array.from({ length: 5 }).map((_, i) => (
					<div key={i} className="w-[260px] shrink-0 space-y-3">
						<Skeleton className="h-6 w-24" />
						<Skeleton className="h-24 w-full" />
						<Skeleton className="h-24 w-full" />
					</div>
				))}
			</div>
		)
	}

	if (isError) {
		return (
			<EmptyState
				icon={'\u26A0'}
				title="Cannot connect to orchestrator"
				description="Make sure it's running on :7778"
			/>
		)
	}

	const handleDragStart = (taskId: string) => {
		setDraggedTask(taskId)
	}

	const handleDrop = (columnId: string) => {
		if (draggedTask && kanban.groupBy === 'status') {
			updateStatus.mutate({ taskId: draggedTask, status: columnId })
		}
		setDraggedTask(null)
	}

	return (
		<div className="flex flex-col flex-1 overflow-hidden">
			<KanbanFilterBar
				filters={kanban.filters}
				filterOptions={kanban.filterOptions}
				onFilterChange={kanban.updateFilter}
				onReset={kanban.resetFilters}
				groupBy={kanban.groupBy}
				onGroupByChange={kanban.setGroupBy}
			/>
			<div className="flex gap-3 p-4 overflow-x-auto flex-1">
				{kanban.columns.map((col) => (
					<KanbanColumn
						key={col.id}
						id={col.id}
						label={col.label}
						tasks={col.tasks}
						isDragTarget={kanban.groupBy === 'status'}
						onDragStart={handleDragStart}
						onDrop={handleDrop}
						onClickTask={(id) => navigate({ to: '/tasks/$taskId', params: { taskId: id } })}
					/>
				))}
			</div>
		</div>
	)
}

function KanbanColumn({
	id,
	label,
	tasks,
	isDragTarget,
	onDragStart,
	onDrop,
	onClickTask,
}: {
	id: string
	label: string
	tasks: Task[]
	isDragTarget: boolean
	onDragStart: (taskId: string) => void
	onDrop: (columnId: string) => void
	onClickTask: (taskId: string) => void
}) {
	const [isOver, setIsOver] = useState(false)

	return (
		<div
			className={`w-[260px] shrink-0 flex flex-col ${isOver ? 'bg-primary/5' : ''}`}
			onDragOver={(e) => {
				if (!isDragTarget) return
				e.preventDefault()
				setIsOver(true)
			}}
			onDragLeave={() => setIsOver(false)}
			onDrop={() => {
				setIsOver(false)
				onDrop(id)
			}}
		>
			<div className="flex items-center gap-2 px-2 py-2 mb-2">
				<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.12em] font-semibold">
					{label}
				</span>
				<span className="font-mono text-[9px] text-muted-foreground/60">
					{tasks.length}
				</span>
			</div>
			<div className="flex-1 space-y-2 overflow-y-auto min-h-[100px]">
				{tasks.map((task) => (
					<KanbanCard
						key={task.id}
						task={task}
						onClick={() => onClickTask(task.id)}
						onDragStart={() => onDragStart(task.id)}
					/>
				))}
			</div>
		</div>
	)
}
