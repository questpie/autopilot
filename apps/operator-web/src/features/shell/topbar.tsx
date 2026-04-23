import { MagnifyingGlass } from '@phosphor-icons/react'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { useActiveView } from '@/hooks/use-active-view'
import { cn } from '@/lib/utils'

interface TopbarProps {
	onSearchOpen: () => void
}

const MODE_ITEMS = [
	{ id: 'chat', label: 'Chat', to: '/chat' },
	{ id: 'tasks', label: 'Tasks', to: '/tasks' },
	{ id: 'files', label: 'Files', to: '/files' },
] as const

export function Topbar({ onSearchOpen }: TopbarProps) {
	const { open: sidebarOpen } = useSidebar()
	const activeView = useActiveView()

	return (
		<header className="flex h-12 shrink-0 items-center gap-3 border-b border-border/70 bg-background/95 px-3 backdrop-blur-sm">
			{!sidebarOpen && <SidebarTrigger className="mr-1" />}
			<nav className="flex min-w-0 items-center gap-1">
				{MODE_ITEMS.map((item) => {
					const isActive = activeView === item.id
					return (
						<Link
							key={item.id}
							to={item.to}
							className={cn(
								'rounded-md px-3 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] transition-[background-color,color]',
								isActive
									? 'bg-card text-foreground shadow-xs ring-1 ring-border/60'
									: 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
							)}
						>
							{item.label}
						</Link>
					)
				})}
			</nav>
			<div className="flex-1" />
			<Button
				variant="outline"
				size="sm"
				onClick={onSearchOpen}
				aria-label="Open command palette"
				aria-keyshortcuts="Meta+K"
				className="gap-2 text-xs text-muted-foreground"
			>
				<MagnifyingGlass size={14} />
				<span className="hidden md:inline">Search</span>
				<Kbd className="ml-1 hidden md:inline">⌘K</Kbd>
			</Button>
		</header>
	)
}
