import { useState } from 'react'
import { PlusIcon } from '@phosphor-icons/react'
import { GenerativeAvatar } from '@questpie/avatar'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from '@/components/ui/sheet'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { channelMembersQuery } from '../data/channels.queries'
import { InviteDialog } from './invite-dialog'

interface ChannelMembersPanelProps {
	channelId: string
	open: boolean
	onOpenChange: (open: boolean) => void
}

export function ChannelMembersPanel({
	channelId,
	open,
	onOpenChange,
}: ChannelMembersPanelProps): React.JSX.Element {
	const { t } = useTranslation()
	const { data: members } = useQuery(channelMembersQuery(channelId))
	const membersList = members ?? []
	const [inviteOpen, setInviteOpen] = useState(false)

	// Sort: agents first, then humans
	const sorted = [...membersList].sort((a, b) => {
		if (a.actor_type === 'agent' && b.actor_type !== 'agent') return -1
		if (a.actor_type !== 'agent' && b.actor_type === 'agent') return 1
		return a.actor_id.localeCompare(b.actor_id)
	})

	return (
		<>
			<Sheet open={open} onOpenChange={onOpenChange}>
				<SheetContent side="right" className="w-[360px] max-w-full">
					<SheetHeader>
						<SheetTitle>{t('channels.members')}</SheetTitle>
					</SheetHeader>

					<div className="mt-4 flex flex-col gap-1">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="mb-2 w-full justify-start gap-2 text-muted-foreground"
							onClick={() => setInviteOpen(true)}
						>
							<PlusIcon size={14} />
							{t('channels.invite_people')}
						</Button>

						{sorted.map((member) => (
							<div
								key={member.actor_id}
								className="flex items-center gap-3 px-2 py-1.5"
							>
								<div className="relative">
									<GenerativeAvatar
										seed={member.actor_id}
										size={28}
										className="size-7 border border-border"
									/>
									<span
										className={cn(
											'absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-background',
											member.actor_type === 'agent'
												? 'bg-primary'
												: 'bg-emerald-500',
										)}
									/>
								</div>
								<div className="min-w-0 flex-1">
									<div className="truncate font-heading text-xs text-foreground">
										{member.actor_id}
									</div>
									<div className="text-[10px] text-muted-foreground">
										{member.role}
									</div>
								</div>
								{member.actor_type === 'agent' ? (
									<span className="bg-primary/10 px-1.5 py-0.5 text-[8px] uppercase text-primary">
										BOT
									</span>
								) : null}
							</div>
						))}

						{sorted.length === 0 ? (
							<p className="px-2 py-4 text-center text-xs text-muted-foreground">
								{t('channels.no_members')}
							</p>
						) : null}
					</div>
				</SheetContent>
			</Sheet>

			<InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
		</>
	)
}
