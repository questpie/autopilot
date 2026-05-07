import type { Task } from '@/api/types'
import { SquareBuildLogo } from '@/components/brand'
import { Button } from '@/components/ui/button'
import { RailSection } from '@/components/ui/rail-section'
import {
	Sidebar as ShadcnSidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	SidebarTrigger,
	useSidebar,
} from '@/components/ui/sidebar'
import {
	type SavedKnowledgeLocation,
	locationKey,
} from '@/features/knowledge/lib/knowledge-locations'
import { NewTaskModal } from '@/features/tasks/components/new-task-modal'
import { useActiveView } from '@/hooks/use-active-view'
import { useAppPreferences } from '@/hooks/use-app-preferences'
import { useKnowledgePreferences } from '@/hooks/use-knowledge-preferences'
import { useSession } from '@/hooks/use-session'
import { useTasks } from '@/hooks/use-tasks'
import { authClient } from '@/lib/auth'
import { fileIcon } from '@/lib/file-icons'
import { cn } from '@/lib/utils'
import {
	ClockCounterClockwise,
	Folder,
	Gear,
	HardDrives,
	MagnifyingGlassIcon,
	Moon,
	PlusIcon,
	PushPin,
	SignOut,
	Sun,
} from '@phosphor-icons/react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

const MAX_QUICK_TASKS = 5

function TaskStatusDot({ status }: { status: string }) {
	const color =
		status === 'blocked'
			? 'bg-warning'
			: status === 'active'
				? 'bg-success'
				: status === 'failed'
					? 'bg-destructive'
					: 'bg-muted-foreground/50'

	return <span className={cn('size-1.5 shrink-0 rounded-full', color)} />
}

function formatRelativeTime(iso: string): string {
	const diff = Date.now() - new Date(iso).getTime()
	const mins = Math.floor(diff / 60_000)
	if (mins < 1) return 'now'
	if (mins < 60) return `${mins}m`
	const hrs = Math.floor(mins / 60)
	if (hrs < 24) return `${hrs}h`
	const days = Math.floor(hrs / 24)
	return `${days}d`
}

function taskMetaLabel(status: string) {
	if (status === 'blocked') return 'Blocked'
	if (status === 'active') return 'Active'
	if (status === 'failed') return 'Failed'
	if (status === 'done') return 'Done'
	return 'Backlog'
}

function rankTask(task: Task): number {
	if (task.status === 'blocked') return 0
	if (task.status === 'active') return 1
	if (task.status === 'backlog') return 2
	if (task.status === 'failed') return 3
	return 4
}

function sortQuickTasks(tasks: Task[]) {
	return [...tasks].sort((a, b) => {
		const rankDiff = rankTask(a) - rankTask(b)
		if (rankDiff !== 0) return rankDiff
		return b.updated_at.localeCompare(a.updated_at)
	})
}

function TasksSection({ onCreate }: { onCreate: () => void }) {
	const tasksQuery = useTasks()
	const view = useActiveView()
	const search = useSearch({ strict: false }) as { taskId?: string; filter?: string }
	const quickTasks = useMemo(() => sortQuickTasks(tasksQuery.data ?? []), [tasksQuery.data])
	const visibleQuickTasks = quickTasks.slice(0, MAX_QUICK_TASKS)

	return (
		<RailSection
			title="Tasks"
			tone="sidebar"
			action={
				<Button size="icon-xs" variant="ghost" onClick={onCreate} title="Create task">
					<PlusIcon />
				</Button>
			}
		>
			<SidebarGroupContent>
				<SidebarMenu>
					{visibleQuickTasks.map((task) => (
						<SidebarMenuItem key={task.id}>
							<SidebarMenuButton
								render={<Link to="/tasks" search={{ taskId: task.id }} />}
								isActive={view === 'tasks' && search.taskId === task.id}
								size="sm"
								className="h-auto items-stretch gap-3 py-1 px-2"
							>
								<div className="flex items-center justify-center">
									<TaskStatusDot status={task.status} />
								</div>
								<div className="min-w-0 flex-1">
									<p className="truncate text-xs font-medium text-sidebar-foreground">
										{task.title}
									</p>
									<div className="mt-0.5 flex items-center gap-2 text-[11px] text-sidebar-foreground/45">
										<span>{taskMetaLabel(task.status)}</span>
										{task.assigned_to ? <span>{task.assigned_to}</span> : null}
										<span className="tabular-nums">{formatRelativeTime(task.updated_at)}</span>
									</div>
								</div>
							</SidebarMenuButton>
						</SidebarMenuItem>
					))}
				</SidebarMenu>
				{quickTasks.length === 0 && !tasksQuery.isLoading && (
					<p className="px-2 py-2 text-[13px] text-muted-foreground">No tasks yet.</p>
				)}
				{quickTasks.length > 0 && (
					<SidebarMenu className="pt-2">
						<SidebarMenuItem>
							<SidebarMenuButton
								render={<Link to="/tasks" search={{}} />}
								isActive={view === 'tasks' && !search.taskId && !search.filter}
								size="sm"
								className="justify-between text-sidebar-foreground/60"
							>
								<span className="text-[12px]">View all tasks</span>
								<span className="text-[11px] tabular-nums">{quickTasks.length}</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				)}
			</SidebarGroupContent>
		</RailSection>
	)
}

