import { ChatCircleIcon, HashIcon, PlusIcon, UserIcon } from '@phosphor-icons/react'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { Link, useLocation } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { SidebarSection } from '@/components/layouts/sidebar-section'
import { buttonVariants } from '@/components/ui/button'
import { SessionItem } from '@/features/chat/session-item'
import { chatSessionsQuery } from '@/features/chat/chat.queries'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useChatSeenStore } from '@/stores/chat-seen.store'
import { Route as AppRoute } from '@/routes/_app'
import { channelsListQuery } from './data/channels.queries'
import { ChannelItem } from './sidebar/channel-item'
import { DmItem } from './sidebar/dm-item'
import { CreateChannelDialog } from './compose/create-channel-dialog'
import { CreateDmDialog } from './compose/create-dm-dialog'

// ── Shared collapse logic ──────────────────────────────────────────────────
//
// Three tiers:  collapsed (5)  →  expanded (20)  →  show-all (unlimited)
// Active item forces the tier that contains it.

const COLLAPSED_CAP = 5
const EXPANDED_CAP = 20

type Tier = 'collapsed' | 'expanded' | 'all'

interface CollapsibleList<T> {
	visible: T[]
	tier: Tier
	/** How many items are hidden beyond the current tier */
	hiddenCount: number
	/** Advance to the next tier */
	showMore: () => void
	/** Go back to collapsed */
	showLess: () => void
}

function capForTier(tier: Tier): number {
	switch (tier) {
		case 'collapsed':
			return COLLAPSED_CAP
		case 'expanded':
			return EXPANDED_CAP
		case 'all':
			return Number.MAX_SAFE_INTEGER
	}
}

function minTierForIndex(index: number): Tier {
	if (index < 0) return 'collapsed'
	if (index < COLLAPSED_CAP) return 'collapsed'
	if (index < EXPANDED_CAP) return 'expanded'
	return 'all'
}

function useCollapsibleList<T>(
	items: T[],
	activeIndex: number,
): CollapsibleList<T> {
	const [userTier, setUserTier] = useState<Tier>('collapsed')

	// Force-open enough to show the active item
	const forced = minTierForIndex(activeIndex)
	const tiers: Tier[] = ['collapsed', 'expanded', 'all']
	const effectiveTier =
		tiers.indexOf(forced) > tiers.indexOf(userTier) ? forced : userTier

	const cap = capForTier(effectiveTier)
	const visible = items.slice(0, cap)
	const hiddenCount = Math.max(0, items.length - cap)

	return {
		visible,
		tier: effectiveTier,
		hiddenCount,
		showMore: () => {
			setUserTier((current) => {
				if (current === 'collapsed') return 'expanded'
				return 'all'
			})
		},
		showLess: () => setUserTier('collapsed'),
	}
}

