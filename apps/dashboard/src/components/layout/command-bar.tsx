import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { useTasks } from '@/hooks/use-tasks'
import { useAgents } from '@/hooks/use-agents'
import { cn } from '@/lib/utils'

interface CommandItem {
	id: string
	label: string
	section: string
	action: () => void
}

export function CommandBar() {
	const [open, setOpen] = useState(false)
	const [query, setQuery] = useState('')
	const [selectedIndex, setSelectedIndex] = useState(0)
	const inputRef = useRef<HTMLInputElement>(null)
	const navigate = useNavigate()
	const { data: tasks } = useTasks()
	const { data: agents } = useAgents()

	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
				e.preventDefault()
				setOpen((v) => !v)
				setQuery('')
				setSelectedIndex(0)
			}
			if (e.key === 'Escape') {
				setOpen(false)
			}
		}
		window.addEventListener('keydown', handler)
		return () => window.removeEventListener('keydown', handler)
	}, [])

	useEffect(() => {
		if (open) inputRef.current?.focus()
	}, [open])

	const items = useMemo(() => {
		const list: CommandItem[] = []

		// Navigation
		list.push(
			{ id: 'nav-dashboard', label: 'Go to Dashboard', section: 'Navigation', action: () => navigate({ to: '/' }) },
			{ id: 'nav-inbox', label: 'Go to Inbox', section: 'Navigation', action: () => navigate({ to: '/inbox' }) },
			{ id: 'nav-agents', label: 'Go to Agents', section: 'Navigation', action: () => navigate({ to: '/agents' }) },
			{ id: 'nav-chat', label: 'Go to Chat', section: 'Navigation', action: () => navigate({ to: '/chat' }) },
			{ id: 'nav-files', label: 'Go to Files', section: 'Navigation', action: () => navigate({ to: '/files' }) },
			{ id: 'nav-artifacts', label: 'Go to Artifacts', section: 'Navigation', action: () => navigate({ to: '/artifacts' }) },
			{ id: 'nav-settings', label: 'Go to Settings', section: 'Navigation', action: () => navigate({ to: '/settings' }) },
		)

		// Tasks
		if (tasks) {
			for (const t of tasks.slice(0, 10)) {
				list.push({
					id: `task-${t.id}`,
					label: `${t.id}: ${t.title}`,
					section: 'Tasks',
					action: () => navigate({ to: '/tasks/$taskId', params: { taskId: t.id } }),
				})
			}
		}

		// Agents
		if (agents) {
			for (const a of agents) {
				list.push({
					id: `agent-${a.id}`,
					label: `${a.name} (${a.role})`,
					section: 'Agents',
					action: () => navigate({ to: '/agents', search: { agent: a.id } }),
				})
			}
		}

		return list
	}, [tasks, agents, navigate])

	const filtered = useMemo(() => {
		if (!query) return items
		const q = query.toLowerCase()
		return items.filter((item) => item.label.toLowerCase().includes(q))
	}, [items, query])

	const execute = useCallback(
		(item: CommandItem) => {
			item.action()
			setOpen(false)
		},
		[],
	)

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'ArrowDown') {
			e.preventDefault()
			setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
		} else if (e.key === 'ArrowUp') {
			e.preventDefault()
			setSelectedIndex((i) => Math.max(i - 1, 0))
		} else if (e.key === 'Enter') {
			e.preventDefault()
			if (filtered[selectedIndex]) execute(filtered[selectedIndex])
		}
	}

	useEffect(() => {
		setSelectedIndex(0)
	}, [query])

	if (!open) return null

	// Group by section
	const sections: Record<string, CommandItem[]> = {}
	for (const item of filtered) {
		if (!sections[item.section]) sections[item.section] = []
		sections[item.section]!.push(item)
	}

	let flatIndex = -1

	return (
		<>
			<div className="fixed inset-0 bg-black/40 z-50" onClick={() => setOpen(false)} />
			<div className="fixed top-[20%] left-1/2 -translate-x-1/2 z-50 w-full max-w-[560px] bg-background border border-border">
				<div className="flex items-center gap-3 px-4 py-3 border-b border-border">
					<MagnifyingGlass size={16} className="text-muted-foreground shrink-0" />
					<input
						ref={inputRef}
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Type a command or search..."
						className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
					/>
					<kbd className="font-mono text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5">
						ESC
					</kbd>
				</div>
				<div className="max-h-[400px] overflow-y-auto">
					{filtered.length === 0 ? (
						<div className="p-4 text-center text-sm text-muted-foreground">
							No results found
						</div>
					) : (
						Object.entries(sections).map(([section, sectionItems]) => (
							<div key={section}>
								<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.12em] px-4 py-2">
									{section}
								</div>
								{sectionItems.map((item) => {
									flatIndex++
									const idx = flatIndex
									return (
										<button
											key={item.id}
											onClick={() => execute(item)}
											className={cn(
												'w-full text-left px-4 py-2 text-sm transition-colors cursor-pointer',
												idx === selectedIndex
													? 'bg-accent text-foreground'
													: 'text-muted-foreground hover:bg-accent/50',
											)}
										>
											{item.label}
										</button>
									)
								})}
							</div>
						))
					)}
				</div>
			</div>
		</>
	)
}
