import { useMemo, useState } from 'react'
import { CaretRight, ChatCircle, Timer, Lightning, ListChecksIcon } from '@phosphor-icons/react'
import { FilterTabs } from '@/components/ui/filter-tabs'
import { Button } from '@/components/ui/button'
import { InspectorLayout } from '@/components/ui/inspector-layout'
import { KvList } from '@/components/ui/kv-list'
import { SectionHeader } from '@/components/ui/section-header'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import { SmartText } from '@/lib/smart-links'
import { setDraggedChatAttachment } from '@/features/chat/lib/chat-dnd'
import type { Task } from '@/api/types'
import type { TaskFilter } from '../hooks/use-tasks-screen'
import { Badge } from '@/components/ui/badge'

const FILTER_TABS = [
	'all',
	'active',
	'backlog',
	'done',
	'failed',
] as const satisfies readonly TaskFilter[]

const FILTER_LABELS: Record<TaskFilter, string> = {
	all: 'All',
	active: 'Active',
	backlog: 'Backlog',
	done: 'Done',
	failed: 'Failed',
}

type GroupBy = 'status' | 'priority' | 'type' | 'none'

const GROUP_ORDER: Record<GroupBy, string[]> = {
	status: ['active', 'blocked', 'backlog', 'done', 'failed'],
	priority: ['high', 'medium', 'low', 'none'],
	type: ['query', 'scheduled', 'task'],
	none: [],
}

const GROUP_LABELS: Record<string, string> = {
	active: 'Active',
	blocked: 'Blocked',
	backlog: 'Backlog',
	done: 'Done',
	failed: 'Failed',
	high: 'High',
	medium: 'Medium',
	low: 'Low',
	none: 'No priority',
	query: 'Query',
	scheduled: 'Scheduled',
	task: 'Task',
}

interface DisplayProps {
	showSubTasks: boolean
	nestSubIssues: boolean
	id: boolean
	type: boolean
	assignee: boolean
	updated: boolean
}

