import { useState, useEffect } from 'react'
import { z } from 'zod'
import { PlusIcon } from '@phosphor-icons/react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { ListDetail, ListPanel } from '@/components/list-detail'
import { StatusPill } from '@/components/ui/status-pill'
import { KvList } from '@/components/ui/kv-list'
import { Timeline, type TimelineEvent } from '@/components/ui/timeline'
import { RelationLink } from '@/components/ui/relation-link'
import { FilterTabs } from '@/components/ui/filter-tabs'
import { MetaToken } from '@/components/ui/meta-token'
import { DetailSection } from '@/components/ui/detail-section'
import { FileViewer } from '@/components/file-viewer'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { taskStatusToPill, taskStatusBorder, taskStatusDot } from '@/lib/status-colors'
import {
  WizardDialog,
  WizardField,
  wizardTextareaClass,
} from '@/components/wizard-dialog'
import { useChatSeedStore } from '@/stores/chat-seed.store'
import { useTasks, useTaskDetail, useTaskActivity, useTaskArtifacts, useApproveTask, useRejectTask } from '@/hooks/use-tasks'
import { useWorkflows } from '@/hooks/use-workflows'
import type { Task, TaskWithRelations, Run, RunEvent, Artifact, Workflow, ActivityEntry } from '@/api/types'
import { parseRunEventMetadata, parseTaskContext } from '@/api/parse'

const tasksSearchSchema = z.object({
  taskId: z.string().optional(),
})

export const Route = createFileRoute('/_app/tasks')({
  component: TasksPage,
  validateSearch: (search) => tasksSearchSchema.parse(search),
})

// ── UI View Models (derived from backend types) ──

type StepStatus = 'done' | 'waiting' | 'running' | 'pending' | 'failed' | 'skipped'

interface StepRun {
  id: string
  status: string
  duration: string
  summary: string
}

interface StepFeedback {
  kind: 'approval_requested' | 'approval_approved' | 'approval_rejected'
  time: string
  who: string
  message: string
}

interface StepArtifact {
  id: string
  filename: string
  kind: string
  type: string
  ref_kind: string
  ref_value: string
  partial?: boolean
}

interface StepInstance {
  id: string
  stepName: string
  revision: number
  status: StepStatus
  duration: string | null
  summary: string | null
  actor: string
  approvalApprover: string | null
  runs: StepRun[]
  feedback: StepFeedback[]
  artifacts: StepArtifact[]
}

interface TaskRelation {
  kind: 'parent' | 'blocked_by' | 'blocking' | 'source' | 'schedule' | 'workflow'
  label: string
  sublabel?: string
}

interface TaskViewModel {
  id: string
  title: string
  description: string
  status: string
  source: { type: 'conversation' | 'schedule'; label: string; id?: string }
  error?: string
  depends_on?: string[]
  created_at: string
  steps: StepInstance[]
  relations: TaskRelation[]
  activity: TimelineEvent[]
  allArtifacts: StepArtifact[]
}

// ── Transform: Build revision tree from Task + Runs + RunEvents ──

function formatDuration(startedAt: string | null, endedAt: string | null): string | null {
  if (!startedAt || !endedAt) return null
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime()
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainSeconds = seconds % 60
  return `${minutes}m ${remainSeconds}s`
}

function runStatusToStepStatus(run: Run): StepStatus {
  switch (run.status) {
    case 'completed':
      return 'done'
    case 'running':
    case 'claimed':
      return 'running'
    case 'failed':
      return 'failed'
    case 'pending':
      return 'pending'
  }
}

function deriveStepStatusFromEvents(events: RunEvent[], stepName: string, revision: number): StepStatus | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const evt = events[i]
    const data = parseRunEventMetadata(evt)
    if (typeof data.step === 'string' && data.step === stepName) {
      const evtRevision = typeof data.revision === 'number' ? data.revision : revision
      if (evtRevision !== revision) continue

      if (evt.type === 'step_completed') return 'done'
      if (evt.type === 'step_failed') return 'failed'
      if (evt.type === 'step_started') return 'running'
      if (evt.type === 'approval_requested') return 'waiting'
      if (evt.type === 'approval_rejected') return 'done'
    }
  }
  return null
}

function artifactTypeLabel(mimeType: string | null, filename: string): string {
  if (mimeType) {
    if (mimeType.includes('markdown')) return 'MD'
    if (mimeType.includes('csv')) return 'CSV'
    if (mimeType.includes('html')) return 'HTML'
    if (mimeType.includes('pdf')) return 'PDF'
    if (mimeType.includes('plain')) return 'TXT'
  }
  return filename.split('.').pop()?.toUpperCase() ?? 'FILE'
}

function buildStepArtifact(a: Artifact): StepArtifact {
  const parsed = (() => { try { return JSON.parse(a.metadata) as Record<string, unknown> } catch { return {} } })()
  return {
    id: a.id,
    filename: a.title,
    kind: a.kind,
    type: artifactTypeLabel(a.mime_type, a.title),
    ref_kind: a.ref_kind,
    ref_value: a.ref_value,
    partial: parsed.partial === true,
  }
}

