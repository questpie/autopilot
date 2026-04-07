import { Suspense } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { QUESTPIESpinner } from '@/components/brand'
import { SplitLayout } from '@/components/layouts/split-layout'
import { ChannelsSidebar } from '@/features/channels/channels-sidebar'
import { ChannelView } from '@/features/channels/views/channel-view'
import { useTranslation } from '@/lib/i18n'

export const Route = createFileRoute('/_app/c/$channelId')({
	component: ChannelPage,
})

function ChannelPage() {
	const { t } = useTranslation()
	const { channelId } = Route.useParams()

	return (
		<SplitLayout sidebar={<ChannelsSidebar />} sidebarTitle={t('nav.channels')}>
			<Suspense
				fallback={
					<div className="flex flex-1 items-center justify-center">
						<QUESTPIESpinner />
					</div>
				}
			>
				<ChannelView channelId={channelId} />
			</Suspense>
		</SplitLayout>
	)
}
