import { Button } from '@/components/ui/button'
import { AgentCard } from '@/features/team/agent-card'
import { agentsQuery } from '@/features/team/team.queries'
import { useTranslation } from '@/lib/i18n'
import { PencilSimpleIcon } from '@phosphor-icons/react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

/**
 * Agent settings panel.
 * Shows agent cards and routes edits to the Files view
 * where team/agents/*.yaml files can be edited directly.
 */
export function AgentEditor() {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const { data: agents } = useSuspenseQuery(agentsQuery)

	const agentList = agents ?? []

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<h3 className="font-heading text-sm font-medium">{t('settings.agents')}</h3>
				<Button
					variant="outline"
					size="sm"
					className="gap-1.5"
					onClick={() => {
						void navigate({ to: '/files/$', params: { _splat: 'team/agents' } })
					}}
				>
					<PencilSimpleIcon size={14} />
					{t('common.edit')}
				</Button>
			</div>

			{agentList.length === 0 ? (
				<p className="text-xs text-muted-foreground">{t('team.no_agents')}</p>
			) : (
				<div className="grid grid-cols-2 gap-0 lg:grid-cols-3">
					{agentList.map((agent, index) => (
						<AgentCard key={agent.id} agent={agent} index={index} />
					))}
				</div>
			)}
		</div>
	)
}
