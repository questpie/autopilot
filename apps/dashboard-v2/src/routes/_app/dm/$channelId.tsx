import { Suspense } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { QUESTPIESpinner } from '@/components/brand'
import { SplitLayout } from '@/components/layouts/split-layout'
import { ChannelsSidebar } from '@/features/channels/channels-sidebar'
import { DmView } from '@/features/channels/views/dm-view'

export const Route = createFileRoute('/_app/dm/$channelId')({
	component: DirectMessagePage,
})

function DirectMessagePage() {
	const { channelId } = Route.useParams()

	return (
		<SplitLayout sidebar={<ChannelsSidebar />}>
			<Suspense
				fallback={
					<div className="flex flex-1 items-center justify-center">
						<QUESTPIESpinner />
					</div>
				}
			>
				<DmView channelId={channelId} />
			</Suspense>
		</SplitLayout>
	)
}