function buildRevisionTree(task: Task, runs: Run[], events: RunEvent[], artifacts: Artifact[], locale: string): StepInstance[] {
  const steps: StepInstance[] = []

  // Group events by step name + revision to build the tree
  const stepMap = new Map<string, { stepName: string; revision: number; events: RunEvent[]; runs: Run[] }>()

  // Derive steps from events
  for (const evt of events) {
    const data = parseRunEventMetadata(evt)
    if (typeof data.step !== 'string') continue
    const stepName = data.step
    const revision = typeof data.revision === 'number' ? data.revision : 1
    const key = `${stepName}:${revision}`

    let entry = stepMap.get(key)
    if (!entry) {
      entry = { stepName, revision, events: [], runs: [] }
      stepMap.set(key, entry)
    }
    entry.events.push(evt)
  }

  // Associate runs with steps via their events
  for (const run of runs) {
    const runEvents = events.filter((e) => e.run_id === run.id)
    for (const evt of runEvents) {
      const data = parseRunEventMetadata(evt)
      if (typeof data.step !== 'string') continue
      const stepName = data.step
      const revision = typeof data.revision === 'number' ? data.revision : 1
      const key = `${stepName}:${revision}`
      const entry = stepMap.get(key)
      if (entry && !entry.runs.some((r) => r.id === run.id)) {
        entry.runs.push(run)
      }
    }
  }

  // If no events exist, derive a simpler tree from runs alone
  if (stepMap.size === 0 && runs.length > 0) {
    const currentStep = task.workflow_step ?? 'run'
    for (let i = 0; i < runs.length; i++) {
      const run = runs[i]
      const duration = formatDuration(run.started_at, run.ended_at)
      const runArtifacts = artifacts.filter((a) => a.run_id === run.id).map(buildStepArtifact)
      steps.push({
        id: `step_${i}`,
        stepName: currentStep,
        revision: i + 1,
        status: runStatusToStepStatus(run),
        duration: duration ?? (run.status === 'running' ? `${Math.floor((Date.now() - new Date(run.started_at ?? run.created_at).getTime()) / 60000)}m+` : null),
        summary: run.summary,
        actor: 'agent',
        approvalApprover: null,
        runs: [{
          id: run.id,
          status: run.status === 'completed' ? 'done' : run.status,
          duration: duration ?? '—',
          summary: run.summary ?? run.error ?? '',
        }],
        feedback: [],
        artifacts: runArtifacts,
      })
    }
    return steps
  }

  // Build steps from the map in chronological order
  const sortedKeys = Array.from(stepMap.entries()).sort((a, b) => {
    const aFirst = a[1].events[0]?.created_at ?? ''
    const bFirst = b[1].events[0]?.created_at ?? ''
    return aFirst.localeCompare(bFirst)
  })

  for (const [, entry] of sortedKeys) {
    const stepEvents = entry.events
    const status = deriveStepStatusFromEvents(events, entry.stepName, entry.revision) ?? 'pending'

    // Extract feedback from approval events (requested, approved, rejected)
    const feedback: StepFeedback[] = []
    for (const evt of stepEvents) {
      const data = parseRunEventMetadata(evt)
      if (evt.type === 'approval_requested') {
        feedback.push({
          kind: 'approval_requested',
          time: new Date(evt.created_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
          who: typeof data.approver === 'string' ? data.approver : '',
          message: '',
        })
      } else if (evt.type === 'approval_approved') {
        feedback.push({
          kind: 'approval_approved',
          time: new Date(evt.created_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
          who: typeof data.by === 'string' ? data.by : 'User',
          message: '',
        })
      } else if (evt.type === 'approval_rejected') {
        feedback.push({
          kind: 'approval_rejected',
          time: new Date(evt.created_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
          who: typeof data.by === 'string' ? data.by : 'User',
          message: typeof data.message === 'string' ? data.message : '',
        })
      }
    }

    // Build step runs
    const stepRuns: StepRun[] = entry.runs.map((run) => ({
      id: run.id,
      status: run.status === 'completed' ? 'done' : run.status,
      duration: formatDuration(run.started_at, run.ended_at) ?? '—',
      summary: run.summary ?? run.error ?? '',
    }))

    // Determine actor
    const isHumanStep = stepEvents.some((e) => e.type === 'approval_requested' || e.type === 'approval_approved' || e.type === 'approval_rejected')
    const approvalReqEvt = stepEvents.find((e) => e.type === 'approval_requested')
    const approvalApprover = approvalReqEvt
      ? (typeof parseRunEventMetadata(approvalReqEvt).approver === 'string' ? parseRunEventMetadata(approvalReqEvt).approver as string : null)
      : null
    const firstRejection = stepEvents.find((e) => e.type === 'approval_rejected')
    const actor = isHumanStep
      ? (firstRejection && typeof parseRunEventMetadata(firstRejection).by === 'string' ? parseRunEventMetadata(firstRejection).by as string : '')
      : entry.runs.length > 0 ? 'agent' : ''

    // Duration from run or events
    let duration: string | null = null
    if (entry.runs.length > 0) {
      const lastRun = entry.runs[entry.runs.length - 1]
      duration = formatDuration(lastRun.started_at, lastRun.ended_at)
      if (!duration && lastRun.status === 'running') {
        const elapsed = Math.floor((Date.now() - new Date(lastRun.started_at ?? lastRun.created_at).getTime()) / 60000)
        duration = `${elapsed}m+`
      }
    }

    // Artifacts: collect all artifacts for runs in this step
    const stepArtifacts: StepArtifact[] = entry.runs
      .flatMap((run) => artifacts.filter((a) => a.run_id === run.id))
      .map(buildStepArtifact)

    steps.push({
      id: `step_${entry.stepName}_r${entry.revision}`,
      stepName: entry.stepName,
      revision: entry.revision,
      status,
      duration,
      summary: entry.runs.length > 0 ? (entry.runs[entry.runs.length - 1].summary ?? null) : null,
      actor,
      approvalApprover,
      runs: stepRuns,
      feedback,
      artifacts: stepArtifacts,
    })
  }

  // Add pending steps for current workflow_step if not already present
  if (task.workflow_step) {
    const hasCurrentStep = steps.some((s) => s.stepName === task.workflow_step)
    if (!hasCurrentStep && task.status !== 'completed' && task.status !== 'failed') {
      steps.push({
        id: `step_${task.workflow_step}_pending`,
        stepName: task.workflow_step,
        revision: 1,
        status: task.status === 'waiting_for_human_approval' ? 'waiting' : 'pending',
        duration: null,
        summary: null,
        actor: '',
        approvalApprover: null,
        runs: [],
        feedback: [],
        artifacts: [],
      })
    }
  }

  return steps
}

function buildActivityFromTaskActivity(entries: ActivityEntry[], _t: (key: string, opts?: Record<string, unknown>) => string, locale: string): TimelineEvent[] {
  return entries.map((entry) => {
    const time = new Date(entry.created_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    let variant: TimelineEvent['variant'] = undefined

    switch (entry.type) {
      case 'approval':
        variant = 'success'
        break
      case 'rejection':
        variant = 'warning'
        break
      case 'escalation':
        variant = 'error'
        break
    }

    return { time, label: entry.summary, variant }
  })
}

function buildRelations(taskWithRelations: TaskWithRelations, workflows: Workflow[], t: (key: string, opts?: Record<string, unknown>) => string): TaskRelation[] {
  const relations: TaskRelation[] = []

  for (const parent of taskWithRelations.parents) {
    relations.push({ kind: 'parent', label: parent.title, sublabel: parent.id })
  }
  for (const dep of taskWithRelations.dependencies) {
    relations.push({ kind: 'blocked_by', label: dep.title, sublabel: dep.id })
  }
  for (const dep of taskWithRelations.dependents) {
    relations.push({ kind: 'blocking', label: dep.title, sublabel: dep.id })
  }

  if (taskWithRelations.workflow_id) {
    const wf = workflows.find((w) => w.id === taskWithRelations.workflow_id)
    relations.push({
      kind: 'workflow',
      label: wf ? wf.name : taskWithRelations.workflow_id,
      sublabel: taskWithRelations.workflow_id,
    })
  }

  if (taskWithRelations.scheduled_by) {
    relations.push({ kind: 'schedule', label: taskWithRelations.scheduled_by })
  }
  const taskContext = parseTaskContext(taskWithRelations)
  if (taskContext.source_conversation) {
    relations.push({ kind: 'source', label: t('tasks.source_conversation_label', { id: String(taskContext.source_conversation) }) })
  }

  return relations
}

function taskToViewModel(
  taskWithRelations: TaskWithRelations,
  activity: ActivityEntry[],
  artifacts: Artifact[],
  workflows: Workflow[],
  t: (key: string, opts?: Record<string, unknown>) => string,
  locale: string,
): TaskViewModel {
  const task = taskWithRelations
  const runs = taskWithRelations.runs

  const context = parseTaskContext(taskWithRelations)
  const source: TaskViewModel['source'] = task.scheduled_by
    ? { type: 'schedule', label: task.scheduled_by, id: task.scheduled_by }
    : { type: 'conversation', label: typeof context.source_conversation === 'string' ? context.source_conversation : task.title }

  // Pass empty events — run events are workerAuth-only, not available from FE.
  // buildRevisionTree falls back to runs-only mode when events are empty.
  const steps = buildRevisionTree(task, runs, [], artifacts, locale)
  const allArtifacts = steps.flatMap((s) => s.artifacts)

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    source,
    error: runs.find((r) => r.error)?.error ?? undefined,
    created_at: task.created_at,
    steps,
    relations: buildRelations(taskWithRelations, workflows, t),
    activity: buildActivityFromTaskActivity(activity, t, locale),
    allArtifacts,
  }
}

// ── Status mapping — delegated to shared status-colors ──

const apiStatusToPill = taskStatusToPill
const statusBorderColor = taskStatusBorder
const statusDotColor = taskStatusDot

function stepDotColor(status: StepStatus): string {
  switch (status) {
    case 'done':
      return 'bg-green-500'
    case 'waiting':
      return 'bg-amber-500'
    case 'running':
      return 'bg-blue-500'
    case 'failed':
      return 'bg-red-500'
    case 'pending':
    case 'skipped':
      return 'bg-zinc-400'
  }
}

function stepStatusColor(status: StepStatus): string {
  switch (status) {
    case 'done':
      return 'text-green-500'
    case 'waiting':
      return 'text-amber-500'
    case 'running':
      return 'text-blue-500'
    case 'failed':
      return 'text-red-500'
    case 'pending':
    case 'skipped':
      return 'text-muted-foreground'
  }
}

// ── Filter types ──

type FilterKey = 'all' | 'needs-input' | 'working' | 'blocked' | 'done'

const FILTER_KEYS: FilterKey[] = ['all', 'needs-input', 'working', 'blocked', 'done']

const FILTER_TO_API_STATUS: Record<FilterKey, string[] | null> = {
  all: null,
  'needs-input': ['waiting_for_human_approval'],
  working: ['running'],
  blocked: ['blocked'],
  done: ['completed', 'failed'],
}

const FILTER_LABEL_KEYS: Record<FilterKey, string> = {
  all: 'tasks.filter_all',
  'needs-input': 'tasks.filter_needs_input',
  working: 'tasks.filter_working',
  blocked: 'tasks.filter_blocked',
  done: 'tasks.filter_done',
}

// ── Helpers ──

function sourceLabel(source: TaskViewModel['source'], t: (key: string) => string): string {
  if (source.type === 'conversation') {
    return t('tasks.source_conversation')
  }
  return `${t('tasks.source_schedule')} ${source.id ?? ''}`
}

function relationKindLabel(kind: TaskRelation['kind'], t: (key: string) => string): string {
  switch (kind) {
    case 'parent':
      return t('tasks.rel_parent')
    case 'blocked_by':
      return t('tasks.rel_blocked_by')
    case 'blocking':
      return t('tasks.rel_blocking')
    case 'source':
      return t('tasks.rel_source')
    case 'schedule':
      return t('tasks.rel_schedule')
    case 'workflow':
      return t('tasks.rel_workflow')
  }
}

function stepStatusLabel(status: StepStatus, t: (key: string) => string): string {
  switch (status) {
    case 'done':
      return t('tasks.step_done')
    case 'waiting':
      return t('tasks.step_waiting')
    case 'running':
      return t('tasks.step_running')
    case 'pending':
      return t('tasks.step_pending')
    case 'failed':
      return t('tasks.step_failed')
    case 'skipped':
      return t('tasks.step_pending')
  }
}

/** Derive the current step label for the task row in the list */
function currentStepLabel(task: TaskViewModel): string {
  const current = task.steps.find((s) => s.status === 'waiting' || s.status === 'running')
  if (current) {
    return `${current.stepName}${current.revision > 1 ? ` r${current.revision}` : ''}`
  }
  const failed = task.steps.find((s) => s.status === 'failed')
  if (failed) {
    return failed.stepName
  }
  return task.status === 'completed' ? 'done' : '\u2014'
}

// ── Progress strip helpers ──

function progressStripText(task: TaskViewModel, t: (key: string) => string): string {
  if (task.status === 'blocked' && task.depends_on && task.depends_on.length > 0) {
    return t('tasks.blocked_waiting').replace('{{task}}', task.depends_on[0])
  }

  if (task.status === 'failed') {
    const failedStep = task.steps.find((s) => s.status === 'failed')
    if (failedStep) {
      const suffix = failedStep.summary ? ` \u00b7 ${failedStep.summary}` : ''
      return t('tasks.failed_at_step').replace('{{step}}', failedStep.stepName) + suffix
    }
    return t('tasks.failed_at_step').replace('{{step}}', '?')
  }

  if (task.status === 'completed') {
    return `${t('status.done')} \u00b7 ${t('tasks.completed_steps').replace('{{count}}', String(task.steps.length))}`
  }

  const current = task.steps.find((s) => s.status === 'waiting' || s.status === 'running')
  if (current) {
    const revSuffix = current.revision > 1 ? ` (${t('tasks.revision')} ${current.revision})` : ''
    const stepLabel = `${t('tasks.current_step')}: ${current.stepName}${revSuffix}`
    if (current.status === 'waiting') {
      return `${stepLabel} \u00b7 ${t('tasks.action_waiting')}`
    }
    return `${stepLabel} \u00b7 ${t('tasks.step_running')}`
  }

  return '\u2014'
}

function progressStripColor(task: TaskViewModel): string {
  switch (task.status) {
    case 'waiting_for_human_approval':
      return 'text-amber-500'
    case 'running':
      return 'text-blue-500'
    case 'completed':
      return 'text-green-500'
    case 'failed':
      return 'text-red-500'
    case 'blocked':
      return 'text-red-500'
    default:
      return 'text-muted-foreground'
  }
}

// ── Task Row ──

function TaskRow({
  task,
  selected,
  onClick,
}: {
  task: TaskViewModel
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between gap-3 border-b border-border/50 border-l-3 px-3 py-2.5 text-left transition-colors',
        statusBorderColor(task.status),
        selected ? 'bg-muted/30' : 'hover:bg-muted/20',
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span
          className={cn('mt-[7px] block size-1.5 shrink-0 rounded-full', statusDotColor(task.status))}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-foreground">{task.title}</div>
          <div className="truncate text-[12px] text-muted-foreground">{task.description}</div>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="font-mono text-[11px] text-muted-foreground">{currentStepLabel(task)}</span>
        <span className="font-mono text-[11px] text-muted-foreground/60">{task.id}</span>
      </div>
    </button>
  )
}

// ── Revision Tree ──

function RevisionTree({ steps, taskStatus }: { steps: StepInstance[]; taskStatus: string }) {
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null)
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="flex flex-col">
      {steps.map((step, idx) => {
        const isExpanded = expandedStepId === step.id
        const isCurrent = step.status === 'waiting' || step.status === 'running'
        const hasDetail = step.runs.length > 0 || step.feedback.length > 0 || step.artifacts.length > 0
        const isLast = idx === steps.length - 1
        const revLabel = step.revision > 1 ? ` (${t('tasks.revision')} ${step.revision})` : ''

        return (
          <div key={step.id}>
            {/* Step row */}
            <button
              type="button"
              onClick={() => {
                if (hasDetail) {
                  setExpandedStepId(isExpanded ? null : step.id)
                }
              }}
              className={cn(
                'flex w-full items-center gap-3 px-0 py-1.5 text-left transition-colors',
                !isLast && 'border-b border-border/20',
                isCurrent && 'bg-blue-500/5',
                isCurrent && taskStatus === 'waiting_for_human_approval' && 'bg-amber-500/5',
                hasDetail && 'cursor-pointer hover:bg-muted/20',
                !hasDetail && 'cursor-default',
              )}
            >
              {/* Tree line + dot */}
              <div className="flex w-5 shrink-0 items-center justify-center">
                <span
                  className={cn(
                    'block size-2 rounded-full',
                    stepDotColor(step.status),
                    step.status === 'running' && 'animate-pulse',
                  )}
                  aria-hidden="true"
                />
              </div>

              {/* Step name */}
              <span className={cn(
                'font-mono text-[12px] font-medium',
                isCurrent ? 'text-foreground' : step.status === 'done' ? 'text-muted-foreground' : 'text-muted-foreground/60',
              )}>
                {step.stepName}{revLabel}
              </span>

              {/* Right side: status + duration + actor */}
              <div className="ml-auto flex items-center gap-2">
                {isCurrent && (
                  <span className="font-mono text-[10px] text-muted-foreground/60">
                    {t('tasks.step_current')}
                  </span>
                )}
                <span className={cn('font-mono text-[11px]', stepStatusColor(step.status))}>
                  {stepStatusLabel(step.status, t)}
                </span>
                {step.duration && (
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {step.duration}
                  </span>
                )}
                {step.actor && (
                  <span className="font-mono text-[11px] text-muted-foreground/60">
                    {step.actor}
                  </span>
                )}
                {hasDetail && (
                  <span className="text-[10px] text-muted-foreground/40">
                    {isExpanded ? '\u25B4' : '\u25BE'}
                  </span>
                )}
              </div>
            </button>

            {/* Sub-detail indicators (collapsed: one-liners) */}
            {!isExpanded && (
              <StepSubHints step={step} isLast={isLast} navigate={navigate} />
            )}

            {/* Expanded detail */}
            {isExpanded && (
              <div className={cn(
                'ml-5 border-l border-border/30 pl-4 pb-2',
                !isLast && 'border-b border-border/20',
              )}>
                {/* Run history */}
                {step.runs.length > 0 && (
                  <div className="mt-1.5">
                    <div className="mb-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground/50">
                      {t('tasks.section_runs')}
                    </div>
                    {step.runs.map((run) => (
                      <div key={run.id} className="grid grid-cols-[max-content_max-content_1fr] items-baseline gap-x-2 py-0.5">
                        <span className={cn(
                          'font-mono text-[11px]',
                          run.status === 'failed' ? 'text-red-500' : run.status === 'done' ? 'text-green-500' : 'text-blue-500',
                        )}>
                          {run.status === 'done' ? 'done' : run.status}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {run.duration}
                        </span>
                        <span className={cn(
                          'truncate text-[12px]',
                          run.status === 'failed' ? 'text-red-400' : 'text-muted-foreground',
                        )}>
                          {run.summary || (run.status === 'failed' ? 'Run failed' : '')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Approval / feedback trail */}
                {step.feedback.length > 0 && (
                  <div className="mt-2">
                    <div className="mb-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground/50">
                      {t('tasks.section_approval_trail')}
                    </div>
                    {step.feedback.map((fb, i) => (
                      <div key={i} className="grid grid-cols-[50px_max-content_max-content_1fr] items-baseline gap-x-2 py-0.5">
                        <span className="font-mono text-[10px] text-muted-foreground">{fb.time}</span>
                        <span className={cn(
                          'font-mono text-[10px] font-medium',
                          fb.kind === 'approval_requested' ? 'text-amber-400' : fb.kind === 'approval_approved' ? 'text-green-500' : 'text-amber-500',
                        )}>
                          {fb.kind === 'approval_requested' ? 'requested' : fb.kind === 'approval_approved' ? 'approved' : 'returned'}
                        </span>
                        {fb.who && <span className="text-[11px] font-medium text-foreground/80">{fb.who}</span>}
                        {fb.message && (
                          <span className="text-[11px] text-muted-foreground">&ldquo;{fb.message}&rdquo;</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Outputs / artifacts */}
                {step.artifacts.length > 0 && (
                  <div className="mt-2">
                    <div className="mb-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground/50">
                      {t('tasks.section_outputs')}
                    </div>
                    {step.artifacts.map((art) => (
                      <div key={art.id} className="flex items-center gap-2 py-0.5">
                        <span className="rounded-none bg-muted/40 px-1 py-px font-mono text-[10px] text-muted-foreground">
                          {art.type}
                        </span>
                        <span className={cn(
                          'text-[12px]',
                          art.partial ? 'text-amber-400' : 'text-foreground',
                        )}>
                          {art.filename}
                          {art.partial && <span className="ml-1 text-[10px] text-amber-400/70">(partial)</span>}
                        </span>
                        <button
                          type="button"
                          onClick={() => void navigate({ to: '/files', search: { path: art.ref_value, scope: 'workspace' } })}
                          className="ml-auto font-mono text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                        >
                          {t('tasks.view_in_files')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Inline sub-hints shown below a step row when collapsed */
function StepSubHints({ step, isLast, navigate }: { step: StepInstance; isLast: boolean; navigate: ReturnType<typeof useNavigate> }) {
  const hasFailedRuns = step.runs.some((r) => r.status === 'failed')
  const hasFeedback = step.feedback.length > 0
  const hasArtifacts = step.artifacts.length > 0

  if (!hasFailedRuns && !hasFeedback && !hasArtifacts) return null

  return (
    <div className={cn(
      'ml-5 border-l border-border/30 pl-4 pb-1.5',
      !isLast && 'border-b border-border/20',
    )}>
      {hasFailedRuns && step.runs.filter((r) => r.status === 'failed').map((run) => (
        <div key={run.id} className="font-mono text-[11px] text-red-500/80 py-0.5">
          {run.summary || 'Run failed'}
        </div>
      ))}
      {hasFeedback && step.feedback
        .filter((fb) => fb.kind === 'approval_rejected')
        .map((fb, i) => (
          <div key={i} className="flex items-baseline gap-1.5 py-0.5">
            <span className="text-[10px] text-amber-500">returned</span>
            <span className="text-[11px] font-medium text-foreground/80">{fb.who}</span>
            {fb.message && <span className="truncate text-[11px] text-muted-foreground">&ldquo;{fb.message}&rdquo;</span>}
          </div>
        ))
      }
      {hasFeedback && step.feedback
        .filter((fb) => fb.kind === 'approval_approved')
        .map((fb, i) => (
          <div key={i} className="flex items-baseline gap-1.5 py-0.5">
            <span className="text-[10px] text-green-500">approved</span>
            <span className="text-[11px] font-medium text-foreground/80">{fb.who}</span>
          </div>
        ))
      }
      {hasArtifacts && (
        <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
          {step.artifacts.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                void navigate({ to: '/files', search: { path: a.ref_value, scope: 'workspace' } })
              }}
              className="flex items-center gap-1 text-[11px] text-muted-foreground/70 hover:text-muted-foreground transition-colors"
            >
              <span className="rounded-none bg-muted/30 px-1 py-px font-mono text-[10px]">{a.type}</span>
              <span>{a.filename}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Artifact type label helper ──

function artifactKindLabel(kind: string): string {
  switch (kind) {
    case 'doc': return 'doc'
    case 'diff_summary': return 'diff'
    case 'changed_file': return 'file'
    case 'test_report': return 'test'
    case 'validation_report': return 'valid'
    case 'implementation_prompt': return 'code'
    case 'preview_file': return 'preview'
    case 'preview_url': return 'url'
    case 'other': return 'file'
    default: return kind.slice(0, 5)
  }
}

// ── Artifact preview row ──

function ArtifactPreviewRow({
  art,
  t,
  navigate,
}: {
  art: StepArtifact
  t: (key: string) => string
  navigate: ReturnType<typeof useNavigate>
}) {
  const [expanded, setExpanded] = useState(false)
  const canPreview = art.ref_kind === 'inline' && art.ref_value.length > 0

  return (
    <div className="flex flex-col gap-0">
      <div className="flex items-center gap-2 py-0.5">
        <MetaToken mono className="px-1 py-px text-[10px] opacity-50">{artifactKindLabel(art.kind)}</MetaToken>
        <MetaToken mono className="px-1 py-px text-[10px]">{art.type}</MetaToken>
        <span className={cn(
          'min-w-0 flex-1 truncate text-[12px]',
          art.partial ? 'text-amber-400' : 'text-foreground',
        )}>
          {art.filename}
          {art.partial && <span className="ml-1 text-[10px] text-amber-400/70">(partial)</span>}
        </span>
        {canPreview && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 font-mono text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          >
            {expanded ? t('tasks.hide_preview') : t('tasks.preview')}
          </button>
        )}
        {art.ref_kind === 'file' && (
          <button
            type="button"
            onClick={() => void navigate({ to: '/files', search: { path: art.ref_value, scope: 'workspace' } })}
            className="shrink-0 font-mono text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          >
            {t('tasks.inspect_output')}
          </button>
        )}
      </div>
      {expanded && canPreview && (
        <div className="mt-1 overflow-hidden border border-border/50">
          <FileViewer
            path={art.filename}
            content={art.ref_value}
            mime={art.type === 'MD' ? 'text/markdown' : undefined}
            className="max-h-[320px]"
          />
        </div>
      )}
    </div>
  )
}

// ── Task Detail ──

function TaskDetail({ task, onApprove, onReject }: { task: TaskViewModel; onApprove: (taskId: string) => void; onReject: (taskId: string, message: string) => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [auditOpen, setAuditOpen] = useState(false)
  const [rejectMode, setRejectMode] = useState(false)
  const [rejectMessage, setRejectMessage] = useState('')

  // Find the step awaiting approval (for context in the action box)
  const waitingStep = task.steps.find((s) => s.status === 'waiting')
  const rejectionHistory = task.steps.flatMap((s) => s.feedback.filter((f) => f.kind === 'approval_rejected'))

  return (
    <div className="flex flex-col">
      {/* Header */}
      <DetailSection>
        <h2 className="text-[18px] font-medium text-foreground">{task.title}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusPill
            status={apiStatusToPill(task.status)}
            pulse={task.status === 'running'}
          />
          <MetaToken mono>{sourceLabel(task.source, t)}</MetaToken>
          <MetaToken mono>{task.id}</MetaToken>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{task.description}</p>
        {task.error && (
          <p className="mt-1.5 text-[12px] text-red-500">
            {t('tasks.error_label')}: {task.error}
          </p>
        )}
      </DetailSection>

      {/* 1. Current progress strip */}
      <DetailSection className="py-2">
        <span className={cn('font-mono text-[12px]', progressStripColor(task))}>
          {progressStripText(task, t)}
        </span>
      </DetailSection>

      {/* 2. Approval action section (only for waiting_for_human_approval) */}
      {task.status === 'waiting_for_human_approval' && (
        <DetailSection>
          <div className="border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <p className="text-[13px] font-medium text-foreground">
              {t('tasks.action_waiting')}
              {waitingStep && (
                <span className="ml-2 font-mono text-[12px] text-amber-400/80">
                  — {waitingStep.stepName}{waitingStep.revision > 1 ? ` (${t('tasks.revision')} ${waitingStep.revision})` : ''}
                </span>
              )}
            </p>
            {waitingStep?.approvalApprover && (
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                {t('tasks.approval_for')}: <span className="font-medium text-foreground/80">{waitingStep.approvalApprover}</span>
              </p>
            )}
            {/* Prior rejection context */}
            {rejectionHistory.length > 0 && (
              <div className="mt-2 border-t border-amber-500/10 pt-2">
                <p className="mb-1 font-mono text-[10px] uppercase text-muted-foreground/50">{t('tasks.prior_returns')}</p>
                {rejectionHistory.map((fb, i) => (
                  <div key={i} className="flex items-baseline gap-2 text-[12px]">
                    <span className="font-mono text-[10px] text-muted-foreground">{fb.time}</span>
                    <span className="font-medium text-foreground/80">{fb.who}</span>
                    {fb.message && <span className="text-amber-400/80">&ldquo;{fb.message}&rdquo;</span>}
                  </div>
                ))}
              </div>
            )}
            {/* Outputs available for review */}
            {waitingStep && waitingStep.artifacts.length > 0 && (
              <div className="mt-2 border-t border-amber-500/10 pt-2">
                <p className="mb-1 font-mono text-[10px] uppercase text-muted-foreground/50">{t('tasks.outputs_for_review')}</p>
                <div className="flex flex-col gap-2">
                  {waitingStep.artifacts.map((art) => (
                    <ArtifactPreviewRow key={art.id} art={art} t={t} navigate={navigate} />
                  ))}
                </div>
              </div>
            )}
            {rejectMode ? (
              <div className="mt-3 flex flex-col gap-2">
                <textarea
                  value={rejectMessage}
                  onChange={(e) => setRejectMessage(e.currentTarget.value)}
                  placeholder={t('tasks.reject_placeholder')}
                  className="min-h-[60px] w-full resize-none border border-border bg-input/30 px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-amber-500/30 text-amber-600 hover:border-amber-500 hover:bg-amber-500/5"
                    onClick={() => {
                      onReject(task.id, rejectMessage)
                      setRejectMode(false)
                      setRejectMessage('')
                    }}
                  >
                    {t('tasks.action_return')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setRejectMode(false)
                      setRejectMessage('')
                    }}
                  >
                    {t('wizard.cancel')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2">
                <Button
                  size="sm"
                  className="bg-green-600 text-white hover:bg-green-700"
                  onClick={() => onApprove(task.id)}
                >
                  {t('tasks.action_approve')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-500/30 text-amber-600 hover:border-amber-500 hover:bg-amber-500/5"
                  onClick={() => setRejectMode(true)}
                >
                  {t('tasks.action_return')}
                </Button>
              </div>
            )}
          </div>
        </DetailSection>
      )}

      {/* 3. Revision tree */}
      <DetailSection title={t('tasks.section_progress')}>
        <div className="mt-3">
          <RevisionTree steps={task.steps} taskStatus={task.status} />
        </div>
      </DetailSection>

      {/* 4. Outputs section — all artifacts grouped across steps */}
      {task.allArtifacts.length > 0 && (
        <DetailSection
          title={t('tasks.section_outputs')}
          action={
            <button
              type="button"
              onClick={() => void navigate({
                to: '/files',
                search: {
                  path: task.allArtifacts[0]?.ref_value,
                  scope: 'workspace',
                },
              })}
              className="font-heading text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('tasks.open_related_files')}
            </button>
          }
        >
          <div className="mt-2 flex flex-col gap-2">
            {task.allArtifacts.map((art) => (
              <ArtifactPreviewRow key={art.id} art={art} t={t} navigate={navigate} />
            ))}
          </div>
        </DetailSection>
      )}

      {/* 5. Relations */}
      {task.relations.length > 0 && (
        <DetailSection title={t('tasks.section_relations')}>
          <div className="mt-3">
            <KvList
              items={task.relations.map((rel) => ({
                label: relationKindLabel(rel.kind, t),
                value: <RelationLink
                  label={rel.label}
                  sublabel={rel.sublabel}
                  onClick={() => {
                    if (rel.kind === 'schedule') {
                      void navigate({ to: '/automations', search: { scheduleId: rel.label } })
                    } else if (rel.kind === 'parent' || rel.kind === 'blocked_by' || rel.kind === 'blocking') {
                      void navigate({ to: '/tasks', search: { taskId: rel.sublabel ?? '' } })
                    } else if (rel.kind === 'workflow') {
                      void navigate({ to: '/workflows', search: { workflowId: rel.sublabel ?? '' } })
                    }
                  }}
                />,
              }))}
            />
          </div>
        </DetailSection>
      )}

      {/* 6. Audit log (collapsed by default) */}
      {task.activity.length > 0 && (
        <DetailSection
          last
          title={t('tasks.section_activity')}
          action={
            <button
              type="button"
              onClick={() => setAuditOpen(!auditOpen)}
              className="font-heading text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {auditOpen ? t('tasks.hide_audit') : t('tasks.show_audit')}
            </button>
          }
        >
          {auditOpen && (
            <div className="mt-3">
              <Timeline events={task.activity} />
            </div>
          )}
        </DetailSection>
      )}
    </div>
  )
}

// ── Page ──

function TasksPage() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [taskPrompt, setTaskPrompt] = useState('')
  const navigate = useNavigate()
  const { t, i18n: i18nInstance } = useTranslation()
  const locale = i18nInstance.language
  const setSeed = useChatSeedStore((s) => s.setSeed)
  const { taskId: deepLinkTaskId } = Route.useSearch()

  // Data hooks
  const { data: tasks = [], isLoading: isLoadingTasks } = useTasks()
  const { data: workflows = [] } = useWorkflows()
  const { data: taskDetail } = useTaskDetail(selectedTaskId)
  const { data: activity = [] } = useTaskActivity(selectedTaskId)
  const { data: artifacts = [] } = useTaskArtifacts(selectedTaskId)

  // Mutations
  const approveMutation = useApproveTask()
  const rejectMutation = useRejectTask()

  // Auto-select first task (deep link takes priority)
  useEffect(() => {
    if (tasks.length === 0) return
    if (selectedTaskId !== null) return
    if (deepLinkTaskId && tasks.some((tk) => tk.id === deepLinkTaskId)) {
      setSelectedTaskId(deepLinkTaskId)
      return
    }
    setSelectedTaskId(tasks[0].id)
  }, [tasks, selectedTaskId, deepLinkTaskId])

  // Build detail view model when all data is ready
  const selectedDetail: TaskViewModel | null = taskDetail
    ? taskToViewModel(taskDetail, activity, artifacts, workflows, t, locale)
    : null

  // Filter task list
  const filteredTasks = FILTER_TO_API_STATUS[activeFilter]
    ? tasks.filter((task) => {
        const statuses = FILTER_TO_API_STATUS[activeFilter]
        return statuses !== null && statuses.includes(task.status)
      })
    : tasks

  // Build minimal view models for list rows
  const taskListViewModels: TaskViewModel[] = filteredTasks.map((task) => {
    const ctx = parseTaskContext(task)
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      source: task.scheduled_by
        ? { type: 'schedule', label: task.scheduled_by, id: task.scheduled_by }
        : { type: 'conversation', label: typeof ctx.source_conversation === 'string' ? ctx.source_conversation : task.title },
      created_at: task.created_at,
      steps: [],
      relations: [],
      activity: [],
      allArtifacts: [],
    }
  })

  function handleApprove(taskId: string) {
    approveMutation.mutate(taskId)
  }

  function handleReject(taskId: string, message: string) {
    rejectMutation.mutate({ id: taskId, message })
  }

  function handleCreate() {
    setSeed({
      action: 'create_task',
      title: t('chat.seed_creating_task'),
      context: taskPrompt,
      fields: { prompt: taskPrompt },
    })
    setWizardOpen(false)
    setTaskPrompt('')
    void navigate({ to: '/chat' })
  }

  return (
    <>
      <ListDetail
        listSize={55}
        list={
          <ListPanel
            header={
              <>
                <PageHeader
                  title={t('tasks.title')}
                  actions={
                    <Button variant="outline" size="sm" onClick={() => setWizardOpen(true)}>
                      <PlusIcon data-icon="inline-start" weight="bold" />
                      {t('tasks.new_task')}
                    </Button>
                  }
                />
                <FilterTabs
                  tabs={FILTER_KEYS}
                  active={activeFilter}
                  getLabel={(key) => t(FILTER_LABEL_KEYS[key])}
                  onChange={setActiveFilter}
                  className="mt-3"
                />
              </>
            }
          >
            {isLoadingTasks ? (
              <EmptyState
                title={t('tasks.empty_title')}
                description={t('tasks.empty_desc')}
              />
            ) : taskListViewModels.length === 0 ? (
              <EmptyState
                title={t('tasks.empty_title')}
                description={t('tasks.empty_desc')}
              />
            ) : (
              taskListViewModels.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  selected={task.id === selectedTaskId}
                  onClick={() => { setSelectedTaskId(task.id); void navigate({ to: '/tasks', search: { taskId: task.id }, replace: true }) }}
                />
              ))
            )}
          </ListPanel>
        }
        detail={
          selectedDetail ? (
            <TaskDetail task={selectedDetail} onApprove={handleApprove} onReject={handleReject} />
          ) : (
            <EmptyState
              title={t('tasks.select_task')}
              description={t('tasks.select_task_desc')}
            />
          )
        }
      />

      {/* Task creation wizard */}
      <WizardDialog
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        title={t('wizard.new_task')}
        actions={
          <>
            <Button variant="outline" onClick={() => setWizardOpen(false)}>
              {t('wizard.cancel')}
            </Button>
            <Button onClick={handleCreate}>{t('wizard.create')}</Button>
          </>
        }
      >
        <WizardField label={t('wizard.new_task_prompt')}>
          <textarea
            className={wizardTextareaClass}
            value={taskPrompt}
            onChange={(e) => setTaskPrompt(e.target.value)}
            placeholder={t('wizard.new_task_placeholder')}
          />
        </WizardField>
      </WizardDialog>
    </>
  )
}
