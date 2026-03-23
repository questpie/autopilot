import { Link, useRouterState } from '@tanstack/react-router'

const navItems = [
	{ to: '/', label: 'Dashboard', icon: '#' },
	{ to: '/agents', label: 'Agents', icon: '@' },
	{ to: '/chat', label: 'Chat', icon: '>' },
	{ to: '/knowledge', label: 'Knowledge', icon: '~' },
] as const

export function Sidebar() {
	const router = useRouterState()
	const currentPath = router.location.pathname

	return (
		<aside className="w-52 h-screen bg-card border-r border-border flex flex-col shrink-0">
			<div className="p-4 border-b border-border">
				<Link to="/" className="flex items-center gap-2 no-underline">
					<span className="text-purple font-bold text-lg font-mono">Q</span>
					<span className="text-fg text-sm font-semibold">AUTOPILOT</span>
				</Link>
			</div>
			<nav className="flex-1 py-2">
				{navItems.map((item) => {
					const isActive =
						item.to === '/'
							? currentPath === '/'
							: currentPath.startsWith(item.to)
					return (
						<Link
							key={item.to}
							to={item.to}
							className={`flex items-center gap-3 px-4 py-2.5 text-sm no-underline transition-colors ${
								isActive
									? 'text-purple bg-purple-faint border-r-2 border-purple'
									: 'text-muted hover:text-fg hover:bg-surface'
							}`}
						>
							<span className="font-mono text-xs w-4">{item.icon}</span>
							{item.label}
						</Link>
					)
				})}
			</nav>
			<div className="p-4 border-t border-border">
				<p className="text-xs text-ghost font-mono">v0.1.0</p>
			</div>
		</aside>
	)
}
