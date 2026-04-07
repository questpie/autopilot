import { useSuspenseQuery } from '@tanstack/react-query'
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from '@/components/ui/sheet'
import type { Message } from '@/features/chat/chat.types'
import { MessageList } from '@/features/chat/messages/message-list'
import { Route as AppRoute } from '@/routes/_app'
import { useTranslation } from '@/lib/i18n'
import { useSendChannelMessage } from '../data/channels.mutations'
import { channelMessagesQuery } from '../data/channels.queries'
import { useChannelEvents } from '../data/use-channel-events'
import { ChannelComposer } from '../compose/channel-composer'

interface ThreadPanelProps {
	channelId: string
	threadId: string
	open: boolean
	onOpenChange: (open: boolean) => void
}

export function ThreadPanel({
	channelId,
	threadId,
	open,
	onOpenChange,
}: ThreadPanelProps): React.JSX.Element {
	const { t } = useTranslation()
	const { user } = AppRoute.useRouteContext()
	const currentUserId = user?.id ?? 'human'
	const currentUserName = user?.name ?? user?.email ?? 'You'

	const { data: messages = [] } = useSuspenseQuery(
		channelMessagesQuery(channelId, 50, threadId),
	)
	const sendMessage = useSendChannelMessage()

	useChannelEvents(open ? channelId : null)

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="right" className="flex w-[400px] max-w-full flex-col p-0">
				<SheetHeader className="border-b border-border px-4 py-3">
					<SheetTitle className="text-sm">{t('channels.thread')}</SheetTitle>
				</SheetHeader>

				<div className="flex min-h-0 flex-1 flex-col">
					<MessageList
						messages={messages as unknown as Message[]}
						currentUserId={currentUserId}
						currentUserName={currentUserName}
					/>
					<ChannelComposer
						channelId={channelId}
						placeholder={t('channels.reply_placeholder')}
						disabled={sendMessage.isPending}
						onSend={async (content, mentions) => {
							await sendMessage.mutateAsync({
								channelId,
								content,
								threadId,
								mentions,
							})
						}}
					/>
				</div>
			</SheetContent>
		</Sheet>
	)
}
