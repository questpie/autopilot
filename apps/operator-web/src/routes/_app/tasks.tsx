import { useState, useEffect } from 'react'
import { PlusIcon } from '@phosphor-icons/react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { StatusPill, type StatusPillStatus } from '@/components/ui/status-pill'
import { SectionHeader } from '@/components/ui/section-header'
import { KvList } from '@/components/ui/kv-list'
import { Timeline, type TimelineEvent } from '@/components/ui/timeline'
import { RelationLink } from '@/components/ui/relation-link'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  WizardDialog,
  WizardField,
  wizardTextareaClass,
} from '@/components/wizard-dialog'
import { useChatSeedStore } from '@/stores/chat-seed.store'
import { getTasks, getTask, getTaskActivity, approveTask, rejectTask } from '@/api/tasks.api'
import type { Task, TaskWithRelations, Run, RunEvent } from '@/api/types'

export const Route = createFileRoute('/_app/tasks')({
  component: TasksPage,
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
  time: string
  who: string
  message: string
}

interface StepArtifact {
  filename: string
  type: string
  size: string
}

interface StepInstance {
  id: string
  stepName: string
  revision: number
  status: StepStatus
  duration: string | null
  summary: string | null
  actor: string
  runs: StepRun[]
  feedback: StepFeedback[]
  artifacts: StepArtifact[]
}

interface TaskRelation {
  kind: 'parent' | 'blocked_by' | 'blocking' | 'source' | 'schedule' | 'playbook'
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
    const data = evt.data
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

function buildRevisionTree(task: Task, runs: Run[], events: RunEvent[]): StepInstance[] {
  const steps: StepInstance[] = []

  // Group events by step name + revision to build the tree
  const stepMap = new Map<string, { stepName: string; revision: number; events: RunEvent[]; runs: Run[] }>()

  // Derive steps from events
  for (const evt of events) {
    const data = evt.data
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
      const data = evt.data
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
      steps.push({
        id: `step_${i}`,
        stepName: currentStep,
        revision: i + 1,
        status: runStatusToStepStatus(run),
        duration: duration ?? (run.status === 'running' ? `${Math.floor((Date.now() - new Date(run.started_at ?? run.created_at).getTime()) / 60000)}m+` : null),
        summary: run.summary,
        actor: 'agent',
        runs: [{
          id: run.id,
          status: run.status === 'completed' ? 'done' : run.status,
          duration: duration ?? '—',
          summary: run.summary ?? run.error ?? '',
        }],
        feedback: [],
        artifacts: [],
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

    // Extract feedback from rejection events
    const feedback: StepFeedback[] = []
    for (const evt of stepEvents) {
      if (evt.type === 'approval_rejected') {
        const data = evt.data
        feedback.push({
          time: new Date(evt.created_at).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' }),
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
    const isHumanStep = stepEvents.some((e) => e.type === 'approval_requested' || e.type === 'approval_rejected')
    const firstRejection = stepEvents.find((e) => e.type === 'approval_rejected')
    const actor = isHumanStep
      ? (firstRejection && typeof firstRejection.data.by === 'string' ? firstRejection.data.by : '')
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

    steps.push({
      id: `step_${entry.stepName}_r${entry.revision}`,
      stepName: entry.stepName,
      revision: entry.revision,
      status,
      duration,
      summary: entry.runs.length > 0 ? (entry.runs[entry.runs.length - 1].summary ?? null) : null,
      actor,
      runs: stepRuns,
      feedback,
      artifacts: [], // Artifacts would need separate fetch — kept empty for now
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
        runs: [],
        feedback: [],
        artifacts: [],
      })
    }
  }

  return steps
}

function buildActivityFromEvents(events: RunEvent[]): TimelineEvent[] {
  return events.map((evt) => {
    const time = new Date(evt.created_at).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })
    const data = evt.data
    const step = typeof data.step === 'string' ? data.step : ''
    const revision = typeof data.revision === 'number' ? data.revision : 0
    const revSuffix = revision > 0 ? ` (rev ${revision})` : ''

    let label = `${evt.type}${step ? ` — ${step}${revSuffix}` : ''}`
    let variant: TimelineEvent['variant'] = undefined

    switch (evt.type) {
      case 'step_completed':
        label = `${step}${revSuffix} dokonceny`
        if (typeof data.summary === 'string') label += ` — ${data.summary}`
        variant = 'success'
        break
      case 'step_failed':
        label = `${step}${revSuffix} zlyhal`
        if (typeof data.error === 'string') label += ` — ${data.error}`
        variant = 'error'
        break
      case 'step_started':
        label = `${step}${revSuffix} spusteny`
        break
      case 'approval_requested':
        label = `${step}${revSuffix} — caka na schvalenie`
        variant = 'warning'
        break
      case 'approval_rejected':
        label = `${typeof data.by === 'string' ? data.by : 'User'} vratil na upravu`
        if (typeof data.message === 'string') label += `: ${data.message}`
        variant = 'warning'
        break
    }

    return { time, label, variant }
  })
}

function buildRelations(taskWithRelations: TaskWithRelations): TaskRelation[] {
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

  if (taskWithRelations.scheduled_by) {
    relations.push({ kind: 'schedule', label: taskWithRelations.scheduled_by })
  }
  if (taskWithRelations.context.source_conversation) {
    relations.push({ kind: 'source', label: `Konverzacia: ${String(taskWithRelations.context.source_conversation)}` })
  }

  return relations
}

function taskToViewModel(
  taskWithRelations: TaskWithRelations,
  events: RunEvent[],
): TaskViewModel {
  const task = taskWithRelations
  const runs = taskWithRelations.runs

  const source: TaskViewModel['source'] = task.scheduled_by
    ? { type: 'schedule', label: task.scheduled_by, id: task.scheduled_by }
    : { type: 'conversation', label: typeof task.context.source_conversation === 'string' ? task.context.source_conversation : task.title }

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    source,
    error: runs.find((r) => r.error)?.error ?? undefined,
    created_at: task.created_at,
    steps: buildRevisionTree(task, runs, events),
    relations: buildRelations(taskWithRelations),
    activity: buildActivityFromEvents(events),
  }
}

// ── Status mapping ──

function apiStatusToPill(status: string): StatusPillStatus {
  switch (status) {
    case 'waiting_for_human_approval':
      return 'needs-input'
    case 'running':
      return 'working'
    case 'completed':
      return 'done'
    case 'failed':
      return 'failed'
    case 'blocked':
      return 'blocked'
    default:
      return 'pending'
  }
}

function statusBorderColor(status: string): string {
  switch (status) {
    case 'waiting_for_human_approval':
      return 'border-l-amber-500'
    case 'running':
      return 'border-l-blue-500'
    case 'completed':
      return 'border-l-green-500'
    case 'failed':
      return 'border-l-red-500'
    case 'blocked':
      return 'border-l-red-500'
    default:
      return 'border-l-zinc-400'
  }
}

function statusDotColor(status: string): string {
  switch (status) {
    case 'waiting_for_human_approval':
      return 'bg-amber-500'
    case 'running':
      return 'bg-blue-500'
    case 'completed':
      return 'bg-green-500'
    case 'failed':
      return 'bg-red-500'
    case 'blocked':
      return 'bg-red-500'
    default:
      return 'bg-zinc-400'
  }
}

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
    case 'playbook':
      return t('tasks.rel_playbook')
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
              <StepSubHints step={step} isLast={isLast} />
            )}

            {/* Expanded detail */}
            {isExpanded && (
              <div className={cn(
                'ml-5 border-l border-border/30 pl-4 pb-2',
                !isLast && 'border-b border-border/20',
              )}>
                {step.runs.length > 0 && (
                  <div className="mt-1">
                    {step.runs.map((run) => (
                      <div key={run.id} className="flex items-center gap-2 py-0.5">
                        <span className={cn(
                          'font-mono text-[11px]',
                          run.status === 'failed' ? 'text-red-500' : 'text-muted-foreground',
                        )}>
                          {run.id}
                        </span>
                        <span className={cn(
                          'font-mono text-[11px]',
                          run.status === 'failed' ? 'text-red-500' : 'text-green-500',
                        )}>
                          {run.status}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {run.duration}
                        </span>
                        <span className="text-[12px] text-muted-foreground">
                          {run.summary}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {step.feedback.length > 0 && (
                  <div className="mt-1">
                    {step.feedback.map((fb, i) => (
                      <div key={i} className="flex items-baseline gap-2 py-0.5">
                        <span className="font-mono text-[11px] text-muted-foreground">{fb.time}</span>
                        <span className="text-[12px] font-medium text-foreground">{fb.who}:</span>
                        <span className="text-[12px] text-muted-foreground">&ldquo;{fb.message}&rdquo;</span>
                      </div>
                    ))}
                  </div>
                )}
                {step.artifacts.length > 0 && (
                  <div className="mt-1">
                    {step.artifacts.map((art, i) => (
                      <div key={i} className="flex items-center gap-2 py-0.5">
                        <span className="text-[12px] text-foreground">{art.filename}</span>
                        <span className="rounded-none bg-muted/40 px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
                          {art.type}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground">{art.size}</span>
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
function StepSubHints({ step, isLast }: { step: StepInstance; isLast: boolean }) {
  const hasRuns = step.runs.some((r) => r.status === 'failed')
  const hasFeedback = step.feedback.length > 0
  const hasArtifacts = step.artifacts.length > 0

  if (!hasRuns && !hasFeedback && !hasArtifacts) return null

  return (
    <div className={cn(
      'ml-5 border-l border-border/30 pl-4 pb-1',
      !isLast && 'border-b border-border/20',
    )}>
      {hasRuns && step.runs.filter((r) => r.status === 'failed').map((run) => (
        <div key={run.id} className="font-mono text-[11px] text-red-500/80 py-0.5">
          {run.id} failed: {run.summary}
        </div>
      ))}
      {hasFeedback && step.feedback.map((fb, i) => (
        <div key={i} className="text-[11px] text-muted-foreground py-0.5">
          {fb.who}: &ldquo;{fb.message}&rdquo;
        </div>
      ))}
      {hasArtifacts && (
        <div className="text-[11px] text-muted-foreground/60 py-0.5">
          {step.artifacts.map((a) => a.filename).join(', ')}
        </div>
      )}
    </div>
  )
}

// ── Task Detail ──

function TaskDetail({ task, onApprove, onReject }: { task: TaskViewModel; onApprove: (taskId: string) => void; onReject: (taskId: string, message: string) => void }) {
  const { t } = useTranslation()
  const [auditOpen, setAuditOpen] = useState(false)
  const [rejectMode, setRejectMode] = useState(false)
  const [rejectMessage, setRejectMessage] = useState('')

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="border-b border-border/50 px-5 py-4">
        <h2 className="text-[18px] font-medium text-foreground">{task.title}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusPill
            status={apiStatusToPill(task.status)}
            pulse={task.status === 'running'}
          />
          <span className="rounded-none bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
            {sourceLabel(task.source, t)}
          </span>
          <span className="rounded-none bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
            {task.id}
          </span>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{task.description}</p>
        {task.error && (
          <p className="mt-1.5 text-[12px] text-red-500">
            {t('tasks.error_label')}: {task.error}
          </p>
        )}
      </div>

      {/* 1. Current progress strip */}
      <div className="border-b border-border/50 px-5 py-2">
        <span className={cn('font-mono text-[12px]', progressStripColor(task))}>
          {progressStripText(task, t)}
        </span>
      </div>

      {/* 2. Revision tree */}
      <div className="border-b border-border/50 px-5 py-4">
        <SectionHeader>{t('tasks.section_progress')}</SectionHeader>
        <div className="mt-3">
          <RevisionTree steps={task.steps} taskStatus={task.status} />
        </div>
      </div>

      {/* 3. Action section (only for waiting_for_human_approval) */}
      {task.status === 'waiting_for_human_approval' && (
        <div className="border-b border-border/50 px-5 py-4">
          <div className="border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <p className="text-[13px] font-medium text-foreground">{t('tasks.action_waiting')}</p>
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
        </div>
      )}

      {/* 4. Relations */}
      {task.relations.length > 0 && (
        <div className="border-b border-border/50 px-5 py-4">
          <SectionHeader>{t('tasks.section_relations')}</SectionHeader>
          <div className="mt-3">
            <KvList
              items={task.relations.map((rel) => ({
                label: relationKindLabel(rel.kind, t),
                value: <RelationLink label={rel.label} sublabel={rel.sublabel} />,
              }))}
            />
          </div>
        </div>
      )}

      {/* 5. Audit log (collapsed by default) */}
      {task.activity.length > 0 && (
        <div className="px-5 py-4">
          <SectionHeader
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
            {t('tasks.section_activity')}
          </SectionHeader>
          {auditOpen && (
            <div className="mt-3">
              <Timeline events={task.activity} />
            </div>
          )}
        </div>
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
  const { t } = useTranslation()
  const setSeed = useChatSeedStore((s) => s.setSeed)

  // Load tasks from adapter
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedDetail, setSelectedDetail] = useState<TaskViewModel | null>(null)

  useEffect(() => {
    getTasks().then(setTasks)
  }, [])

  // Auto-select first task
  useEffect(() => {
    if (tasks.length > 0 && selectedTaskId === null) {
      setSelectedTaskId(tasks[0].id)
    }
  }, [tasks, selectedTaskId])

  // Load detail when selection changes
  useEffect(() => {
    if (!selectedTaskId) {
      setSelectedDetail(null)
      return
    }

    let cancelled = false
    Promise.all([
      getTask(selectedTaskId),
      getTaskActivity(selectedTaskId),
    ]).then(([taskWithRelations, events]) => {
      if (cancelled) return
      if (taskWithRelations) {
        setSelectedDetail(taskToViewModel(taskWithRelations, events))
      }
    })

    return () => { cancelled = true }
  }, [selectedTaskId])

  const filteredTasks = FILTER_TO_API_STATUS[activeFilter]
    ? tasks.filter((task) => {
        const statuses = FILTER_TO_API_STATUS[activeFilter]
        return statuses !== null && statuses.includes(task.status)
      })
    : tasks

  // Build minimal view models for the list rows
  const taskListViewModels: TaskViewModel[] = filteredTasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    source: task.scheduled_by
      ? { type: 'schedule', label: task.scheduled_by, id: task.scheduled_by }
      : { type: 'conversation', label: typeof task.context.source_conversation === 'string' ? task.context.source_conversation : task.title },
    created_at: task.created_at,
    steps: [],
    relations: [],
    activity: [],
  }))

  function handleApprove(taskId: string) {
    approveTask(taskId).then(() => {
      // Optimistic: mark task as running in local state
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'running' } : t))
      setSelectedDetail(prev => prev ? { ...prev, status: 'running' } : prev)
      console.log(`Task ${taskId} approved`)
    })
  }

  function handleReject(taskId: string, message: string) {
    rejectTask(taskId, message).then(() => {
      // Optimistic: mark task as running (agent will re-process)
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'running' } : t))
      setSelectedDetail(prev => prev ? { ...prev, status: 'running' } : prev)
      console.log(`Task ${taskId} rejected with message: ${message}`)
    })
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
    <div className="flex h-full flex-1 overflow-hidden">
      {/* Left: task list */}
      <div className="flex w-[55%] shrink-0 flex-col border-r border-border/50">
        <div className="shrink-0 border-b border-border/50 px-5 py-4">
          <PageHeader
            title={t('tasks.title')}
            actions={
              <Button variant="outline" size="sm" onClick={() => setWizardOpen(true)}>
                <PlusIcon data-icon="inline-start" weight="bold" />
                {t('tasks.new_task')}
              </Button>
            }
          />
          <div className="mt-3 flex items-center gap-1">
            {FILTER_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveFilter(key)}
                className={cn(
                  'font-heading text-[12px] px-2.5 py-1 transition-colors',
                  activeFilter === key
                    ? 'bg-muted/50 text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t(FILTER_LABEL_KEYS[key])}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {taskListViewModels.length === 0 ? (
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
                onClick={() => setSelectedTaskId(task.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Right: task detail */}
      <div className="flex-1 overflow-y-auto">
        {selectedDetail ? (
          <TaskDetail task={selectedDetail} onApprove={handleApprove} onReject={handleReject} />
        ) : (
          <EmptyState
            title={t('tasks.select_task')}
            description={t('tasks.select_task_desc')}
          />
        )}
      </div>

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
    </div>
  )
}
