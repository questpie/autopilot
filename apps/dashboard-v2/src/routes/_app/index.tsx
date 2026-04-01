import { SplitLayout } from '@/components/layouts/split-layout'
import { ChannelsSidebar } from '@/features/channels/channels-sidebar'
import { NewChatView } from '@/features/chat/new-chat-view'
import { chatSessionsQuery, statusQuery } from '@/features/chat/chat.queries'
import { agentsQuery } from '@/features/team/team.queries'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from '@/lib/i18n'

export const Route = createFileRoute('/_app/')({
	loader: async ({ context }) => {
		await Promise.all([
			context.queryClient.ensureQueryData(statusQuery),
			context.queryClient.ensureQueryData(agentsQuery),
			context.queryClient.ensureQueryData(chatSessionsQuery()),
		])
	},
	component: NewChatPage,
})

function NewChatPage() {
	const { t } = useTranslation()
	return (
		<SplitLayout sidebar={<ChannelsSidebar />} sidebarTitle={t('nav.channels')}>
			<NewChatView />
		</SplitLayout>
	)
}
