import { RobotIcon } from '@phosphor-icons/react'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from '@/lib/i18n'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { DetailSection } from '@/components/ui/detail-section'
import { KvList } from '@/components/ui/kv-list'
import { useAgents } from '@/hooks/use-agents'
import type { Agent } from '@/api/types'

export const Route = createFileRoute('/_app/agents')({
  component: AgentsPage,
})

function AgentRow({ agent, isLast }: { agent: Agent; isLast: boolean }) {
  const { t } = useTranslation()
  return (
    <DetailSection last={isLast} className="py-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center border border-primary/25 bg-primary/8">
          <RobotIcon className="size-[16px] text-primary" weight="bold" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-foreground">{agent.name}</span>
            <span className="font-heading text-[10px] text-muted-foreground bg-muted/40 px-1.5 py-0.5">
              {agent.role}
            </span>
          </div>
          <div className="mt-2">
            <KvList
              items={[
                {
                  label: t('agents.model'),
                  value: (
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {agent.model ?? 'default'}
                    </span>
                  ),
                },
                ...(agent.provider
                  ? [
                      {
                        label: t('agents.provider'),
                        value: (
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {agent.provider}
                          </span>
                        ),
                      },
                    ]
                  : []),
                {
                  label: t('agents.profiles'),
                  value: (
                    <div className="flex flex-wrap gap-1">
                      {agent.capability_profiles.length === 0 ? (
                        <span className="text-[11px] text-muted-foreground/50">—</span>
                      ) : (
                        agent.capability_profiles.map((cap) => (
                          <span
                            key={cap}
                            className="border border-border bg-muted px-1.5 py-0.5 font-heading text-[10px] text-muted-foreground"
                          >
                            {cap}
                          </span>
                        ))
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </div>
        </div>
      </div>
    </DetailSection>
  )
}

function AgentsPage() {
  const { t } = useTranslation()
  const { data: agents, isLoading, isError } = useAgents()

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Page header */}
      <div className="border-b border-border/50 px-5 py-4">
        <PageHeader title={t('agents.title')} subtitle={t('agents.subtitle')} />
      </div>

      {isLoading ? (
        <EmptyState title={t('agents.loading')} description="" />
      ) : isError ? (
        <EmptyState title={t('agents.error')} description="" />
      ) : !agents || agents.length === 0 ? (
        <EmptyState title={t('agents.empty')} description={t('agents.empty_desc')} />
      ) : (
        agents.map((agent, i) => (
          <AgentRow key={agent.id} agent={agent} isLast={i === agents.length - 1} />
        ))
      )}
    </div>
  )
}
