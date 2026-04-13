import { useState, useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { ListDetail, ListPanel } from '@/components/list-detail'
import { KvList } from '@/components/ui/kv-list'
import { RelationLink } from '@/components/ui/relation-link'
import { MetaToken } from '@/components/ui/meta-token'
import { DetailSection } from '@/components/ui/detail-section'
import { useSchedules } from '@/hooks/use-schedules'
import { useWorkflows } from '@/hooks/use-workflows'
import { useScripts } from '@/hooks/use-scripts'
import type { Workflow, WorkflowStepType, Schedule, Script } from '@/api/types'

const workflowsSearchSchema = z.object({
  workflowId: z.string().optional(),
})

export const Route = createFileRoute('/_app/workflows')({
  component: WorkflowsPage,
  validateSearch: (search) => workflowsSearchSchema.parse(search),
})

// ── Step type styling ──

const STEP_TYPE_I18N_KEYS: Record<WorkflowStepType, string> = {
  agent: 'workflows.step_type_agent',
  human_approval: 'workflows.step_type_human_approval',
  wait_for_children: 'workflows.step_type_wait_for_children',
  done: 'workflows.step_type_done',
}

const STEP_TYPE_COLORS: Record<WorkflowStepType, string> = {
  agent: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
  human_approval: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  wait_for_children: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
  done: 'border-green-500/30 bg-green-500/10 text-green-400',
}

// ── Workflow Row ──

function WorkflowRow({
  workflow,
  selected,
  onClick,
}: {
  workflow: Workflow
  selected: boolean
  onClick: () => void
}) {
  const { t } = useTranslation()
  const stepCount = workflow.steps.length
  const hasApproval = workflow.steps.some((s) => s.type === 'human_approval')

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between gap-3 border-b border-border/50 border-l-3 border-l-blue-500 px-3 py-2.5 text-left transition-colors',
        selected ? 'bg-muted/30' : 'hover:bg-muted/20',
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span
          className="mt-[7px] block size-1.5 shrink-0 rounded-full bg-blue-500"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-foreground">{workflow.name}</div>
          <div className="truncate text-[12px] text-muted-foreground">{workflow.description}</div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="font-heading text-[11px] text-muted-foreground">
              {t('workflows.step_count', { count: stepCount })}
            </span>
            {hasApproval && (
              <span className="font-heading text-[11px] text-amber-400">{t('workflows.has_approval')}</span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

// ── Workflow Detail ──

interface WorkflowDetailData {
  workflow: Workflow
  schedules: Schedule[]
  scripts: Script[]
}

function WorkflowDetail({ data }: { data: WorkflowDetailData }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { workflow, schedules, scripts } = data

  // FE-derived: schedules that reference this workflow (derived from schedule.workflow_id)
  const linkedSchedules = schedules.filter((s) => s.workflow_id === workflow.id)

  // FE-derived: scripts referenced by step actions (script_ref kind)
  const scriptRefsUsed = workflow.steps.flatMap((step) =>
    step.actions
      .filter((a) => 'kind' in a && a.kind === 'script_ref')
      .map((a) => {
        const scriptId = 'script_id' in a && typeof a.script_id === 'string' ? a.script_id : null
        const script = scriptId ? scripts.find((scr) => scr.id === scriptId) : undefined
        return { scriptId, scriptName: script?.name ?? scriptId ?? 'unknown' }
      }),
  )

  return (
    <div className="flex flex-col">
      {/* Header */}
      <DetailSection>
        <h2 className="text-[18px] font-medium text-foreground">{workflow.name}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <MetaToken mono>{workflow.id}</MetaToken>
          {workflow.workspace && (
            <MetaToken>{workflow.workspace.mode}</MetaToken>
          )}
        </div>
      </DetailSection>

      {/* Description */}
      <DetailSection title={t('workflows.description')}>
        <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{workflow.description}</p>
      </DetailSection>

      {/* Steps */}
      {workflow.steps.length > 0 && (
        <DetailSection title={t('workflows.steps')}>
          <div className="mt-3 flex flex-col">
            {workflow.steps.map((step, idx) => (
              <div
                key={step.id}
                className={cn(
                  'flex items-start gap-3 py-2.5',
                  idx < workflow.steps.length - 1 && 'border-b border-border/20',
                )}
              >
                <div className="flex w-5 shrink-0 items-center justify-center pt-0.5">
                  <span className="font-heading text-[11px] text-muted-foreground">{idx + 1}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-foreground">{step.name ?? step.id}</span>
                    <MetaToken
                      variant="outline"
                      className={STEP_TYPE_COLORS[step.type]}
                    >
                      {t(STEP_TYPE_I18N_KEYS[step.type])}
                    </MetaToken>
                    {step.approvers.length > 0 && (
                      <span className="font-heading text-[10px] text-amber-400">
                        {step.approvers.join(', ')}
                      </span>
                    )}
                  </div>
                  {step.instructions && (
                    <p className="mt-0.5 text-[12px] text-muted-foreground">{step.instructions}</p>
                  )}
                  {step.agent_id && (
                    <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground/50">{step.agent_id}</span>
                  )}
                  {step.actions.length > 0 && (
                    <span className="mt-1 block font-heading text-[10px] text-muted-foreground/50">
                      {step.actions.length}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DetailSection>
      )}

      {/* Linked schedules (FE-derived from schedule.workflow_id) */}
      {linkedSchedules.length > 0 && (
        <DetailSection title={t('workflows.linked_schedules')}>
          <div className="mt-3 flex flex-col gap-1">
            {linkedSchedules.map((s) => (
              <RelationLink
                key={s.id}
                label={s.name}
                sublabel={s.cron}
                onClick={() => void navigate({ to: '/automations', search: { scheduleId: s.id } })}
              />
            ))}
          </div>
        </DetailSection>
      )}

      {/* Scripts used (FE-derived from step actions) */}
      {scriptRefsUsed.length > 0 && (
        <DetailSection title={t('workflows.linked_scripts')}>
          <div className="mt-3 flex flex-col gap-1">
            {scriptRefsUsed.map((s) => (
              <RelationLink
                key={s.scriptId}
                label={s.scriptName}
                sublabel={s.scriptId ?? undefined}
                onClick={s.scriptId
                  ? () => void navigate({ to: '/scripts', search: { scriptId: s.scriptId ?? undefined } })
                  : undefined
                }
              />
            ))}
          </div>
        </DetailSection>
      )}

      {/* Metadata */}
      <DetailSection last title={t('workflows.metadata')}>
        <div className="mt-3">
          <KvList
            items={[
              { label: t('workflows.meta_steps'), value: `${workflow.steps.length}` },
              { label: t('workflows.meta_approvals'), value: `${workflow.steps.filter((s) => s.type === 'human_approval').length}` },
            ]}
          />
        </div>
      </DetailSection>
    </div>
  )
}

// ── Page ──

function WorkflowsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: workflows = [], isLoading: isLoadingWorkflows } = useWorkflows()
  const { data: scripts = [] } = useScripts()
  const { data: schedules = [] } = useSchedules()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { workflowId: deepLinkWorkflowId } = Route.useSearch()

  // Auto-select first
  useEffect(() => {
    if (workflows.length === 0) return
    if (selectedId !== null) return
    if (deepLinkWorkflowId && workflows.some((w) => w.id === deepLinkWorkflowId)) {
      setSelectedId(deepLinkWorkflowId)
      return
    }
    setSelectedId(workflows[0].id)
  }, [workflows, selectedId, deepLinkWorkflowId])

  const selectedWorkflow = selectedId ? (workflows.find((w) => w.id === selectedId) ?? null) : null
  const detailData = selectedWorkflow ? { workflow: selectedWorkflow, schedules, scripts } : null

  return (
    <ListDetail
      listSize={40}
      list={
        <ListPanel
          header={
            <PageHeader
              title={t('workflows.title')}
              subtitle={t('workflows.subtitle')}
            />
          }
        >
          {isLoadingWorkflows ? (
            <EmptyState
              title={t('workflows.empty_title')}
              description={t('workflows.empty_desc')}
            />
          ) : workflows.length === 0 ? (
            <EmptyState
              title={t('workflows.empty_title')}
              description={t('workflows.empty_desc')}
            />
          ) : (
            workflows.map((wf) => (
              <WorkflowRow
                key={wf.id}
                workflow={wf}
                selected={wf.id === selectedId}
                onClick={() => { setSelectedId(wf.id); void navigate({ to: '/workflows', search: { workflowId: wf.id }, replace: true }) }}
              />
            ))
          )}
        </ListPanel>
      }
      detail={
        detailData ? (
          <WorkflowDetail data={detailData} />
        ) : (
          <EmptyState
            title={t('workflows.select')}
            description={t('workflows.select_desc')}
          />
        )
      }
    />
  )
}
