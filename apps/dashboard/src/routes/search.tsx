import { TopBar } from '@/components/layout/top-bar'
import { useSearch as useSearchHook } from '@/hooks/use-search'
import type { SearchResultItem } from '@/hooks/use-search'
import { cn } from '@/lib/utils'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'

export const Route = createFileRoute('/search')({
	component: SearchPage,
	validateSearch: (search: Record<string, unknown>) => ({
		q: (search.q as string) ?? '',
	}),
})

const TABS = [
	{ label: 'All', value: '' },
	{ label: 'Tasks', value: 'task' },
	{ label: 'Knowledge', value: 'knowledge' },
	{ label: 'Messages', value: 'message' },
	{ label: 'Pins', value: 'pin' },
] as const

const TYPE_BADGES: Record<string, string> = {
	task: 'bg-blue-500/20 text-blue-400',
	knowledge: 'bg-green-500/20 text-green-400',
	message: 'bg-purple-500/20 text-purple-400',
	pin: 'bg-yellow-500/20 text-yellow-400',
	file: 'bg-orange-500/20 text-orange-400',
}

function useDebounce<T>(value: T, delay: number): T {
	const [debounced, setDebounced] = useState(value)
	useEffect(() => {
		const timer = setTimeout(() => setDebounced(value), delay)
		return () => clearTimeout(timer)
	}, [value, delay])
	return debounced
}

function SearchPage() {
	const { q: initialQuery } = Route.useSearch()
	const navigate = useNavigate()
	const [query, setQuery] = useState(initialQuery)
	const [activeTab, setActiveTab] = useState('')
	const inputRef = useRef<HTMLInputElement>(null)

	const debouncedQuery = useDebounce(query, 300)
	const { data, isLoading } = useSearchHook(debouncedQuery, {
		type: activeTab || undefined,
	})

	useEffect(() => {
		inputRef.current?.focus()
	}, [])

	const handleNavigate = useCallback(
		(result: SearchResultItem) => {
			switch (result.entityType) {
				case 'task':
					navigate({ to: '/tasks/$taskId', params: { taskId: result.entityId } })
					break
				case 'knowledge':
				case 'file':
					navigate({ to: '/files', search: { file: result.entityId } })
					break
				case 'message':
					navigate({ to: '/chat', search: { channel: result.entityId } })
					break
				case 'pin':
					navigate({ to: '/inbox' })
					break
			}
		},
		[navigate],
	)

	return (
		<div className="flex flex-col h-full">
			<TopBar title="Search" />
			<div className="flex-1 overflow-y-auto p-6">
				<div className="max-w-3xl mx-auto space-y-6">
					<input
						ref={inputRef}
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search across tasks, knowledge, messages, pins..."
						className="w-full bg-secondary/50 border border-border px-4 py-3 text-sm outline-none focus:border-primary transition-colors placeholder:text-muted-foreground"
					/>

					<div className="flex gap-1 border-b border-border">
						{TABS.map((tab) => (
							<button
								key={tab.value}
								onClick={() => setActiveTab(tab.value)}
								className={cn(
									'px-3 py-2 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer',
									activeTab === tab.value
										? 'text-foreground border-b-2 border-primary'
										: 'text-muted-foreground hover:text-foreground',
								)}
							>
								{tab.label}
							</button>
						))}
					</div>

					{isLoading && debouncedQuery.length > 1 && (
						<div className="text-sm text-muted-foreground">Searching...</div>
					)}

					{data && data.results.length === 0 && debouncedQuery.length > 1 && (
						<div className="text-sm text-muted-foreground">
							No results found for &quot;{debouncedQuery}&quot;
						</div>
					)}

					{data && data.results.length > 0 && (
						<div className="space-y-2">
							<div className="text-xs text-muted-foreground font-mono">
								{data.total} result{data.total !== 1 ? 's' : ''} for &quot;{data.query}&quot;
							</div>
							{data.results.map((result) => (
								<button
									key={`${result.entityType}-${result.entityId}`}
									onClick={() => handleNavigate(result)}
									className="w-full text-left bg-secondary/30 border border-border p-4 hover:bg-secondary/50 transition-colors cursor-pointer space-y-1"
								>
									<div className="flex items-center gap-2">
										<span
											className={cn(
												'text-[10px] font-mono uppercase px-1.5 py-0.5',
												TYPE_BADGES[result.entityType] ?? 'bg-secondary text-muted-foreground',
											)}
										>
											{result.entityType}
										</span>
										<span className="text-sm font-medium text-foreground">
											{result.title ?? result.entityId}
										</span>
									</div>
									{result.snippet && (
										<div
											className="text-xs text-muted-foreground truncate [&_b]:text-foreground [&_b]:font-semibold [&_mark]:bg-yellow-500/30 [&_mark]:text-foreground"
											dangerouslySetInnerHTML={{ __html: result.snippet }}
										/>
									)}
								</button>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
