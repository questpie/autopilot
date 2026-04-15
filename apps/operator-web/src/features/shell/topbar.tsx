import { MagnifyingGlass } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'

interface TopbarProps {
	onSearchOpen: () => void
}

export function Topbar({ onSearchOpen }: TopbarProps) {
	const { open: sidebarOpen } = useSidebar()

	return (
		<header className="sticky top-0 z-50 flex h-10 shrink-0 items-center px-3">
			{!sidebarOpen && <SidebarTrigger className="mr-2" />}
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