function ShowMoreButton({
	list,
}: {
	list: CollapsibleList<unknown>
}): React.JSX.Element | null {
	const { t } = useTranslation()

	// Nothing hidden and not expanded → nothing to show
	if (list.hiddenCount <= 0 && list.tier === 'collapsed') return null

	// Show "Show less" when expanded beyond collapsed
	if (list.hiddenCount <= 0 && list.tier !== 'collapsed') {
		return (
			<button
				type="button"
				onClick={list.showLess}
				className="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
			>
				{t('common.show_less')}
			</button>
		)
	}

	// Show "Show more (N)" or "Show all (N)"
	const label =
		list.tier === 'collapsed'
			? `${t('common.show_more')} (${list.visible.length + list.hiddenCount})`
			: `${t('common.show_all')} (${list.visible.length + list.hiddenCount})`

	return (
		<button
			type="button"
			onClick={list.showMore}
			className="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
		>
			{label}
		</button>
	)
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getActiveSessionId(pathname: string): string | null {
	if (!pathname.startsWith('/s/')) return null
	return pathname.split('/')[2] ?? null
}

function getActiveChannelId(pathname: string): string | null {
	if (pathname.startsWith('/c/')) return pathname.split('/')[2] ?? null
	if (pathname.startsWith('/dm/')) return pathname.split('/')[2] ?? null
	return null
}

function hasUnseenMessages(lastMessageAt: string, seenAt?: string): boolean {
	if (!seenAt) return false
	const lastMessageTime = Date.parse(lastMessageAt)
	const seenTime = Date.parse(seenAt)
	if (Number.isNaN(lastMessageTime) || Number.isNaN(seenTime)) return false
	return lastMessageTime > seenTime
}

// ── Action button ──────────────────────────────────────────────────────────

const actionClass = cn(
	buttonVariants({ variant: 'ghost', size: 'xs' }),
	'h-6 px-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground',
)

// ── Sidebar ────────────────────────────────────────────────────────────────

export function ChannelsSidebar(): React.JSX.Element {
	const { t } = useTranslation()
	const location = useLocation()
	const { user } = AppRoute.useRouteContext()
	const [createChannelOpen, setCreateChannelOpen] = useState(false)
	const [createDmOpen, setCreateDmOpen] = useState(false)
	const seenAtBySessionId = useChatSeenStore((state) => state.seenAtBySessionId)
	const { data } = useSuspenseQuery(chatSessionsQuery())
	const { data: allChannels = [] } = useQuery(channelsListQuery())

	const sessions = data?.sessions ?? []
	const activeSessionId = getActiveSessionId(location.pathname)
	const activeChannelId = getActiveChannelId(location.pathname)

	const { groupChannels, dmChannels } = useMemo(() => {
		const group = allChannels.filter((ch) => ch.type === 'group' || ch.type === 'broadcast')
		const dm = allChannels.filter((ch) => ch.type === 'direct')
		return { groupChannels: group, dmChannels: dm }
	}, [allChannels])

	// Collapsible state for each segment
	const sessionsList = useCollapsibleList(
		sessions,
		sessions.findIndex((s) => s.id === activeSessionId),
	)
	const channelsList = useCollapsibleList(
		groupChannels,
		groupChannels.findIndex((c) => c.id === activeChannelId),
	)
	const dmsList = useCollapsibleList(
		dmChannels,
		dmChannels.findIndex((c) => c.id === activeChannelId),
	)

	return (
		<>
			<SidebarSection
				title={t('sections.chats')}
				icon={ChatCircleIcon}
				count={sessions.length}
				emptyText={t('empty.new_chat_description')}
				action={
					<Link to="/" className={actionClass} aria-label={t('chat.new_chat')}>
						<PlusIcon size={12} />
						{t('common.new')}
					</Link>
				}
			>
				{sessionsList.visible.map((session) => (
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
				<ShowMoreButton list={sessionsList} />
			</SidebarSection>

			<SidebarSection
				title={t('sections.channels')}
				icon={HashIcon}
				count={groupChannels.length}
				emptyText={t('empty.channels_description')}
				action={
					<button
						type="button"
						onClick={() => setCreateChannelOpen(true)}
						className={actionClass}
						aria-label={t('channels.create_channel')}
					>
						<PlusIcon size={12} />
						{t('common.new')}
					</button>
				}
			>
				{channelsList.visible.map((channel) => (
					<ChannelItem
						key={channel.id}
						channel={channel}
						active={activeChannelId === channel.id}
					/>
				))}
				<ShowMoreButton list={channelsList} />
			</SidebarSection>

			<SidebarSection
				title={t('sections.direct_messages')}
				icon={UserIcon}
				count={dmChannels.length}
				emptyText={t('empty.dms_description')}
				action={
					<button
						type="button"
						onClick={() => setCreateDmOpen(true)}
						className={actionClass}
						aria-label={t('channels.new_dm')}
					>
						<PlusIcon size={12} />
						{t('common.new')}
					</button>
				}
			>
				{dmsList.visible.map((channel) => (
					<DmItem
						key={channel.id}
						channel={channel}
						active={activeChannelId === channel.id}
						currentUserId={user?.id}
					/>
				))}
				<ShowMoreButton list={dmsList} />
			</SidebarSection>

			<CreateChannelDialog open={createChannelOpen} onOpenChange={setCreateChannelOpen} />
			<CreateDmDialog open={createDmOpen} onOpenChange={setCreateDmOpen} />
		</>
	)
}
