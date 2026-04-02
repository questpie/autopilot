import { useEffect, useMemo, useRef } from 'react'
import { GenerativeAvatar } from '@questpie/avatar'
import { useQuery } from '@tanstack/react-query'
import { agentsQuery } from '@/features/team/team.queries'
import { channelMembersQuery } from '../data/channels.queries'
import { cn } from '@/lib/utils'

interface MentionAutocompleteProps {
	channelId: string
	query: string
	anchor?: { top: number; left: number }
	onSelect: (name: string) => void
	onClose: () => void
}

interface MentionOption {
	id: string
	name: string
	type: 'agent' | 'human'
}

export function MentionAutocomplete({
	channelId,
	query,
	onSelect,
	onClose,
}: MentionAutocompleteProps): React.JSX.Element | null {
	const ref = useRef<HTMLDivElement>(null)
	const { data: agents } = useQuery(agentsQuery)
	const { data: members } = useQuery(channelMembersQuery(channelId))
	const agentsList = agents ?? []
	const membersList = members ?? []

	const options = useMemo(() => {
		const result: MentionOption[] = []

		// Add agents
		for (const agent of agentsList) {
			result.push({ id: agent.id, name: agent.name, type: 'agent' })
		}

		// Add human members (avoid duplicates)
		const agentIds = new Set(agentsList.map((a) => a.id))
		for (const member of membersList) {
			if (member.actor_type === 'human' && !agentIds.has(member.actor_id)) {
				result.push({ id: member.actor_id, name: member.actor_id, type: 'human' })
			}
		}

		if (!query) return result

		const lowerQuery = query.toLowerCase()
		return result.filter(
			(opt) =>
				opt.name.toLowerCase().includes(lowerQuery) ||
				opt.id.toLowerCase().includes(lowerQuery),
		)
	}, [agentsList, membersList, query])

	// Close on outside click
	useEffect(() => {
		function handleClick(event: MouseEvent) {
			if (ref.current && !ref.current.contains(event.target as Node)) {
				onClose()
			}
		}
		document.addEventListener('mousedown', handleClick)
		return () => document.removeEventListener('mousedown', handleClick)
	}, [onClose])

	if (options.length === 0) return null

	return (
		<div
			ref={ref}
			className="absolute bottom-full left-4 z-50 mb-1 max-h-48 w-64 overflow-y-auto border border-border bg-popover shadow-md"
			style={{ bottom: undefined }}
		>
			{options.map((option) => (
				<button
					key={option.id}
					type="button"
					className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
					onClick={() => onSelect(option.id)}
				>
					<GenerativeAvatar
						seed={option.id}
						size={20}
						className="size-5 shrink-0 border border-border"
					/>
					<span className="min-w-0 truncate font-heading text-xs">{option.name}</span>
					<span
						className={cn(
							'ml-auto shrink-0 px-1 py-0.5 text-[8px] uppercase',
							option.type === 'agent'
								? 'bg-primary/10 text-primary'
								: 'bg-muted text-muted-foreground',
						)}
					>
						{option.type}
					</span>
				</button>
			))}
		</div>
	)
}
