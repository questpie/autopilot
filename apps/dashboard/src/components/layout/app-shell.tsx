import type { ReactNode } from 'react'
import { Sidebar } from './sidebar'
import { CommandBar } from './command-bar'

export function AppShell({ children }: { children: ReactNode }) {
	return (
		<div className="flex h-screen overflow-hidden relative z-10">
			<Sidebar />
			<main className="flex-1 flex flex-col overflow-hidden">{children}</main>
			<CommandBar />
		</div>
	)
}
