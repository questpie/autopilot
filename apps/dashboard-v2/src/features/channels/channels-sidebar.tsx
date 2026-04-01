import { ChatCircleIcon, HashIcon, PlusIcon, UserIcon } from '@phosphor-icons/react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, useLocation } from '@tanstack/react-router'
import { useState } from 'react'
import { SidebarSection } from '@/components/layouts/sidebar-section'
import { buttonVariants } from '@/components/ui/button'
import { SessionItem } from '@/features/chat/session-item'
import { chatSessionsQuery } from '@/features/chat/chat.queries'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useChatSeenStore } from '@/stores/chat-seen.store'

const DEFAULT_VISIBLE_SESSIONS = 5

function getActiveSessionId(pathname: string): string | null {
	if (!pathname.startsWith('/s/')) return null
	return pathname.split('/')[2] ?? null
}

function hasUnseenMessages(lastMessageAt: string, seenAt?: string): boolean {
	if (!seenAt) return false
	const lastMessageTime = Date.parse(lastMessageAt)
	const seenTime = Date.parse(seenAt)

	if (Number.isNaN(lastMessageTime) || Number.isNaN(seenTime)) {
		return false
	}

	return lastMessageTime > seenTime
}

export function ChannelsSidebar(): React.JSX.Element {
	const { t } = useTranslation()
	const location = useLocation()
	const [showAllSessions, setShowAllSessions] = useState(false)
	const seenAtBySessionId = useChatSeenStore((state) => state.seenAtBySessionId)
	const { data } = useSuspenseQuery(chatSessionsQuery())
	const sessions = data?.sessions ?? []
	const activeSessionId = getActiveSessionId(location.pathname)
	const activeIndex = sessions.findIndex((session) => session.id === activeSessionId)
	const isForcedExpanded = activeIndex >= DEFAULT_VISIBLE_SESSIONS
	const isExpanded = showAllSessions || isForcedExpanded
	const hiddenCount = Math.max(0, sessions.length - DEFAULT_VISIBLE_SESSIONS)
	const visibleSessions = isExpanded ? sessions : sessions.slice(0, DEFAULT_VISIBLE_SESSIONS)

	return (
		<>
			<SidebarSection
				title={t('sections.chats')}
				icon={ChatCircleIcon}
				count={sessions.length}
				emptyText={t('empty.new_chat_description')}
				action={
					<Link
						to="/"
						className={cn(
							buttonVariants({ variant: 'ghost', size: 'xs' }),
							'h-6 px-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground',
						)}
						aria-label={t('chat.new_chat')}
					>
						<PlusIcon size={12} />
						{t('common.new')}
					</Link>
				}
			>
				{visibleSessions.map((session) => (
					<SessionItem
						key={session.id}
						session={session}
						active={activeSessionId === session.id}
						hasUnseen={hasUnseenMessages(
							session.lastMessageAt,
							seenAtBySessionId[session.id],
						)}
					/>
				))}
				{hiddenCount > 0 && !isForcedExpanded ? (
					<button
						type="button"
						onClick={() => setShowAllSessions((current) => !current)}
						className="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
					>
						{showAllSessions ? t('common.show_less') : `${t('common.show_more')} (${hiddenCount})`}
					</button>
				) : null}
			</SidebarSection>
			<SidebarSection
				title={t('sections.channels')}
				icon={HashIcon}
				emptyText={t('empty.channels_description')}
			/>
			<SidebarSection
				title={t('sections.direct_messages')}
				icon={UserIcon}
				emptyText={t('empty.dms_description')}
			/>
		</>
	)
}
