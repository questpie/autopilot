import { useMemo, useState } from 'react'
import { GenerativeAvatar } from '@questpie/avatar'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { agentsQuery } from '@/features/team/team.queries'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useCreateDirectMessage } from '../data/channels.mutations'

interface CreateDmDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
}

interface PersonOption {
	id: string
	name: string
	type: 'human' | 'agent'
	subtitle?: string
}

export function CreateDmDialog({
	open,
	onOpenChange,
}: CreateDmDialogProps): React.JSX.Element {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const [search, setSearch] = useState('')
	const { data: agents = [] } = useQuery(agentsQuery)
	const createDm = useCreateDirectMessage()

	const people = useMemo(() => {
		const result: PersonOption[] = []
		for (const agent of agents) {
			result.push({
				id: agent.id,
				name: agent.name,
				type: 'agent',
				subtitle: agent.role,
			})
		}
		if (!search) return result
		const lower = search.toLowerCase()
		return result.filter(
			(p) =>
				p.name.toLowerCase().includes(lower) || p.id.toLowerCase().includes(lower),
		)
	}, [agents, search])

	const handleSelect = async (person: PersonOption) => {
		try {
			const channel = await createDm.mutateAsync({
				actorId: person.id,
				actorType: person.type,
			})
			onOpenChange(false)
			setSearch('')
			void navigate({ to: '/dm/$channelId', params: { channelId: channel.id } })
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to start conversation')
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-sm">
				<DialogHeader>
					<DialogTitle>{t('channels.new_dm')}</DialogTitle>
				</DialogHeader>

				<Input
					value={search}
					onChange={(event) => setSearch(event.target.value)}
					placeholder={t('channels.search_people')}
					autoFocus
				/>

				<div className="mt-2 flex max-h-64 flex-col overflow-y-auto">
					{people.map((person) => (
						<button
							key={person.id}
							type="button"
							className="flex items-center gap-3 px-2 py-2 text-left transition-colors hover:bg-muted"
							onClick={() => void handleSelect(person)}
							disabled={createDm.isPending}
						>
							<GenerativeAvatar
								seed={person.id}
								size={28}
								className="size-7 shrink-0 border border-border"
							/>
							<div className="min-w-0 flex-1">
								<div className="truncate font-heading text-xs text-foreground">
									{person.name}
								</div>
								{person.subtitle ? (
									<div className="truncate text-[10px] text-muted-foreground">
										{person.subtitle}
									</div>
								) : null}
							</div>
							<span
								className={cn(
									'shrink-0 px-1.5 py-0.5 text-[8px] uppercase',
									person.type === 'agent'
										? 'bg-primary/10 text-primary'
										: 'bg-muted text-muted-foreground',
								)}
							>
								{person.type}
							</span>
						</button>
					))}

					{people.length === 0 ? (
						<p className="py-4 text-center text-xs text-muted-foreground">
							{t('channels.no_people_found')}
						</p>
					) : null}
				</div>
			</DialogContent>
		</Dialog>
	)
}
