import { useMemo, useState } from 'react'
import { CaretRight, ChatCircle, Faders, Lightning, Timer } from '@phosphor-icons/react'
import type { Task } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import {
	InspectorHeader,
	InspectorLayout,
	type InspectorHeaderAction,
} from '@/components/ui/inspector-layout'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SmartText } from '@/lib/smart-links'
import { cn } from '@/lib/utils'
import type { TaskFilter } from '../hooks/use-tasks-screen'

const FILTER_TABS = [
	'all',
	'active',
	'blocked',
	'backlog',
	'done',
	'failed',
] as const satisfies readonly TaskFilter[]

const FILTER_LABELS: Record<TaskFilter, string> = {
	all: 'All',
	active: 'Active',
	blocked: 'Blocked',
	backlog: 'Backlog',
	done: 'Done',
	failed: 'Failed',
}

type GroupBy = 'status' | 'priority' | 'type' | 'assignee' | 'none'

const STATUS_GROUP_ORDER = ['active', 'blocked', 'backlog', 'done', 'failed']
const PRIORITY_GROUP_ORDER = ['high', 'medium', 'low']
const TYPE_GROUP_ORDER = ['query', 'scheduled', 'task']
const UNASSIGNED_GROUP_KEY = '__unassigned__'

interface DisplayOptions {
	showSubtasks: boolean
	showId: boolean
	showType: boolean
	showAssignee: boolean
	showUpdated: boolean
}

