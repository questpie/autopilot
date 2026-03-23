import { useAgents } from '@/hooks/use-agents'
import { useSearch } from '@/hooks/use-search'
import type { SearchResultItem } from '@/hooks/use-search'
import { useApproveTask, useTasks } from '@/hooks/use-tasks'
import { cn } from '@/lib/utils'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface CommandItem {
	id: string
	label: string
	section: string
	hint?: string
	snippetHtml?: string
	action: () => void
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
	task: 'Tasks',
	knowledge: 'Knowledge',
	message: 'Messages',
	pin: 'Pins',
	file: 'Files',
}

function useDebounce<T>(value: T, delay: number): T {
	const [debounced, setDebounced] = useState(value)
	useEffect(() => {
		const timer = setTimeout(() => setDebounced(value), delay)
		return () => clearTimeout(timer)
	}, [value, delay])
	return debounced
}

function getSearchResultRoute(result: SearchResultItem): {
	to: string
	params?: Record<string, string>
	search?: Record<string, string>
} {
	switch (result.entityType) {
		case 'task':
			return { to: '/tasks/$taskId', params: { taskId: result.entityId } }
		case 'knowledge':
			return { to: '/files', search: { file: result.entityId } }
		case 'message':
			return { to: '/chat', search: { channel: result.entityId } }
		case 'pin':
			return { to: '/inbox' }
		case 'file':
			return { to: '/files', search: { file: result.entityId } }
		default:
			return { to: '/' }
	}
}

export function CommandBar() {
	const [open, setOpen] = useState(false)
	const [query, setQuery] = useState('')
	const [selectedIndex, setSelectedIndex] = useState(0)
	const inputRef = useRef<HTMLInputElement>(null)
	const navigate = useNavigate()
	const { data: tasks } = useTasks()
	const { data: agents } = useAgents()
	const approveTask = useApproveTask()

	const debouncedQuery = useDebounce(query, 300)
	const { data: searchData } = useSearch(debouncedQuery)

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

	// Build search result items grouped by entityType
	const searchItems = useMemo(() => {
		if (!searchData?.results || searchData.results.length === 0) return []
		const list: CommandItem[] = []

		// Group results by entityType
		const grouped: Record<string, SearchResultItem[]> = {}
		for (const r of searchData.results) {
			const key = r.entityType
			if (!grouped[key]) grouped[key] = []
			grouped[key].push(r)
		}

		for (const [type, results] of Object.entries(grouped)) {
			for (const r of results) {
				const route = getSearchResultRoute(r)
				list.push({
					id: `search-${r.entityType}-${r.entityId}`,
					label: r.title ?? r.entityId,
					section: `Search: ${ENTITY_TYPE_LABELS[type] ?? type}`,
					hint: r.entityType,
					snippetHtml: r.snippet,
					action: () => {
						navigate({
							to: route.to,
							params: route.params,
							search: route.search,
						} as Parameters<typeof navigate>[0])
					},
				})
			}
		}

		return list
	}, [searchData, navigate])

	const items = useMemo(() => {
		const list: CommandItem[] = []

		// Navigation
		list.push(
			{
				id: 'nav-dashboard',
				label: 'Go to Dashboard',
				section: 'Navigation',
				hint: 'Board view',
				action: () => navigate({ to: '/', search: { pin: '', view: 'kanban' } }),
			},
			{
				id: 'nav-inbox',
				label: 'Go to Inbox',
				section: 'Navigation',
				hint: 'Pending approvals',
				action: () => navigate({ to: '/inbox' }),
			},
			{
				id: 'nav-agents',
				label: 'Go to Agents',
				section: 'Navigation',
				action: () => navigate({ to: '/agents', search: { agent: '' } }),
			},
			{
				id: 'nav-chat',
				label: 'Go to Chat',
				section: 'Navigation',
				action: () => navigate({ to: '/chat', search: { channel: 'general' } }),
			},
			{
				id: 'nav-files',
				label: 'Go to Files',
				section: 'Navigation',
				action: () => navigate({ to: '/files', search: { file: '' } }),
			},
			{
				id: 'nav-artifacts',
				label: 'Go to Artifacts',
				section: 'Navigation',
				action: () => navigate({ to: '/artifacts' }),
			},
			{
				id: 'nav-settings',
				label: 'Go to Settings',
				section: 'Navigation',
				action: () => navigate({ to: '/settings' }),
			},
		)

		// Actions
		list.push(
			{
				id: 'action-new-task',
				label: 'New Task',
				section: 'Actions',
				hint: 'Create a new task',
				action: () => {
					setOpen(false)
				},
			},
			{
				id: 'action-chat-general',
				label: 'Chat in #general',
				section: 'Actions',
				action: () => navigate({ to: '/chat', search: { channel: 'general' as string } }),
			},
		)

		// Tasks
		if (tasks) {
			for (const t of tasks.slice(0, 15)) {
				const item: CommandItem = {
					id: `task-${t.id}`,
					label: `${t.id}: ${t.title}`,
					section: 'Tasks',
					hint: t.status,
					action: () => navigate({ to: '/tasks/$taskId', params: { taskId: t.id } }),
				}
				list.push(item)

				// Add approve shortcut for review tasks
				if (t.status === 'review') {
					list.push({
						id: `approve-${t.id}`,
						label: `Approve ${t.id}`,
						section: 'Actions',
						hint: t.title,
						action: () => {
							approveTask.mutate(t.id)
							setOpen(false)
						},
					})
				}
			}
		}

		// Agents
		if (agents) {
			for (const a of agents) {
				list.push({
					id: `agent-${a.id}`,
					label: `${a.name} (${a.role})`,
					section: 'Agents',
					hint: a.status,
					action: () => navigate({ to: '/agents', search: { agent: a.id as string } }),
				})
			}
		}

		return list
	}, [tasks, agents, navigate, approveTask])

	// Combine: search results first, then filtered command items
	const filtered = useMemo(() => {
		const commandItems = !query
			? items
			: items.filter(
					(item) =>
						item.label.toLowerCase().includes(query.toLowerCase()) ||
						(item.hint?.toLowerCase().includes(query.toLowerCase()) ?? false),
				)

		// If we have search results, prepend them
		if (searchItems.length > 0) {
			return [...searchItems, ...commandItems]
		}

		return commandItems
	}, [items, searchItems, query])

	const execute = useCallback((item: CommandItem) => {
		item.action()
		setOpen(false)
	}, [])

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
		sections[item.section]?.push(item)
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
						<div className="p-4 text-center text-sm text-muted-foreground">No results found</div>
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
												'w-full text-left px-4 py-2 text-sm transition-colors cursor-pointer flex flex-col gap-0.5',
												idx === selectedIndex
													? 'bg-accent text-foreground'
													: 'text-muted-foreground hover:bg-accent/50',
											)}
										>
											<div className="flex items-center justify-between w-full">
												<span>{item.label}</span>
												{item.hint && (
													<span className="font-mono text-[10px] text-muted-foreground/60 ml-2 shrink-0">
														{item.hint}
													</span>
												)}
											</div>
											{item.snippetHtml && (
												<span
													className="text-xs text-muted-foreground/80 truncate max-w-full [&_b]:text-foreground [&_b]:font-semibold [&_mark]:bg-yellow-500/30 [&_mark]:text-foreground"
													dangerouslySetInnerHTML={{ __html: item.snippetHtml }}
												/>
											)}
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
