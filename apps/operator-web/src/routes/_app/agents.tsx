import { RobotIcon } from '@phosphor-icons/react'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from '@/lib/i18n'
import { PageHeader } from '@/components/page-header'

export const Route = createFileRoute('/_app/agents')({
  component: AgentsPage,
})

// ── Mock Data ──

interface Agent {
  id: string
  name: string
  role: string
  model: string
  capabilities: string[]
}

const mockAgents: Agent[] = [
  {
    id: '1',
    name: 'Hlavny asistent',
    role: 'orchestrator',
    model: 'claude-sonnet-4-20250514',
    capabilities: ['chat', 'tasks', 'automations'],
  },
  {
    id: '2',
    name: 'Content writer',
    role: 'specialist',
    model: 'claude-sonnet-4-20250514',
    capabilities: ['copywriting', 'social-media'],
  },
  {
    id: '3',
    name: 'Analytik',
    role: 'specialist',
    model: 'claude-haiku-4-20250414',
    capabilities: ['reviews', 'reports', 'data'],
  },
]

function AgentsPage() {
  const { t } = useTranslation()
  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="flex flex-col gap-6">
        <PageHeader title={t('advanced.agents_title')} subtitle={t('advanced.agents_subtitle')} />

        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}
        >
          {mockAgents.map((agent) => (
            <div
              key={agent.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/8">
                  <RobotIcon className="size-[18px] text-primary" weight="bold" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{agent.name}</span>
                  <span className="font-heading text-[11px] text-muted-foreground">{agent.role}</span>
                </div>
              </div>
              <div className="font-mono text-[12px] text-muted-foreground">{agent.model}</div>
              <div className="flex flex-wrap gap-1">
                {agent.capabilities.map((cap) => (
                  <span
                    key={cap}
                    className="rounded-none border border-border bg-muted px-1.5 py-0.5 font-heading text-[10px] text-muted-foreground"
                  >
                    {cap}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
