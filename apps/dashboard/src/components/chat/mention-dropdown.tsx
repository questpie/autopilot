import { useEffect, useRef } from 'react'
import type { Agent } from '@/lib/types'

interface MentionDropdownProps {
	agents: Agent[]
	selectedIndex: number
	onSelect: (agent: Agent) => void
}

export function MentionDropdown({ agents, selectedIndex, onSelect }: MentionDropdownProps) {
	const listRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined
		el?.scrollIntoView({ block: 'nearest' })
	}, [selectedIndex])

	if (agents.length === 0) return null

	return (
		<div
			ref={listRef}
			className="absolute bottom-full left-0 mb-1 w-64 max-h-48 overflow-y-auto bg-background border border-border z-50"
		>
			{agents.map((agent, i) => (
				<button
					key={agent.id}
					type="button"
					className={
						'flex items-center gap-2 w-full px-3 py-1.5 text-left font-mono text-[11px] cursor-pointer' +
						(i === selectedIndex ? ' bg-accent' : ' hover:bg-accent/50')
					}
					onMouseDown={(e) => {
						e.preventDefault()
						onSelect(agent)
					}}
				>
					<span className="truncate">{agent.name}</span>
					<span className="ml-auto text-muted-foreground shrink-0">{agent.role}</span>
				</button>
			))}
		</div>
	)
}
