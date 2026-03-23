import { Link, useRouterState } from '@tanstack/react-router'
import {
	SquaresFour,
	Robot,
	Chat,
	Tray,
	Files,
	Cube,
	GearSix,
	CircleDashed,
	Circle,
	Browser,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { useStatus } from '@/hooks/use-status'
import { useCustomPages } from '@/lib/page-loader'
import type { Icon } from '@phosphor-icons/react'

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

const BOTTOM_NAV: NavItem[] = [
	{ to: '/settings', label: 'Settings', icon: GearSix },
]

export function Sidebar() {
	const { data: status } = useStatus()
	const { data: customPages } = useCustomPages()
	const routerState = useRouterState()
	const currentPath = routerState.location.pathname
	const isRunning = status && status.agentCount > 0

	const getBadge = (item: NavItem): number | undefined => {
		if (!item.badgeKey || !status) return undefined
		const val = status[item.badgeKey]
		return typeof val === 'number' && val > 0 ? val : undefined
	}

	const navPages = customPages?.filter((p) => p.nav !== false) ?? []

	return (
		<aside className="w-[220px] h-screen flex flex-col border-r border-border bg-background p-4 shrink-0">
			{/* Brand */}
			<div className="mb-6">
				<div className="font-mono text-[13px] font-bold tracking-[-0.03em] text-foreground">
					QUESTPIE
				</div>
				<div className="font-mono text-[10px] font-semibold tracking-[0.15em] uppercase text-muted-foreground">
					autopilot
				</div>
			</div>

			{/* Status */}
			<div className="mb-6 flex items-center gap-2 text-[11px]">
				{isRunning ? (
					<Circle weight="fill" size={8} className="text-success animate-[pulse-dot_2s_ease-in-out_infinite]" />
				) : (
					<CircleDashed size={8} className="text-muted-foreground" />
				)}
				<span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground truncate">
					{status?.company ?? 'connecting...'}
				</span>
			</div>

			{/* Separator */}
			<div className="h-px bg-border mb-2" />

			{/* Main Navigation */}
			<nav className="flex flex-col gap-0.5 flex-1">
				{MAIN_NAV.map((item) => (
					<NavLink key={item.to} item={item} currentPath={currentPath} badge={getBadge(item)} />
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
							/>
						))}
					</>
				)}

				<div className="flex-1" />
				<div className="h-px bg-border my-2" />

				{BOTTOM_NAV.map((item) => (
					<NavLink key={item.to} item={item} currentPath={currentPath} badge={getBadge(item)} />
				))}
			</nav>

			{/* Footer */}
			<div className="h-px bg-border mb-3 mt-2" />
			<div className="text-[10px] font-mono text-muted-foreground space-y-1">
				<div>{status?.company ?? 'autopilot'}</div>
				<div>
					{status?.agentCount ?? 0} agents
					{status?.activeTasks ? ` \u00B7 ${status.activeTasks} tasks` : ''}
				</div>
			</div>
		</aside>
	)
}

function NavLink({ item, currentPath, badge }: { item: NavItem; currentPath: string; badge?: number }) {
	const isActive =
		item.to === '/'
			? currentPath === '/'
			: currentPath.startsWith(item.to)

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