const KNOWLEDGE_LINKS = [{ label: 'Knowledge root', path: null }] as const

function buildKnowledgeSearch(location: Pick<SavedKnowledgeLocation, 'path' | 'runId' | 'type'>) {
	if (location.type === 'file') {
		return {
			runId: location.runId ?? undefined,
			path: location.path ?? undefined,
			view: 'resource' as const,
			selected: undefined,
		}
	}

	return {
		runId: location.runId ?? undefined,
		path: location.path ?? undefined,
		view: undefined,
		selected: undefined,
	}
}

function getActiveKnowledgeKeys(search: {
	path?: string
	runId?: string
	view?: 'resource'
	selected?: string
}) {
	const keys = new Set<string>()
	const runId = search.runId ?? null

	if (search.view === 'resource') {
		keys.add(locationKey({ path: search.path ?? null, runId, type: 'file' }))
	} else {
		keys.add(locationKey({ path: search.path ?? null, runId, type: 'directory' }))
	}

	if (search.selected) {
		keys.add(locationKey({ path: search.selected, runId, type: 'file' }))
		keys.add(locationKey({ path: search.selected, runId, type: 'directory' }))
	}

	return keys
}

function KnowledgeLocationItem({
	location,
	active,
	icon,
	meta,
}: {
	location: SavedKnowledgeLocation
	active: boolean
	icon?: typeof Folder
	meta?: React.ReactNode
}) {
	const Icon =
		icon ??
		(location.type === 'directory' ? Folder : fileIcon(location.path ?? location.label, 'file'))

	return (
		<SidebarMenuItem>
			<SidebarMenuButton
				render={<Link to="/knowledge" search={buildKnowledgeSearch(location)} />}
				isActive={active}
				size="sm"
			>
				<Icon size={16} className="shrink-0" />
				<span className="min-w-0 flex-1 truncate text-[13px]">{location.label}</span>
				{meta}
			</SidebarMenuButton>
		</SidebarMenuItem>
	)
}

function KnowledgeSection() {
	const view = useActiveView()
	const search = useSearch({ strict: false }) as {
		path?: string
		runId?: string
		view?: 'resource'
		selected?: string
	}
	const { pinned, recent } = useKnowledgePreferences()
	const activeKeys = useMemo(() => getActiveKnowledgeKeys(search), [search])
	const showDynamic = view === 'knowledge'
	const pinnedKeys = useMemo(
		() => new Set(pinned.map((location) => locationKey(location))),
		[pinned],
	)
	const recentItems = useMemo(
		() => recent.filter((location) => !pinnedKeys.has(locationKey(location))).slice(0, 4),
		[recent, pinnedKeys],
	)
	const currentRunLocation = search.runId
		? {
				path: null,
				runId: search.runId,
				type: 'directory' as const,
				label: 'Project run',
				viewedAt: new Date().toISOString(),
			}
		: null

	return (
		<RailSection title="Knowledge" tone="sidebar">
			<SidebarGroupContent>
				<SidebarMenu>
					{KNOWLEDGE_LINKS.map((item) => {
						const location = {
							path: item.path,
							runId: null,
							type: 'directory' as const,
							label: item.label,
							viewedAt: new Date().toISOString(),
						}
						return (
							<KnowledgeLocationItem
								key={item.label}
								location={location}
								active={view === 'knowledge' && activeKeys.has(locationKey(location))}
							/>
						)
					})}

					{showDynamic && currentRunLocation && (
						<>
							<div className="px-2 pt-3 pb-1 text-[11px] font-medium text-sidebar-foreground/45">
								Current
							</div>
							<KnowledgeLocationItem
								location={currentRunLocation}
								active={activeKeys.has(locationKey(currentRunLocation))}
								icon={HardDrives}
							/>
						</>
					)}

					{showDynamic && pinned.length > 0 && (
						<>
							<div className="px-2 pt-3 pb-1 text-[11px] font-medium text-sidebar-foreground/45">
								Pinned
							</div>
							{pinned.slice(0, 4).map((location) => (
								<KnowledgeLocationItem
									key={locationKey(location)}
									location={location}
									active={activeKeys.has(locationKey(location))}
									icon={PushPin}
								/>
							))}
						</>
					)}

					{showDynamic && recentItems.length > 0 && (
						<>
							<div className="px-2 pt-3 pb-1 text-[11px] font-medium text-sidebar-foreground/45">
								Recent
							</div>
							{recentItems.map((location) => (
								<KnowledgeLocationItem
									key={locationKey(location)}
									location={location}
									active={activeKeys.has(locationKey(location))}
									icon={ClockCounterClockwise}
									meta={
										<span className="ml-auto text-[11px] text-sidebar-foreground/40 tabular-nums">
											{formatRelativeTime(location.viewedAt)}
										</span>
									}
								/>
							))}
						</>
					)}
				</SidebarMenu>
			</SidebarGroupContent>
		</RailSection>
	)
}

