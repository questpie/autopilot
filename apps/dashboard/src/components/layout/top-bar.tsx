import type { ReactNode } from 'react'

interface TopBarProps {
	title: string
	children?: ReactNode
}

export function TopBar({ title, children }: TopBarProps) {
	return (
		<header className="h-12 flex items-center justify-between px-6 border-b border-border shrink-0">
			<h1 className="font-mono text-[13px] font-bold tracking-[-0.03em] text-foreground">
				{title}
			</h1>
			{children && <div className="flex items-center gap-2">{children}</div>}
		</header>
	)
}
