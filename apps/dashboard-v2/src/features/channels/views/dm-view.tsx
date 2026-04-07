import { useState } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { PageTransition } from '@/components/layouts/page-transition'
import { Route as AppRoute } from '@/routes/_app'
import type { Message } from '@/features/chat/chat.types'
import { MessageList } from '@/features/chat/messages/message-list'
import { useSendChannelMessage } from '../data/channels.mutations'
import {
	channelDetailQuery,
	channelMessagesQuery,
} from '../data/channels.queries'
import { useChannelEvents } from '../data/use-channel-events'
import { ChannelHeader } from './channel-header'
import { ChannelMembersPanel } from '../compose/channel-members-panel'
import { ChannelComposer } from '../compose/channel-composer'

interface DmViewProps {
	channelId: string
}

export function DmView({ channelId }: DmViewProps): React.JSX.Element {
	const { user } = AppRoute.useRouteContext()
	const currentUserId = user?.id ?? 'human'
	const currentUserName = user?.name ?? user?.email ?? 'You'

	const { data: channel } = useSuspenseQuery(channelDetailQuery(channelId))
	const { data: messages = [] } = useSuspenseQuery(channelMessagesQuery(channelId))
	const sendMessage = useSendChannelMessage()
	const [membersOpen, setMembersOpen] = useState(false)

	useChannelEvents(channelId)

	const otherMember = channel.members?.find(
		(m) => m.actor_id !== currentUserId,
	)
	const memberCount = channel.members?.length ?? 0

	return (
		<PageTransition className="flex min-h-0 flex-1 flex-col">
			<ChannelHeader
				name={channel.name}
				description={null}
				memberCount={memberCount}
				type="direct"
				dmParticipantId={otherMember?.actor_id}
				dmParticipantName={otherMember?.actor_id}
				onMembersClick={() => setMembersOpen(true)}
			/>
			<MessageList
				messages={messages as unknown as Message[]}
				currentUserId={currentUserId}
				currentUserName={currentUserName}
			/>
			<ChannelComposer
				channelId={channelId}
				disabled={sendMessage.isPending}
				onSend={async (content, mentions) => {
					await sendMessage.mutateAsync({
						channelId,
						content,
						mentions,
					})
				}}
			/>
			<ChannelMembersPanel
				channelId={channelId}
				open={membersOpen}
				onOpenChange={setMembersOpen}
			/>
		</PageTransition>
	)
}
