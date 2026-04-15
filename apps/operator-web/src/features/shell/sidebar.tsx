import { useState, useMemo } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import {
	CalendarBlank,
	CaretDown,
	CaretRight,
	CheckSquare,
	ClockCounterClockwise,
	Folder,
	MagnifyingGlass,
	Moon,
	Plus,
	SignOut,
	Spinner,
	Sun,
} from '@phosphor-icons/react'
import { SquareBuildLogo } from '@/components/brand'
import { useChatSessions } from '@/hooks/use-chat-sessions'
import { useQueryList } from '@/hooks/use-queries'
import { useTasks } from '@/hooks/use-tasks'
import { useRuns } from '@/hooks/use-runs'
import { useSession } from '@/hooks/use-session'
import { useActiveView } from '@/hooks/use-active-view'
import { useAppStore } from '@/stores/app.store'
import { composeConversations } from '@/api/conversations.api'
import { authClient } from '@/lib/auth'
import type { Task, Run } from '@/api/types'
import {
	Sidebar as ShadcnSidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	SidebarRail,
	SidebarTrigger,
} from '@/components/ui/sidebar'

// ── Nav items ───────────────────────────────────────────────

const NAV_ITEMS = [
	{ id: 'tasks', to: '/tasks', label: 'Tasks', icon: CheckSquare },
	{ id: 'schedules', to: '/tasks', search: { filter: 'scheduled' }, label: 'Schedules', icon: CalendarBlank },
	{ id: 'files', to: '/files', label: 'Company', icon: Folder },
] as const

// ── Collapsible task with runs ──────────────────────────────

function TaskItem({ task, runs }: { task: Task; runs: Run[] }) {
	const [open, setOpen] = useState(task.status === 'active' || task.status === 'blocked')
	const search = useSearch({ strict: false }) as { taskId?: string }
	const isActive = search.taskId === task.id
	const taskRuns = runs.filter((r) => r.task_id === task.id)

	return (
		<SidebarMenuItem>
			<SidebarMenuButton
				render={<Link to="/tasks" search={{ taskId: task.id }} />}
				isActive={isActive}
				size="sm"
			>
				{taskRuns.length > 0 ? (
					<button
						className="flex shrink-0 items-center justify-center text-muted-foreground"
						onClick={(e) => {
							e.preventDefault()
							e.stopPropagation()
							setOpen((v) => !v)
						}}
					>
						{open ? <CaretDown size={12} /> : <CaretRight size={12} />}
					</button>
				) : (
					<span className="w-3 shrink-0" />
				)}
				<span className="min-w-0 flex-1 truncate text-[13px]">{task.title}</span>
				<TaskStatusDot status={task.status} />
			</SidebarMenuButton>
			{open && taskRuns.length > 0 && (
				<SidebarMenuSub>
					{taskRuns.map((run) => (
						<SidebarMenuSubItem key={run.id}>
							<SidebarMenuSubButton
								render={<Link to="/tasks" search={{ taskId: task.id }} />}
								size="sm"
							>
								<RunStatusIcon status={run.status} />
								<span className="min-w-0 flex-1 truncate text-xs">
									{run.summary?.slice(0, 40) || run.agent_id}
								</span>
							</SidebarMenuSubButton>
						</SidebarMenuSubItem>
					))}
				</SidebarMenuSub>
			)}
		</SidebarMenuItem>
	)
}

function TaskStatusDot({ status }: { status: string }) {
	const color =
		status === 'active'
			? 'bg-success'
			: status === 'blocked'
				? 'bg-warning'
				: status === 'failed'
					? 'bg-destructive'
					: status === 'done'
						? 'bg-muted-foreground'
						: 'bg-muted-foreground/50'
	return <span className={`size-1.5 shrink-0 rounded-full ${color}`} />
}

function RunStatusIcon({ status }: { status: string }) {
	if (status === 'running' || status === 'claimed') {
		return <Spinner size={12} className="shrink-0 animate-spin text-muted-foreground" />
	}
	const color =
		status === 'completed'
			? 'bg-success'
			: status === 'failed'
				? 'bg-destructive'
				: 'bg-muted-foreground/50'
	return <span className={`size-1.5 shrink-0 rounded-full ${color}`} />
}

// ── Company section ─────────────────────────────────────────