interface TaskListProps {
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
		default: // backlog
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
	{ icon: typeof ChatCircle; label: string; className: string }
> = {
	query: {
		icon: ChatCircle,
		label: 'query',
		className: 'bg-info-surface text-info',
	},
	scheduled: {
		icon: Timer,
		label: 'scheduled',
		className: 'bg-warning-surface text-warning',
	},
	task: {
		icon: Lightning,
		label: 'task',
		className: 'bg-primary-surface text-primary',
	},
}

function TaskTypeBadge({ type }: { type: string }) {
	const config = TASK_TYPE_CONFIG[type]
	if (!config) {
		return <Badge variant="secondary">{type}</Badge>
	}
	const Icon = config.icon
	return (
		<Badge className={cn('', config.className)}>
			<Icon size={10} weight="bold" />
			{config.label}
		</Badge>
	)
}

/** Linear-style stacked-bar priority icons. 3 bars, filled count = urgency. */
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

function TaskRow({
	task,
	depth,
	display,
	onSelect,
}: { task: Task; depth: number; display: DisplayProps; onSelect: (id: string) => void }) {
	return (
		<button
			type="button"
			onClick={() => onSelect(task.id)}
			draggable
			onDragStart={(e) => {
				setDraggedChatAttachment(e.dataTransfer, {
					type: 'ref',
					source: 'drag',
					label: `Task ${shortId(task.id)} ${task.title}`,
					refType: 'task',
					refId: task.id,
					metadata: { view: 'tasks', taskId: task.id },
				})
			}}
			className="group rounded-sm  flex w-full items-center gap-3 px-4 py-3 text-left transition-[background-color,color] hover:bg-muted/70"
		>
			{depth > 0 && <div style={{ width: depth * 16 }} />}
			<PriorityIcon priority={task.priority} />
			<div className="flex min-w-0 flex-1 items-center gap-2">
				{display.id && (
					<span className="font-mono text-[11px] text-muted-foreground shrink-0">
						{shortId(task.id)}
					</span>
				)}
				<SmartText text={task.title} className="truncate text-sm font-medium text-foreground" />
			</div>
			{display.type && <TaskTypeBadge type={task.type} />}
			{display.assignee && (
				<span className="w-24 truncate text-right text-xs text-muted-foreground">
					{task.assigned_to ?? '—'}
				</span>
			)}
			{display.updated && (
				<span className="w-12 text-right text-xs text-muted-foreground tabular-nums">
					{formatRelativeTime(task.updated_at)}
				</span>
			)}
		</button>
	)
}

export function TaskList({
	tasks,
	childToParent,
	filter,
	onFilterChange,
	onSelect,
	isLoading,
}: TaskListProps) {
	const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
	const [groupBy, setGroupBy] = useState<GroupBy>('status')
	const [display, setDisplay] = useState<DisplayProps>({
		showSubTasks: true,
		nestSubIssues: false,
		id: true,
		type: true,
		assignee: true,
		updated: true,
	})

	const filterCounts = useMemo(
		() => ({
			all: tasks.length,
			active: tasks.filter((task) => task.status === 'active' || task.status === 'blocked').length,
			backlog: tasks.filter((task) => task.status === 'backlog').length,
			done: tasks.filter((task) => task.status === 'done').length,
			failed: tasks.filter((task) => task.status === 'failed').length,
		}),
		[tasks],
	)

	function toggleDisplay(key: keyof DisplayProps) {
		setDisplay((prev) => ({ ...prev, [key]: !prev[key] }))
	}

	// Filter out sub-tasks when showSubTasks is off
	const visibleTasks = useMemo(() => {
		if (display.showSubTasks) return tasks
		return tasks.filter((t) => !childToParent.has(t.id))
	}, [tasks, childToParent, display.showSubTasks])

	// Build parent→children map for nesting
	const parentToChildren = useMemo(() => {
		if (!display.nestSubIssues || !display.showSubTasks) return new Map<string, string[]>()
		const map = new Map<string, string[]>()
		for (const [childId, parentId] of childToParent) {
			const list = map.get(parentId) ?? []
			list.push(childId)
			map.set(parentId, list)
		}
		return map
	}, [childToParent, display.nestSubIssues, display.showSubTasks])

	const groups = useMemo(() => {
		// When nesting, only include root-level tasks in groups — children render inline
		const groupTasks =
			display.nestSubIssues && display.showSubTasks
				? visibleTasks.filter((t) => !childToParent.has(t.id))
				: visibleTasks
		if (groupBy === 'none') {
			return [{ key: '__all__', label: 'All tasks', tasks: groupTasks }]
		}
		const byKey = new Map<string, Task[]>()
		for (const task of groupTasks) {
			const key = task[groupBy]
			const list = byKey.get(key) ?? []
			list.push(task)
			byKey.set(key, list)
		}
		return GROUP_ORDER[groupBy]
			.filter((k) => byKey.has(k))
			.map((k) => ({ key: k, label: GROUP_LABELS[k] ?? k, tasks: byKey.get(k)! }))
	}, [visibleTasks, groupBy, childToParent, display.nestSubIssues, display.showSubTasks])

	// Lookup for rendering nested children
	const taskById = useMemo(() => {
		const map = new Map<string, Task>()
		for (const t of tasks) map.set(t.id, t)
		return map
	}, [tasks])

	const sidebar = (
		<div className="space-y-5">
			<div className="space-y-2">
				<SectionHeader>Overview</SectionHeader>
				<KvList
					items={[
						{
							label: 'Visible',
							value: (
								<span className="text-sm text-muted-foreground tabular-nums">
									{visibleTasks.length}
								</span>
							),
						},
						{
							label: 'Grouped',
							value: <span className="text-sm text-muted-foreground">{groupBy}</span>,
						},
						{
							label: 'Sub-tasks',
							value: (
								<span className="text-sm text-muted-foreground">
									{display.showSubTasks ? 'shown' : 'hidden'}
								</span>
							),
						},
					]}
				/>
			</div>

			<div className="space-y-2">
				<SectionHeader>Group by</SectionHeader>
				<div className="flex flex-wrap gap-1.5">
					{(['status', 'priority', 'type', 'none'] as const).map((option) => (
						<Button
							key={option}
							size="xs"
							variant={groupBy === option ? 'default' : 'ghost'}
							onClick={() => {
								setGroupBy(option)
								setCollapsedGroups(new Set())
							}}
						>
							{option === 'none' ? 'No grouping' : (GROUP_LABELS[option] ?? option)}
						</Button>
					))}
				</div>
			</div>

			<div className="space-y-2">
				<SectionHeader>Fields</SectionHeader>
				<div className="flex flex-wrap gap-1.5">
					<Button
						size="xs"
						variant={display.showSubTasks ? 'default' : 'ghost'}
						onClick={() => toggleDisplay('showSubTasks')}
					>
						Sub-tasks
					</Button>
					<Button
						size="xs"
						variant={display.nestSubIssues ? 'default' : 'ghost'}
						onClick={() => toggleDisplay('nestSubIssues')}
						disabled={!display.showSubTasks}
					>
						Nested
					</Button>
					<Button
						size="xs"
						variant={display.id ? 'default' : 'ghost'}
						onClick={() => toggleDisplay('id')}
					>
						ID
					</Button>
					<Button
						size="xs"
						variant={display.type ? 'default' : 'ghost'}
						onClick={() => toggleDisplay('type')}
					>
						Type
					</Button>
					<Button
						size="xs"
						variant={display.assignee ? 'default' : 'ghost'}
						onClick={() => toggleDisplay('assignee')}
					>
						Assignee
					</Button>
					<Button
						size="xs"
						variant={display.updated ? 'default' : 'ghost'}
						onClick={() => toggleDisplay('updated')}
					>
						Updated
					</Button>
				</div>
			</div>
		</div>
	)

	const content = (
		<div className="flex h-full flex-col overflow-hidden flex-1">
			<div className="flex-1 overflow-y-auto flex-col">
				{!isLoading && tasks.length === 0 && (
					<EmptyState
						title="No tasks"
						description="No tasks match this filter."
						height="h-48"
						icon={ListChecksIcon}
						className="m-4"
					/>
				)}
				{groups.map((group) => {
					const isCollapsed = collapsedGroups.has(group.key)
					return (
						<div key={group.key}>
							{groupBy !== 'none' && (
								<button
									type="button"
									onClick={() => toggleGroup(group.key)}
									className="sticky top-0 z-10 flex w-full items-center gap-2 bg-background/95 px-4 py-2 backdrop-blur-sm"
								>
									<CaretRight
										size={10}
										weight="bold"
										className={cn(
											'shrink-0 text-muted-foreground transition-transform duration-150',
											!isCollapsed && 'rotate-90',
										)}
									/>
									{groupBy === 'status' && <StatusIcon status={group.key} />}
									<span className="text-xs font-medium text-muted-foreground">{group.label}</span>
									<span className="text-[11px] tabular-nums text-muted-foreground">
										{group.tasks.length}
									</span>
								</button>
							)}
							{!isCollapsed &&
								group.tasks.map((task) => {
									const children = parentToChildren.get(task.id)
									return (
										<div key={task.id}>
											<TaskRow
												task={task}
												depth={groupBy !== 'none' ? 1 : 0}
												display={display}
												onSelect={onSelect}
											/>
											{children?.map((childId) => {
												const child = taskById.get(childId)
												if (!child) return null
												return (
													<TaskRow
														key={childId}
														task={child}
														depth={groupBy !== 'none' ? 2 : 1}
														display={display}
														onSelect={onSelect}
													/>
												)
											})}
										</div>
									)
								})}
						</div>
					)
				})}
			</div>
		</div>
	)

	function toggleGroup(key: string) {
		setCollapsedGroups((prev) => {
			const next = new Set(prev)
			if (next.has(key)) next.delete(key)
			else next.add(key)
			return next
		})
	}

	return (
		<InspectorLayout
			header={
				<div className="space-y-3">
					<h1 className="text-xl font-semibold text-foreground">Tasks</h1>
					<FilterTabs
						tabs={FILTER_TABS}
						active={filter}
						getLabel={(tab) => FILTER_LABELS[tab]}
						getCount={(tab) => filterCounts[tab]}
						onChange={onFilterChange}
					/>
				</div>
			}
			toolbar={isLoading ? <Spinner className="text-muted-foreground" /> : undefined}
			content={content}
			sidebar={sidebar}
			sidebarClassName="rounded-xl bg-card/60 px-4 py-4 shadow-xs ring-1 ring-border/40"
		/>
	)
}
