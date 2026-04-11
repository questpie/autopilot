import { useState, useEffect } from 'react'
import { FlowArrowIcon } from '@phosphor-icons/react'
import { createFileRoute } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'
import { PageHeader } from '@/components/page-header'
import { getWorkflows } from '@/api/workflows.api'
import type { Workflow, WorkflowStep } from '@/api/types'

export const Route = createFileRoute('/_app/workflows')({
  component: WorkflowsPage,
})

function StepBadge({ type }: { type: WorkflowStep['type'] }) {
  return (
    <span
      className={cn(
        'inline-block rounded-none border px-1.5 py-0.5 font-heading text-[10px]',
        type === 'trigger' && 'border-blue-500/30 bg-blue-500/10 text-blue-400',
        type === 'action' && 'border-green-500/30 bg-green-500/10 text-green-400',
        type === 'condition' && 'border-amber-500/30 bg-amber-500/10 text-amber-400',
      )}
    >
      {type}
    </span>
  )
}

function WorkflowsPage() {
  const { t } = useTranslation()
  const [workflows, setWorkflows] = useState<Workflow[]>([])

  useEffect(() => {
    getWorkflows().then(setWorkflows)
  }, [])

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="flex flex-col gap-6">
        <PageHeader title={t('advanced.workflows_title')} subtitle={t('advanced.workflows_subtitle')} />

        <div className="flex flex-col gap-3">
          {workflows.map((wf) => (
            <div
              key={wf.id}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="mb-3 flex items-center gap-2">
                <FlowArrowIcon className="size-4 text-primary" weight="bold" />
                <span className="font-mono text-[13px] font-medium">{wf.name}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {wf.steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-2 pl-2">
                    <span className="font-heading text-[10px] text-muted-foreground">{i + 1}.</span>
                    <span className="font-mono text-[12px] text-foreground/80">{step.name}</span>
                    <StepBadge type={step.type} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