function CompanySection() {
	const sessionsQuery = useChatSessions()
	const queriesQuery = useQueryList()
	const tasksQuery = useTasks()
	const runsQuery = useRuns()

	const conversations = useMemo(() => {
		const sessions = sessionsQuery.data ?? []
		const queries = queriesQuery.data ?? []
		const tasks = tasksQuery.data ?? []
		return composeConversations(sessions, queries, tasks)
	}, [sessionsQuery.data, queriesQuery.data, tasksQuery.data])

	const activeTasks = useMemo(() => {
		return (tasksQuery.data ?? []).filter(
			(t) => t.status === 'active' || t.status === 'blocked',
		)
	}, [tasksQuery.data])

	const runs = runsQuery.data ?? []

	const search = useSearch({ strict: false }) as { sessionId?: string }
	const activeSessionId = search.sessionId ?? null
	const navigate = useNavigate()

	const chats = conversations.filter((c) => c.displayType === 'query')
	const recentChats = chats.slice(0, 5)
	const hasMore = chats.length > 5

	return (
		<>
			{/* Recent chats */}
			<SidebarGroup>
				<SidebarGroupLabel>
					<span className="flex-1">Recent</span>
					<button
						onClick={() => void navigate({ to: '/chat' })}
						className="flex size-5 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
						title="New chat"
					>
						<Plus size={12} weight="bold" />
					</button>
				</SidebarGroupLabel>
				<SidebarGroupContent>
					<SidebarMenu>
						{recentChats.map((conv) => {
							const isActive = conv.session.id === activeSessionId
							return (
								<SidebarMenuItem key={conv.session.id}>
									<SidebarMenuButton
										render={<Link to="/chat" search={{ sessionId: conv.session.id }} />}
										isActive={isActive}
										size="sm"
									>
										<span className="min-w-0 flex-1 truncate text-[13px]">
											{conv.title || 'New conversation'}
										</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							)
						})}
						{recentChats.length === 0 && !sessionsQuery.isLoading && (
							<div className="px-2 py-3 text-xs text-muted-foreground">
								No conversations yet
							</div>
						)}
						{hasMore && (
							<SidebarMenuItem>
								<SidebarMenuButton
									render={<Link to="/chat" search={{ view: 'history' }} />}
									size="sm"
								>
									<ClockCounterClockwise size={14} className="shrink-0 text-muted-foreground" />
									<span className="text-[13px] text-muted-foreground">View all</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
						)}
					</SidebarMenu>
				</SidebarGroupContent>
			</SidebarGroup>

			{/* Active tasks */}
			{activeTasks.length > 0 && (
				<SidebarGroup>
					<SidebarGroupLabel>Active Tasks</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{activeTasks.map((task) => (
								<TaskItem key={task.id} task={task} runs={runs} />
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			)}

			{chats.length === 0 && activeTasks.length === 0 && !sessionsQuery.isLoading && (
				<div className="px-4 py-8 text-center text-[13px] text-muted-foreground">
					No active chats or tasks
				</div>
			)}
		</>
	)
}

// ── Footer: user + theme toggle ─────────────────────────────

function SidebarUserFooter() {
	const { user } = useSession()
	const theme = useAppStore((s) => s.theme)
	const setTheme = useAppStore((s) => s.setTheme)
	const navigate = useNavigate()

	const displayName = user?.name || user?.email || 'User'

	const cycleTheme = () => {
		const next = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark'
		setTheme(next)
	}

	return (
		<SidebarFooter>
			<div className="flex items-center gap-1 px-1">
				<button
					onClick={() => void navigate({ to: '/settings' })}
					className="flex min-w-0 flex-1 items-center gap-2 px-1.5 py-1.5 text-left transition-colors hover:bg-sidebar-accent"
				>
					<span className="flex size-6 shrink-0 items-center justify-center bg-muted text-[11px] font-medium text-foreground">
						{displayName[0]?.toUpperCase() ?? '?'}
					</span>
					<span className="min-w-0 flex-1 truncate text-[13px] text-sidebar-foreground">
						{displayName}
					</span>
				</button>
				<button
					onClick={cycleTheme}
					className="flex size-7 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
					title={`Theme: ${theme}`}
				>
					{theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
				</button>
				<button
					onClick={() => void authClient.signOut().then(() => navigate({ to: '/login' }))}
					className="flex size-7 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
					title="Sign out"
				>
					<SignOut size={14} />
				</button>
			</div>
		</SidebarFooter>
	)
}

// ── Root sidebar ─────────────────────────────────────────────

interface SidebarProps {
	onSearchOpen?: () => void
}

export function Sidebar({ onSearchOpen }: SidebarProps) {
	const view = useActiveView()
	const navigate = useNavigate()

	return (
		<ShadcnSidebar collapsible="offcanvas" className="border-r">
			{/* Header */}
			<SidebarHeader className="flex flex-row items-center gap-2 px-3 py-3">
				<Link to="/" className="flex items-center gap-2 text-foreground">
					<SquareBuildLogo size={18} />
					<span className="text-sm font-semibold tracking-tight">
						Autopilot
					</span>
				</Link>
				<div className="flex-1" />
				{onSearchOpen && (
					<button
						onClick={onSearchOpen}
						className="flex size-7 items-center justify-center text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
						title="Search (⌘K)"
					>
						<MagnifyingGlass size={14} />
					</button>
				)}
				<SidebarTrigger />
			</SidebarHeader>

			{/* New chat button */}
			<div className="px-3 pb-2">
				<button
					onClick={() => void navigate({ to: '/chat' })}
					className="flex h-8 w-full items-center justify-center gap-1.5 border border-sidebar-border bg-sidebar text-[13px] text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
				>
					<Plus size={14} />
					New chat
				</button>
			</div>

			{/* Main navigation */}
			<SidebarContent>
				<SidebarGroup className="pt-1">
					<SidebarGroupContent>
						<SidebarMenu>
							{NAV_ITEMS.map((item) => {
								const isActive =
									(item.id === 'tasks' && view === 'tasks') ||
									(item.id === 'files' && view === 'files')
								return (
									<SidebarMenuItem key={item.id}>
										<SidebarMenuButton
											render={
												<Link
													to={item.to}
													search={'search' in item ? item.search : undefined}
												/>
											}
											isActive={isActive}
											size="sm"
										>
											<item.icon
												size={16}
												weight={isActive ? 'fill' : 'regular'}
												className="shrink-0"
											/>
											<span className="text-[13px]">{item.label}</span>
										</SidebarMenuButton>
									</SidebarMenuItem>
								)
							})}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				{/* Company section: chats + active tasks */}
				<CompanySection />
			</SidebarContent>

			{/* Footer: user + theme */}
			<SidebarUserFooter />
			<SidebarRail />
		</ShadcnSidebar>
	)
}
