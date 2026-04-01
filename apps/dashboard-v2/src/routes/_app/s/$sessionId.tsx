import { createFileRoute } from '@tanstack/react-router'
import { SplitLayout } from '@/components/layouts/split-layout'
import { ChannelsSidebar } from '@/features/channels/channels-sidebar'
import {
	chatSessionDetailQuery,
	chatSessionMessagesQuery,
	chatSessionsQuery,
} from '@/features/chat/chat.queries'
import { SessionView } from '@/features/chat/session-view'
import { useTranslation } from '@/lib/i18n'

export const Route = createFileRoute('/_app/s/$sessionId')({
	loader: async ({ context, params }) => {
		const session = await context.queryClient.ensureQueryData(
			chatSessionDetailQuery(params.sessionId),
		)
		await Promise.all([
			context.queryClient.ensureQueryData(chatSessionsQuery()),
			context.queryClient.ensureQueryData(chatSessionMessagesQuery(session.id)),
		])
	},
	component: SessionPage,
})

function SessionPage() {
	const { sessionId } = Route.useParams()
	const { t } = useTranslation()

	return (
		<SplitLayout sidebar={<ChannelsSidebar />} sidebarTitle={t('nav.channels')}>
			<SessionView sessionId={sessionId} />
		</SplitLayout>
	)
}
