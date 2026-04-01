import { useEffect, useState } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { EmptyState } from '@/components/feedback'
import { PageTransition } from '@/components/layouts/page-transition'
import { MessageComposer } from '@/features/chat/message-composer'
import { agentsQuery } from '@/features/team/team.queries'
import { Route as AppRoute } from '@/routes/_app'
import { useCreateChatSession } from './chat.mutations'
import { statusQuery } from './chat.queries'
import { capitalize } from '@/lib/utils'

function getDisplayName(user?: (typeof AppRoute)['types']['allContext']['user']): string {
	if (!user) return 'there'

	let result = user.name?.trim()
	if (result) return capitalize(result.split(' ')[0])

	result = user.email?.split('@')[0].split('.')[0]
	if (result) return capitalize(result)

	return 'there'
}

export function NewChatView(): React.JSX.Element {
	const navigate = useNavigate()
	const { user } = AppRoute.useRouteContext()
	const displayName = getDisplayName(user)
	const { data: status } = useSuspenseQuery(statusQuery)
	const { data: agents } = useSuspenseQuery(agentsQuery)
	const createSession = useCreateChatSession()
	const [onboardingStarted, setOnboardingStarted] = useState(false)
	const needsOnboarding =
		status.setupCompleted &&
		!status.onboardingChatCompleted &&
		agents.some((agent) => agent.id === 'ceo')

	useEffect(() => {
		if (!needsOnboarding || onboardingStarted || createSession.isPending) {
			return
		}

		setOnboardingStarted(true)
		createSession.mutate(
			{ agentId: 'ceo', message: '__onboarding__' },
			{
				onSuccess: async (session) => {
					await navigate({
						to: '/s/$sessionId',
						params: { sessionId: session.sessionId },
					})
				},
				onError: () => {
					setOnboardingStarted(false)
				},
			},
		)
	}, [createSession.isPending, createSession.mutate, navigate, needsOnboarding, onboardingStarted])

	return (
		<PageTransition className="flex flex-1 items-center justify-center p-6">
			<div className="flex w-full max-w-2xl flex-col gap-8">
				<EmptyState
					logo
					title={`Welcome, ${displayName}!`}
					description={
						needsOnboarding ? 'Starting your CEO onboarding session.' : 'Your AI team is ready.'
					}
				/>
				<MessageComposer
					onSend={async (message, agentId) => {
						const session = await createSession.mutateAsync({ agentId, message })
						await navigate({
							to: '/s/$sessionId',
							params: { sessionId: session.sessionId },
						})
					}}
					disabled={createSession.isPending || needsOnboarding}
					autoFocus={!needsOnboarding}
				/>
			</div>
		</PageTransition>
	)
}
