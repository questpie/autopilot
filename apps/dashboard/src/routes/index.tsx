import { createFileRoute, useSearch, useNavigate } from '@tanstack/react-router'
import { useRef, useMemo, useState } from 'react'
import { TopBar } from '@/components/layout/top-bar'
import { KanbanBoard } from '@/components/data/kanban-board'
import { TaskCard } from '@/components/data/task-card'
import { ActivityItem } from '@/components/data/activity-item'
import { PinCard } from '@/components/data/pin-card'
import { PinDetailPanel } from '@/components/data/pin-detail-panel'
import { CreateTaskDialog } from '@/components/data/create-task-dialog'
import { RejectDialog } from '@/components/data/reject-dialog'
import { EmptyState } from '@/components/feedback/empty-state'
import { ErrorBoundary } from '@/components/feedback/error-boundary'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useTasks, useApproveTask, useRejectTask } from '@/hooks/use-tasks'
import { useActivity } from '@/hooks/use-activity'
import { usePins } from '@/hooks/use-pins'
import { useAgents } from '@/hooks/use-agents'
import { useGroups } from '@/hooks/use-groups'
import { useLayout, LayoutRenderer } from '@/lib/layout-engine'
import { cn } from '@/lib/utils'
import type { Task, TaskStatus, Pin, DashboardGroup } from '@/lib/types'

export const Route = createFileRoute('/')({
	component: DashboardPage,
	validateSearch: (search: Record<string, unknown>) => ({
		pin: (search.pin as string) ?? undefined,
		view: (search.view as string) ?? 'kanban',
	}),
})

type ViewMode = 'kanban' | 'list'

const STATUS_ORDER: TaskStatus[] = ['blocked', 'review', 'in_progress', 'assigned']
const STATUS_LABELS: Record<TaskStatus, string> = {
	backlog: 'BACKLOG',
	blocked: 'BLOCKED',
	review: 'REVIEW',
	in_progress: 'IN PROGRESS',
	assigned: 'ASSIGNED',
	done: 'DONE',
}

function DashboardPage() {
	const { pin: pinId, view: viewParam } = useSearch({ from: '/' })
	const navigate = useNavigate()
	const { data: pins } = usePins()
	const { data: agents } = useAgents()
	const { data: layout } = useLayout()
	const [showCreateTask, setShowCreateTask] = useState(false)
	const [rejectingTaskId, setRejectingTaskId] = useState<string | null>(null)
	const rejectTask = useRejectTask()
	const viewMode = (viewParam === 'list' ? 'list' : 'kanban') as ViewMode

	const agentRoleMap = useMemo(() => {
		const map: Record<string, string> = {}
		if (agents) {
			for (const a of agents) {
				map[a.id] = a.role
				map[a.name] = a.role
			}
		}
		return map
	}, [agents])

	const selectedPin = pinId ? pins?.find((p) => p.id === pinId) : undefined
	const closePanel = () => navigate({ to: '/', search: { view: viewMode }, replace: true })

	const setView = (v: ViewMode) => {
		navigate({ to: '/', search: { view: v }, replace: true })
	}

	return (
		<ErrorBoundary>
			<TopBar title="Dashboard">
				<TaskCountSummary />
				<div className="flex items-center gap-1 border border-border">
					<button
						onClick={() => setView('kanban')}
						className={cn(
							'font-mono text-[10px] px-2 py-1 transition-colors',
							viewMode === 'kanban' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground',
						)}
					>
						Board
					</button>
					<button
						onClick={() => setView('list')}
						className={cn(
							'font-mono text-[10px] px-2 py-1 transition-colors',
							viewMode === 'list' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground',
						)}
					>
						List
					</button>
				</div>
				<Button size="sm" onClick={() => setShowCreateTask(true)}>New Task</Button>
			</TopBar>

			<div className="flex flex-1 overflow-hidden">
				<div className="flex-1 overflow-y-auto">
					{viewMode === 'kanban' ? (
						<KanbanBoard />
					) : (
						<div className="p-6 space-y-6">
							<TasksSection
								onSelectTask={(id) => navigate({ to: '/tasks/$taskId', params: { taskId: id } })}
								onRejectTask={(id) => setRejectingTaskId(id)}
							/>
							<GroupedPinsSection
								agentRoleMap={agentRoleMap}
								onSelectPin={(id) => navigate({ to: '/', search: { pin: id, view: viewMode }, replace: true })}
							/>
						</div>
					)}
				</div>

				{/* Activity Feed */}
				<div className="w-[380px] border-l border-border overflow-y-auto shrink-0 hidden lg:block">
					<ActivitySection agentRoleMap={agentRoleMap} />
				</div>
			</div>

			{selectedPin && (
				<PinDetailPanel
					pin={selectedPin}
					agentRole={selectedPin.created_by ? agentRoleMap[selectedPin.created_by] : undefined}
					onClose={closePanel}
				/>
			)}

			{showCreateTask && (
				<CreateTaskDialog onClose={() => setShowCreateTask(false)} />
			)}

			{rejectingTaskId && (
				<RejectDialog
					onSubmit={(reason) => {
						rejectTask.mutate({ taskId: rejectingTaskId, reason })
						setRejectingTaskId(null)
					}}
					onClose={() => setRejectingTaskId(null)}
					isLoading={rejectTask.isPending}
				/>
			)}
		</ErrorBoundary>
	)
}

