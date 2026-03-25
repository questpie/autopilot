import { useQuery } from '@tanstack/react-query'

interface Task {
	id: string
	status: string
}

const STATUS_COLORS: Record<string, string> = {
	done: 'bg-success',
	in_progress: 'bg-primary',
	review: 'bg-warning',
	blocked: 'bg-destructive',
	assigned: 'bg-muted-foreground',
}

const STATUS_LABELS: Record<string, string> = {
	done: 'Done',
	in_progress: 'In Progress',
	review: 'Review',
	blocked: 'Blocked',
	assigned: 'Assigned',
}

export default function TaskSummary() {
	const { data: tasks, isLoading } = useQuery<Task[]>({
		queryKey: ['tasks'],
		queryFn: () => fetch('/api/tasks').then((r) => r.json()),
		refetchInterval: 10000,
	})

	if (isLoading) {
		return (
			<div className="animate-pulse space-y-2">
				<div className="h-8 bg-muted w-1/3" />
				<div className="h-2 bg-muted w-full" />
			</div>
		)
	}

	const total = tasks?.length ?? 0
	const done = tasks?.filter((t) => t.status === 'done').length ?? 0
	const counts: Record<string, number> = {}

	for (const t of tasks ?? []) {
		counts[t.status] = (counts[t.status] ?? 0) + 1
	}

	const statuses = ['done', 'in_progress', 'review', 'blocked', 'assigned']

	return (
		<div>
			<div className="text-3xl font-bold text-foreground mb-1">
				{done}/{total}
			</div>
			<div className="font-mono text-[10px] text-muted-foreground mb-3">
				tasks completed
			</div>

			{/* Progress bar */}
			<div className="h-2 bg-muted flex overflow-hidden mb-3">
				{statuses.map((status) => {
					const count = counts[status] ?? 0
					if (count === 0 || total === 0) return null
					return (
						<div
							key={status}
							className={STATUS_COLORS[status] ?? 'bg-muted-foreground'}
							style={{ width: `${(count / total) * 100}%` }}
						/>
					)
				})}
			</div>

			{/* Legend */}
			<div className="flex flex-wrap gap-3">
				{statuses.map((status) => {
					const count = counts[status] ?? 0
					if (count === 0) return null
					return (
						<div key={status} className="flex items-center gap-1.5">
							<div className={`w-2 h-2 ${STATUS_COLORS[status] ?? 'bg-muted-foreground'}`} />
							<span className="font-mono text-[10px] text-muted-foreground">
								{STATUS_LABELS[status] ?? status} ({count})
							</span>
						</div>
					)
				})}
			</div>
		</div>
	)
}
