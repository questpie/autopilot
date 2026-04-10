import { m } from 'framer-motion'
import { FlowArrowIcon } from '@phosphor-icons/react'
import { createFileRoute } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { useTranslation } from '@/lib/i18n'

export const Route = createFileRoute('/_app/workflows')({
  component: WorkflowsPage,
})

// ── Mock Data ──

interface WorkflowStep {
  name: string
  type: 'trigger' | 'action' | 'condition'
}

interface Workflow {
  id: string
  name: string
  steps: WorkflowStep[]
}

const mockWorkflows: Workflow[] = [
  {
    id: '1',
    name: 'review-response',
    steps: [
      { name: 'on: new_review', type: 'trigger' },
      { name: 'analyze_sentiment', type: 'action' },
      { name: 'if: negative', type: 'condition' },
      { name: 'escalate_to_owner', type: 'action' },
    ],
  },
  {
    id: '2',
    name: 'weekly-report',
    steps: [
      { name: 'on: schedule(friday 17:00)', type: 'trigger' },
      { name: 'collect_metrics', type: 'action' },
      { name: 'generate_summary', type: 'action' },
      { name: 'send_to_slack', type: 'action' },
    ],
  },
  {
    id: '3',
    name: 'content-pipeline',
    steps: [
      { name: 'on: manual_trigger', type: 'trigger' },
      { name: 'draft_posts', type: 'action' },
      { name: 'if: approved', type: 'condition' },
      { name: 'schedule_publish', type: 'action' },
    ],
  },
]

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
  return (
    <div className="flex-1 overflow-y-auto p-8">
      <m.div variants={staggerContainer} initial="initial" animate="animate" className="flex flex-col gap-6">
        <m.div variants={staggerItem} className="flex flex-col gap-1">
          <h1 className="text-[22px] font-bold tracking-tight">{t('advanced.workflows_title')}</h1>
          <p className="text-[14px] text-muted-foreground">{t('advanced.workflows_subtitle')}</p>
        </m.div>

        <m.div variants={staggerContainer} initial="initial" animate="animate" className="flex flex-col gap-3">
          {mockWorkflows.map((wf) => (
            <m.div
              key={wf.id}
              variants={staggerItem}
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
            </m.div>
          ))}
        </m.div>
      </m.div>
    </div>
  )
}