const COUNT_LABELS: Record<string, string> = {
	in_progress: 'active',
	review: 'review',
	blocked: 'blocked',
	assigned: 'assigned',
	backlog: 'backlog',
}

function TaskCountSummary() {
	const { data: tasks } = useTasks()

	const counts = useMemo(() => {
		if (!tasks) return []
		const map: Record<string, number> = {}
		for (const t of tasks) {
			if (t.status === 'done') continue
			map[t.status] = (map[t.status] ?? 0) + 1
		}
		return STATUS_ORDER
			.filter((s) => (map[s] ?? 0) > 0)
			.map((s) => `${map[s]} ${COUNT_LABELS[s] ?? s}`)
	}, [tasks])

	if (counts.length === 0) return null

	return (
		<span className="font-mono text-[10px] text-muted-foreground">
			{counts.join(' \u00b7 ')}
		</span>
	)
}

function TasksSection({
	onSelectTask,
	onRejectTask,
}: {
	onSelectTask: (id: string) => void
	onRejectTask: (id: string) => void
}) {
	const { data: tasks, isLoading, isError } = useTasks()
	const approveTask = useApproveTask()

	if (isLoading) {
		return (
			<div className="space-y-3">
				{Array.from({ length: 4 }).map((_, i) => (
					<Skeleton key={i} className="h-24 w-full" />
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

	if (!tasks || tasks.length === 0) {
		return (
			<EmptyState
				icon={'\u2B21'}
				title="No tasks yet"
				description="Send your first intent via chat to get your AI team working."
				action={{ label: 'Go to Chat', to: '/chat' }}
			/>
		)
	}

	const grouped = STATUS_ORDER.reduce(
		(acc, status) => {
			const items = tasks.filter((t) => t.status === status)
			if (items.length > 0) acc[status] = items
			return acc
		},
		{} as Record<TaskStatus, Task[]>,
	)

	return (
		<div className="space-y-4">
			{STATUS_ORDER.map((status) => {
				const items = grouped[status]
				if (!items) return null
				return (
					<div key={status}>
						<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.12em] mb-2 flex items-center gap-2">
							{STATUS_LABELS[status]}
							<span className="text-[9px] opacity-60">{items.length}</span>
						</div>
						<div className="space-y-2">
							{items.map((task) => (
								<TaskCard
									key={task.id}
									task={task}
									onClick={() => onSelectTask(task.id)}
									onApprove={() => approveTask.mutate(task.id)}
									onReject={() => onRejectTask(task.id)}
								/>
							))}
						</div>
					</div>
				)
			})}
		</div>
	)
}

function GroupedPinsSection({
	agentRoleMap,
	onSelectPin,
}: {
	agentRoleMap: Record<string, string>
	onSelectPin: (id: string) => void
}) {
	const { data: pins, isLoading: pinsLoading } = usePins()
	const { data: groupsData } = useGroups()

	if (pinsLoading || !pins || pins.length === 0) return null

	const groups: DashboardGroup[] = groupsData?.groups ?? []
	const sortedGroups = [...groups].sort((a, b) => a.position - b.position)

	const pinsByGroup: Record<string, Pin[]> = {}
	const ungrouped: Pin[] = []

	for (const pin of pins) {
		if (pin.group && pinsByGroup[pin.group] !== undefined) {
			pinsByGroup[pin.group] = [...(pinsByGroup[pin.group] ?? []), pin]
		} else if (pin.group) {
			const matchesGroup = sortedGroups.some((g) => g.id === pin.group)
			if (matchesGroup) {
				pinsByGroup[pin.group] = [pin]
			} else {
				ungrouped.push(pin)
			}
		} else {
			ungrouped.push(pin)
		}
	}

	return (
		<div className="space-y-6">
			{sortedGroups.map((group) => {
				const groupPins = pinsByGroup[group.id]
				if (!groupPins || groupPins.length === 0) return null
				return (
					<div key={group.id}>
						<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.12em] mb-2">
							{group.title}
						</div>
						<PinLayout layout={group.layout} columns={group.columns}>
							{groupPins.map((pin) => (
								<PinCard
									key={pin.id}
									pin={pin}
									agentRole={pin.created_by ? agentRoleMap[pin.created_by] : undefined}
									onClick={() => onSelectPin(pin.id)}
								/>
							))}
						</PinLayout>
					</div>
				)
			})}
			{ungrouped.length > 0 && (
				<div>
					<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.12em] mb-2">
						{sortedGroups.length > 0 ? 'Uncategorized' : 'Board Pins'}
					</div>
					<div className="grid grid-cols-2 gap-2">
						{ungrouped.map((pin) => (
							<PinCard
								key={pin.id}
								pin={pin}
								agentRole={pin.created_by ? agentRoleMap[pin.created_by] : undefined}
								onClick={() => onSelectPin(pin.id)}
							/>
						))}
					</div>
				</div>
			)}
		</div>
	)
}

function PinLayout({
	layout,
	columns,
	children,
}: {
	layout?: string
	columns?: number
	children: React.ReactNode
}) {
	if (layout === 'stack') return <div className="space-y-2">{children}</div>
	if (layout === 'grid') {
		const cols = columns ?? 2
		return (
			<div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
				{children}
			</div>
		)
	}
	return <div className="grid grid-cols-2 gap-2">{children}</div>
}

function ActivitySection({ agentRoleMap }: { agentRoleMap: Record<string, string> }) {
	const { data: activity, isLoading } = useActivity()
	const { data: agents } = useAgents()
	const [filterAgent, setFilterAgent] = useState('')
	const scrollRef = useRef<HTMLDivElement>(null)

	const filtered = useMemo(() => {
		if (!activity) return []
		const reversed = [...activity].reverse()
		if (!filterAgent) return reversed
		return reversed.filter((e) => e.agent === filterAgent)
	}, [activity, filterAgent])

	return (
		<div className="flex flex-col h-full">
			<div className="p-4 border-b border-border shrink-0 flex items-center justify-between gap-2">
				<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
					Activity Feed
				</span>
				<select
					value={filterAgent}
					onChange={(e) => setFilterAgent(e.target.value)}
					className="font-mono text-[10px] bg-transparent border border-border px-1.5 py-0.5 text-foreground outline-none"
				>
					<option value="">All agents</option>
					{agents?.map((a) => (
						<option key={a.id} value={a.name}>{a.name}</option>
					))}
				</select>
			</div>
			<div ref={scrollRef} className="flex-1 overflow-y-auto px-4">
				{isLoading ? (
					<div className="space-y-3 py-4">
						{Array.from({ length: 8 }).map((_, i) => (
							<Skeleton key={i} className="h-10 w-full" />
						))}
					</div>
				) : filtered.length === 0 ? (
					<EmptyState
						title="No activity yet"
						description="Agents will appear here when working."
					/>
				) : (
					<div className="divide-y divide-border">
						{filtered.map((entry, i) => (
							<ActivityItem
								key={`${entry.at}-${entry.agent}-${i}`}
								entry={entry}
								agentRole={agentRoleMap[entry.agent]}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	)
}
