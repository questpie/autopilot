import { useStatus } from '@/hooks/use-status'
import { useCustomPages } from '@/lib/page-loader'
import { cn } from '@/lib/utils'
import {
	Browser,
	Chat,
	Circle,
	CircleDashed,
	Cube,
	Files,
	GearSix,
	List,
	Robot,
	SquaresFour,
	Tray,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { Link, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'

interface NavItem {
	to: string
	label: string
	icon: Icon
	badgeKey?: 'activeTasks' | 'pendingApprovals' | 'agentCount'
}

const MAIN_NAV: NavItem[] = [
	{ to: '/', label: 'Dashboard', icon: SquaresFour, badgeKey: 'activeTasks' },
	{ to: '/inbox', label: 'Inbox', icon: Tray, badgeKey: 'pendingApprovals' },
	{ to: '/agents', label: 'Agents', icon: Robot, badgeKey: 'agentCount' },
	{ to: '/chat', label: 'Chat', icon: Chat },
	{ to: '/files', label: 'Files', icon: Files },
	{ to: '/artifacts', label: 'Artifacts', icon: Cube },
]

const BOTTOM_NAV: NavItem[] = [{ to: '/settings', label: 'Settings', icon: GearSix }]

export function Sidebar() {
	const { data: status } = useStatus()
	const { data: customPages } = useCustomPages()
	const routerState = useRouterState()
	const currentPath = routerState.location.pathname
	const isRunning = status && status.agentCount > 0
	const [collapsed, setCollapsed] = useState(false)

	const getBadge = (item: NavItem): number | undefined => {
		if (!item.badgeKey || !status) return undefined
		const val = status[item.badgeKey]
		return typeof val === 'number' && val > 0 ? val : undefined
	}

	const navPages = customPages?.filter((p) => p.nav !== false) ?? []

	return (
		<aside
			className={cn(
				'h-screen flex flex-col border-r border-border bg-background p-4 shrink-0 transition-[width] duration-200',
				collapsed ? 'w-[56px]' : 'w-[220px]',
			)}
		>
			{/* Brand */}
			<div className="mb-6">
				{collapsed ? (
					<div className="font-mono text-[11px] font-bold text-foreground text-center">Q</div>
				) : (
					<>
						<div className="font-mono text-[13px] font-bold tracking-[-0.03em] text-foreground">
							QUESTPIE
						</div>
						<div className="font-mono text-[10px] font-semibold tracking-[0.15em] uppercase text-muted-foreground">
							autopilot
						</div>
					</>
				)}
			</div>

			{/* Status */}
			{!collapsed && (
				<div className="mb-6 flex items-center gap-2 text-[11px]">
					{isRunning ? (
						<Circle
							weight="fill"
							size={8}
							className="text-success animate-[pulse-dot_2s_ease-in-out_infinite]"
						/>
					) : (
						<CircleDashed size={8} className="text-muted-foreground" />
					)}
					<span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground truncate">
						{status?.company ?? 'connecting...'}
					</span>
				</div>
			)}

			{/* Separator */}
			<div className="h-px bg-border mb-2" />

			{/* Main Navigation */}
			<nav className="flex flex-col gap-0.5 flex-1">
				{MAIN_NAV.map((item) => (
					<NavLink
						key={item.to}
						item={item}
						currentPath={currentPath}
						badge={getBadge(item)}
						collapsed={collapsed}
					/>
				))}

				{/* Custom Pages */}
				{navPages.length > 0 && (
					<>
						<div className="h-px bg-border my-2" />
						{navPages.map((page) => (
							<NavLink
								key={page.id}
								item={{ to: page.path, label: page.title, icon: Browser }}
								currentPath={currentPath}
								collapsed={collapsed}
							/>
						))}
					</>
				)}

				<div className="flex-1" />
				<div className="h-px bg-border my-2" />

				{BOTTOM_NAV.map((item) => (
					<NavLink
						key={item.to}
						item={item}
						currentPath={currentPath}
						badge={getBadge(item)}
						collapsed={collapsed}
					/>
				))}
			</nav>

			{/* Collapse toggle */}
			<div className="h-px bg-border mb-3 mt-2" />
			<button
				onClick={() => setCollapsed(!collapsed)}
				className="font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors py-1 text-center"
			>
				{collapsed ? '>' : '<'}
			</button>

			{/* Footer */}
			{!collapsed && (
				<div className="text-[10px] font-mono text-muted-foreground space-y-1 mt-2">
					<div>{status?.company ?? 'autopilot'}</div>
					<div>
						{status?.agentCount ?? 0} agents
						{status?.activeTasks ? ` \u00B7 ${status.activeTasks} tasks` : ''}
					</div>
				</div>
			)}
		</aside>
	)
}

function NavLink({
	item,
	currentPath,
	badge,
	collapsed,
}: { item: NavItem; currentPath: string; badge?: number; collapsed?: boolean }) {
	const isActive = item.to === '/' ? currentPath === '/' : currentPath.startsWith(item.to)

	if (collapsed) {
		return (
			<Link
				to={item.to}
				className={cn(
					'flex items-center justify-center p-2 transition-colors',
					isActive
						? 'text-primary bg-primary/5'
						: 'text-muted-foreground hover:text-foreground hover:bg-accent',
				)}
				title={item.label}
			>
				<div className="relative">
					<item.icon size={18} weight={isActive ? 'fill' : 'regular'} />
					{badge !== undefined && (
						<span className="absolute -top-1 -right-1 font-mono text-[7px] bg-primary text-primary-foreground w-3 h-3 flex items-center justify-center">
							{badge > 9 ? '9+' : badge}
						</span>
					)}
				</div>
			</Link>
		)
	}

	return (
		<Link
			to={item.to}
			className={cn(
				'flex items-center gap-3 px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors',
				isActive
					? 'text-primary bg-primary/5'
					: 'text-muted-foreground hover:text-foreground hover:bg-accent',
			)}
		>
			<item.icon size={16} weight={isActive ? 'fill' : 'regular'} />
			<span className="flex-1">{item.label}</span>
			{badge !== undefined && (
				<span className="font-mono text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 min-w-[20px] text-center">
					{badge}
				</span>
			)}
		</Link>
	)
}