function AdminSection() {
	const navigate = useNavigate()
	const { user } = useSession()
	const canManageMachines = user?.role === 'owner' || user?.role === 'admin'

	if (!canManageMachines) return null

	return (
		<RailSection title="Admin" tone="sidebar">
			<SidebarGroupContent>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							size="sm"
							onClick={() => void navigate({ to: '/settings', search: { tab: 'machines' } })}
						>
							<HardDrives size={16} className="shrink-0" />
							<span className="text-[13px]">Machines</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
					<SidebarMenuItem>
						<SidebarMenuButton size="sm" onClick={() => void navigate({ to: '/settings' })}>
							<Gear size={16} className="shrink-0" />
							<span className="text-[13px]">Settings</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarGroupContent>
		</RailSection>
	)
}

function SidebarUserFooter() {
	const { user } = useSession()
	const { theme, setTheme } = useAppPreferences()
	const navigate = useNavigate()

	const displayName = user?.name || user?.email || 'User'

	const cycleTheme = () => {
		const next = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark'
		setTheme(next)
	}

	return (
		<SidebarFooter>
			<div className="rounded-[18px] bg-sidebar-accent/28 p-1.5 ring-1 ring-sidebar-border/45">
				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={() => void navigate({ to: '/settings' })}
						className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left transition-[background-color,color,transform] hover:bg-sidebar-accent active:scale-[0.99]"
					>
						<span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium text-foreground shadow-xs">
							{displayName[0]?.toUpperCase() ?? '?'}
						</span>
						<span className="min-w-0 flex-1 truncate text-sm text-sidebar-foreground">
							{displayName}
						</span>
					</button>
					<button
						type="button"
						onClick={cycleTheme}
						className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-[background-color,color,transform] hover:bg-sidebar-accent hover:text-foreground active:scale-[0.96]"
						title={`Theme: ${theme}`}
					>
						{theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
					</button>
					<button
						type="button"
						onClick={() => void authClient.signOut().then(() => navigate({ to: '/login' }))}
						className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-[background-color,color,transform] hover:bg-sidebar-accent hover:text-foreground active:scale-[0.96]"
						title="Sign out"
					>
						<SignOut size={14} />
					</button>
				</div>
			</div>
		</SidebarFooter>
	)
}

interface SidebarProps {
	onSearchOpen?: () => void
}

export function Sidebar({ onSearchOpen }: SidebarProps) {
	const [newTaskOpen, setNewTaskOpen] = useState(false)
	const sidebarProps = useSidebar()

	return (
		<>
			<ShadcnSidebar
				variant="inset"
				collapsible="offcanvas"
				className="border-none h-dvh bg-sidebar"
			>
				<SidebarHeader className="flex flex-row items-center gap-2 px-3 pt-3 pb-1">
					<Link to="/" className="flex items-center gap-2 text-foreground">
						<SquareBuildLogo size={18} />
						<span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
							Autopilot
						</span>
					</Link>
					<div className="flex-1" />
					{onSearchOpen && (
						<Button size="icon-xs" variant="ghost" onClick={onSearchOpen} title="Search">
							<MagnifyingGlassIcon />
						</Button>
					)}
					{sidebarProps.state === 'expanded' && <SidebarTrigger />}
				</SidebarHeader>

				<SidebarContent className="gap-3 px-2 py-3">
					<TasksSection onCreate={() => setNewTaskOpen(true)} />
					<KnowledgeSection />
					<AdminSection />
				</SidebarContent>

				<SidebarUserFooter />
				<SidebarRail />
			</ShadcnSidebar>

			<NewTaskModal open={newTaskOpen} onOpenChange={setNewTaskOpen} />
		</>
	)
}