interface TaskListProps {
	allTasks: Task[]
	tasks: Task[]
	childToParent: Map<string, string>
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

function statusGroupLabel(status: string): string {
	switch (status) {
		case 'active':
			return 'Active'
		case 'blocked':
			return 'Blocked'
		case 'backlog':
			return 'Backlog'
		case 'done':
			return 'Done'
		case 'failed':
			return 'Failed'
		default:
			return status
	}
}

function StatusIcon({ status }: { status: string }) {
	const base = 'size-4 shrink-0'

	switch (status) {
		case 'active':
			return (
				<svg className={cn(base, 'text-info')} viewBox="0 0 16 16" fill="none">
					<circle
						cx="8"
						cy="8"
						r="6"
						stroke="currentColor"
						strokeWidth="2"
						strokeDasharray="12 20"
					/>
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
					<path
						d="M5.5 8L7 9.5L10.5 6"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			)
		case 'failed':
			return (
				<svg className={cn(base, 'text-destructive')} viewBox="0 0 16 16" fill="none">
					<circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" />
					<path
						d="M6 6L10 10M10 6L6 10"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
					/>
				</svg>
			)
		default:
			return (
				<svg className={cn(base, 'text-muted-foreground')} viewBox="0 0 16 16" fill="none">
					<circle
						cx="8"
						cy="8"
						r="6"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeDasharray="3 3"
					/>
				</svg>
			)
	}
}

const TASK_TYPE_CONFIG: Record<
	string,
	{ icon: typeof ChatCircle; label: string; variant: 'default' | 'info' | 'warning' }
> = {
	query: { icon: ChatCircle, label: 'query', variant: 'info' },
	scheduled: { icon: Timer, label: 'scheduled', variant: 'warning' },
	task: { icon: Lightning, label: 'task', variant: 'default' },
}

function TaskTypeBadge({ type }: { type: string }) {
	const config = TASK_TYPE_CONFIG[type]
	if (!config) {
		return (
			<Badge variant="outline" className="h-4 px-1.5 font-mono text-[10px]">
				{type}
			</Badge>
		)
	}

	const Icon = config.icon
	return (
		<Badge variant={config.variant} className="h-4 px-1.5 font-mono text-[10px]">
			<Icon data-icon="inline-start" weight="bold" />
			{config.label}
		</Badge>
	)
}

function PriorityIcon({ priority }: { priority: string }) {
	const base = 'size-3.5 shrink-0'

	switch (priority) {
		case 'high':
			return (
				<svg
					className={cn(base, 'text-warning')}
					viewBox="0 0 16 16"
					fill="none"
					aria-label="High priority"
				>
					<rect x="2" y="10" width="3" height="4" rx="0.5" fill="currentColor" />
					<rect x="6.5" y="6" width="3" height="8" rx="0.5" fill="currentColor" />
					<rect x="11" y="2" width="3" height="12" rx="0.5" fill="currentColor" />
				</svg>
			)
		case 'medium':
			return (
				<svg
					className={cn(base, 'text-muted-foreground')}
					viewBox="0 0 16 16"
					fill="none"
					aria-label="Medium priority"
				>
					<rect x="2" y="10" width="3" height="4" rx="0.5" fill="currentColor" />
					<rect x="6.5" y="6" width="3" height="8" rx="0.5" fill="currentColor" />
					<rect x="11" y="2" width="3" height="12" rx="0.5" fill="currentColor" opacity="0.2" />
				</svg>
			)
		case 'low':
			return (
				<svg
					className={cn(base, 'text-muted-foreground')}
					viewBox="0 0 16 16"
					fill="none"
					aria-label="Low priority"
				>
					<rect x="2" y="10" width="3" height="4" rx="0.5" fill="currentColor" />
					<rect x="6.5" y="6" width="3" height="8" rx="0.5" fill="currentColor" opacity="0.2" />
					<rect x="11" y="2" width="3" height="12" rx="0.5" fill="currentColor" opacity="0.2" />
				</svg>
			)
		default:
			return (
				<svg
					className={cn(base, 'text-muted-foreground')}
					viewBox="0 0 16 16"
					fill="none"
					aria-label="No priority"
				>
					<rect x="2" y="10" width="3" height="4" rx="0.5" fill="currentColor" opacity="0.2" />
					<rect x="6.5" y="6" width="3" height="8" rx="0.5" fill="currentColor" opacity="0.2" />
					<rect x="11" y="2" width="3" height="12" rx="0.5" fill="currentColor" opacity="0.2" />
				</svg>
			)
	}
}

function getGroupKey(task: Task, groupBy: GroupBy): string {
	switch (groupBy) {
		case 'status':
			return task.status
		case 'priority':
			return task.priority || 'none'
		case 'type':
			return task.type
		case 'assignee':
			return task.assigned_to ?? UNASSIGNED_GROUP_KEY
		default:
			return '__all__'
	}
}

function getGroupLabel(groupBy: GroupBy, key: string): string {
	switch (groupBy) {
		case 'status':
			return statusGroupLabel(key)
		case 'priority':
			return key === 'none' ? 'No priority' : key.charAt(0).toUpperCase() + key.slice(1)
		case 'type':
			return TASK_TYPE_CONFIG[key]?.label ?? key
		case 'assignee':
			return key === UNASSIGNED_GROUP_KEY ? 'Unassigned' : key
		default:
			return 'All tasks'
	}
}

function sortGroupKeys(groupBy: GroupBy, keys: string[]): string[] {
	if (groupBy === 'status') {
		return [
			...STATUS_GROUP_ORDER.filter((key) => keys.includes(key)),
			...keys.filter((key) => !STATUS_GROUP_ORDER.includes(key)),
		]
	}

	if (groupBy === 'priority') {
		return [
			...PRIORITY_GROUP_ORDER.filter((key) => keys.includes(key)),
			...keys.filter((key) => !PRIORITY_GROUP_ORDER.includes(key)),
		]
	}

	if (groupBy === 'type') {
		return [
			...TYPE_GROUP_ORDER.filter((key) => keys.includes(key)),
			...keys.filter((key) => !TYPE_GROUP_ORDER.includes(key)),
		]
	}

	if (groupBy === 'assignee') {
		return [...keys].sort((a, b) => {
			if (a === UNASSIGNED_GROUP_KEY) return 1
			if (b === UNASSIGNED_GROUP_KEY) return -1
			return a.localeCompare(b)
		})
	}

	return keys
}

function TaskRow({
	task,
	isSubtask,
	display,
	onSelect,
}: {
	task: Task
	isSubtask: boolean
	display: DisplayOptions
	onSelect: (id: string) => void
}) {
	const hasDesktopMeta = display.showType || display.showAssignee || display.showUpdated

	return (
		<button
			type="button"
			onClick={() => onSelect(task.id)}
			className="group flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-[background-color,color] hover:bg-muted/40"
		>
			<div className="flex h-5 w-4 shrink-0 items-center justify-center pt-0.5">
				<PriorityIcon priority={task.priority} />
			</div>
			<div className="min-w-0 flex-1">
				<div className="flex min-w-0 items-center gap-2">
					{display.showId ? (
						<span className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
							{shortId(task.id)}
						</span>
					) : null}
					<SmartText text={task.title} className="truncate text-[13px] text-foreground" />
					{isSubtask ? (
						<Badge
							variant="outline"
							className="h-4 px-1.5 font-mono text-[10px] uppercase tracking-[0.08em]"
						>
							sub
						</Badge>
					) : null}
				</div>

				{hasDesktopMeta ? (
					<div className="mt-1 flex flex-wrap items-center gap-2 md:hidden">
						{display.showType ? <TaskTypeBadge type={task.type} /> : null}
						{display.showAssignee ? (
							<span className="font-mono text-[11px] text-muted-foreground">
								{task.assigned_to ?? 'unassigned'}
							</span>
						) : null}
						{display.showUpdated ? (
							<span className="font-mono text-[11px] text-muted-foreground tabular-nums">
								{formatRelativeTime(task.updated_at)}
							</span>
						) : null}
					</div>
				) : null}
			</div>

			{hasDesktopMeta ? (
				<div className="hidden shrink-0 items-center gap-3 md:flex">
					{display.showType ? <TaskTypeBadge type={task.type} /> : null}
					{display.showAssignee ? (
						<span className="w-24 truncate text-right font-mono text-[11px] text-muted-foreground">
							{task.assigned_to ?? '—'}
						</span>
					) : null}
					{display.showUpdated ? (
						<span className="w-10 text-right font-mono text-[11px] text-muted-foreground tabular-nums">
							{formatRelativeTime(task.updated_at)}
						</span>
					) : null}
				</div>
			) : null}
		</button>
	)
}

export function TaskList({
	allTasks,
	tasks,
	childToParent,
	filter,
	onFilterChange,
	onSelect,
	isLoading,
}: TaskListProps) {
	const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
	const [groupBy, setGroupBy] = useState<GroupBy>('status')
	const [display, setDisplay] = useState<DisplayOptions>({
		showSubtasks: true,
		showId: true,
		showType: true,
		showAssignee: true,
		showUpdated: true,
	})

	const allVisibleTasks = useMemo(() => {
		if (display.showSubtasks) return allTasks
		return allTasks.filter((task) => !childToParent.has(task.id))
	}, [allTasks, childToParent, display.showSubtasks])

	const visibleTasks = useMemo(() => {
		if (display.showSubtasks) return tasks
		return tasks.filter((task) => !childToParent.has(task.id))
	}, [tasks, childToParent, display.showSubtasks])

	const taskCounts = useMemo<Record<TaskFilter, number>>(() => {
		const counts: Record<TaskFilter, number> = {
			all: allVisibleTasks.length,
			active: 0,
			blocked: 0,
			backlog: 0,
			done: 0,
			failed: 0,
		}

		for (const task of allVisibleTasks) {
			switch (task.status) {
				case 'active':
					counts.active += 1
					break
				case 'blocked':
					counts.blocked += 1
					break
				case 'backlog':
					counts.backlog += 1
					break
				case 'done':
					counts.done += 1
					break
				case 'failed':
					counts.failed += 1
					break
			}
		}

		return counts
	}, [allVisibleTasks])

	const groups = useMemo(() => {
		if (groupBy === 'none') {
			return [{ key: '__all__', label: 'All tasks', tasks: visibleTasks }]
		}

		const grouped = new Map<string, Task[]>()
		for (const task of visibleTasks) {
			const key = getGroupKey(task, groupBy)
			const group = grouped.get(key) ?? []
			group.push(task)
			grouped.set(key, group)
		}

		return sortGroupKeys(groupBy, [...grouped.keys()]).map((key) => ({
			key,
			label: getGroupLabel(groupBy, key),
			tasks: grouped.get(key) ?? [],
		}))
	}, [groupBy, visibleTasks])

	function toggleGroup(key: string) {
		setCollapsedGroups((prev) => {
			const next = new Set(prev)
			if (next.has(key)) next.delete(key)
			else next.add(key)
			return next
		})
	}

	function toggleDisplay(key: keyof DisplayOptions) {
		setDisplay((prev) => ({ ...prev, [key]: !prev[key] }))
	}

	const headerActions: InspectorHeaderAction[] = [
		{
			type: 'custom',
			id: 'display-options',
			render: (
				<DropdownMenu>
					<DropdownMenuTrigger
						render={<Button size="icon-xs" variant="ghost" title="Task list options" />}
					>
						<Faders size={14} />
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-56 min-w-56">
						<DropdownMenuLabel>Group by</DropdownMenuLabel>
						<DropdownMenuRadioGroup
							value={groupBy}
							onValueChange={(value) => {
								setGroupBy(value as GroupBy)
								setCollapsedGroups(new Set())
							}}
						>
							<DropdownMenuRadioItem value="status">Status</DropdownMenuRadioItem>
							<DropdownMenuRadioItem value="priority">Priority</DropdownMenuRadioItem>
							<DropdownMenuRadioItem value="type">Type</DropdownMenuRadioItem>
							<DropdownMenuRadioItem value="assignee">Assignee</DropdownMenuRadioItem>
							<DropdownMenuRadioItem value="none">No grouping</DropdownMenuRadioItem>
						</DropdownMenuRadioGroup>
						<DropdownMenuSeparator />
						<DropdownMenuLabel>Display</DropdownMenuLabel>
						<DropdownMenuCheckboxItem
							checked={display.showSubtasks}
							onCheckedChange={() => toggleDisplay('showSubtasks')}
						>
							Show subtasks
						</DropdownMenuCheckboxItem>
						<DropdownMenuCheckboxItem
							checked={display.showId}
							onCheckedChange={() => toggleDisplay('showId')}
						>
							Show ID
						</DropdownMenuCheckboxItem>
						<DropdownMenuCheckboxItem
							checked={display.showType}
							onCheckedChange={() => toggleDisplay('showType')}
						>
							Show type
						</DropdownMenuCheckboxItem>
						<DropdownMenuCheckboxItem
							checked={display.showAssignee}
							onCheckedChange={() => toggleDisplay('showAssignee')}
						>
							Show assignee
						</DropdownMenuCheckboxItem>
						<DropdownMenuCheckboxItem
							checked={display.showUpdated}
							onCheckedChange={() => toggleDisplay('showUpdated')}
						>
							Show updated
						</DropdownMenuCheckboxItem>
					</DropdownMenuContent>
				</DropdownMenu>
			),
		},
	]

	if (isLoading) {
		headerActions.push({
			type: 'custom',
			id: 'loading',
			render: <Spinner className="text-muted-foreground" />,
		})
	}

	const header = <InspectorHeader title="Tasks" actions={headerActions} />

	const content = (
		<ScrollArea className="h-full">
			<div className="min-h-full px-5 py-3.5">
				<div className="mb-4 overflow-x-auto">
					<Tabs value={filter} onValueChange={(value) => onFilterChange(value as TaskFilter)}>
						<TabsList>
							{FILTER_TABS.map((tab) => (
								<TabsTrigger key={tab} value={tab}>
									{FILTER_LABELS[tab]}
									{taskCounts[tab] > 0 ? (
										<Badge
											variant={filter === tab ? 'secondary' : 'outline'}
											className="font-mono tabular-nums"
										>
											{taskCounts[tab]}
										</Badge>
									) : null}
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
				</div>

				{isLoading && visibleTasks.length === 0 ? (
					<div className="flex h-[min(40vh,320px)] items-center justify-center">
						<Spinner size="lg" className="text-muted-foreground" />
					</div>
				) : !isLoading && visibleTasks.length === 0 ? (
					<EmptyState title="No tasks" description="No tasks match this filter." height="h-48" />
				) : (
					<div className="space-y-5 pr-2">
						{groups.map((group) => {
							const isCollapsed = collapsedGroups.has(group.key)

							return (
								<section key={group.key} className="space-y-1.5">
									{groupBy !== 'none' ? (
										<button
											type="button"
											onClick={() => toggleGroup(group.key)}
											aria-expanded={!isCollapsed}
											className="sticky top-0 z-10 flex w-full items-center gap-2 border-b border-border/50 bg-background px-3 py-2 text-left"
										>
											<CaretRight
												size={10}
												weight="bold"
												className={cn(
													'shrink-0 text-muted-foreground transition-transform duration-150',
													!isCollapsed && 'rotate-90',
												)}
											/>
											{groupBy === 'status' ? <StatusIcon status={group.key} /> : null}
											<span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
												{group.label}
											</span>
											<span className="font-mono text-[11px] text-muted-foreground tabular-nums">
												{group.tasks.length}
											</span>
										</button>
									) : null}

									{!isCollapsed ? (
										<div className="space-y-1">
											{group.tasks.map((task) => (
												<TaskRow
													key={task.id}
													task={task}
													isSubtask={childToParent.has(task.id)}
													display={display}
													onSelect={onSelect}
												/>
											))}
										</div>
									) : null}
								</section>
							)
						})}
					</div>
				)}
			</div>
		</ScrollArea>
	)

	return (
		<InspectorLayout header={header} content={content} contentClassName="min-h-0 overflow-hidden" />
	)
}
