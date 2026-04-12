import { useState, useEffect } from 'react'
import { PlusIcon, XIcon } from '@phosphor-icons/react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { ToggleSwitch } from '@/components/ui/toggle-switch'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { ListDetail, ListPanel } from '@/components/list-detail'
import { StatusPill, type StatusPillStatus } from '@/components/ui/status-pill'
import { SectionHeader } from '@/components/ui/section-header'
import { KvList } from '@/components/ui/kv-list'
import { FlatList } from '@/components/ui/flat-list'
import { RelationLink } from '@/components/ui/relation-link'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  WizardDialog,
  WizardField,
  wizardInputClass,
  wizardTextareaClass,
  wizardSelectClass,
} from '@/components/wizard-dialog'
import { getSchedules, getSchedule, toggleSchedule, triggerSchedule } from '@/api/schedules.api'
import { getWorkflows } from '@/api/workflows.api'
import type { Schedule, ScheduleWithHistory, ScheduleExecution, Workflow } from '@/api/types'

const automationsSearchSchema = z.object({
  scheduleId: z.string().optional(),
})

export const Route = createFileRoute('/_app/automations')({
  component: AutomationsPage,
  validateSearch: (search) => automationsSearchSchema.parse(search),
})

// ── Filter types ──

type FilterKey = 'all' | 'active' | 'paused' | 'error'

const FILTER_KEYS: FilterKey[] = ['active', 'paused', 'error', 'all']

const FILTER_LABEL_KEYS: Record<FilterKey, string> = {
  all: 'automations.filter_all',
  active: 'automations.filter_active',
  paused: 'automations.filter_paused',
  error: 'automations.filter_error',
}

// ── Helpers ──

function cronToLabel(cron: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const parts = cron.split(' ')
  const minute = parts[0]
  const hour = parts[1]
  const dom = parts[2]
  const dow = parts[4]
  const time = `${hour}:${minute?.padStart(2, '0')}`

  if (dom !== '*' && dom === '1') return t('automations.cron_monthly_first', { time })
  if (dom !== '*') return t('automations.cron_monthly', { dom, time })
  if (dow === '1') return t('automations.cron_monday', { time })
  if (dow === '5') return t('automations.cron_friday', { time })
  if (dow === '0') return t('automations.cron_sunday', { time })
  if (dow !== '*') return t('automations.cron_weekly', { time })
  return t('automations.cron_daily', { time })
}

function formatDateTime(iso: string | null, locale: string): string {
  if (!iso) return '\u2014'
  const d = new Date(iso)
  return d.toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function scheduleStatusColor(schedule: Schedule, lastExecution: ScheduleExecution | undefined): { dot: string; border: string; label: string } {
  if (!schedule.enabled) {
    return { dot: 'bg-zinc-400', border: 'border-l-zinc-400', label: 'paused' }
  }
  if (lastExecution?.status === 'failed') {
    return { dot: 'bg-red-500', border: 'border-l-red-500', label: 'error' }
  }
  return { dot: 'bg-green-500', border: 'border-l-green-500', label: 'active' }
}

function executionStatusToPill(status: ScheduleExecution['status']): StatusPillStatus {
  switch (status) {
    case 'triggered':
      return 'working'
    case 'completed':
      return 'done'
    case 'skipped':
      return 'draft'
    case 'failed':
      return 'failed'
  }
}

// ── Schedule Row ──

function ScheduleRow({
  schedule,
  lastExecution,
  selected,
  onClick,
  onToggle,
}: {
  schedule: Schedule
  lastExecution: ScheduleExecution | undefined
  selected: boolean
  onClick: () => void
  onToggle: () => void
}) {
  const { t } = useTranslation()
  const colors = scheduleStatusColor(schedule, lastExecution)

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between gap-3 border-b border-border/50 border-l-3 px-3 py-2.5 text-left transition-colors',
        colors.border,
        selected ? 'bg-muted/30' : 'hover:bg-muted/20',
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span
          className={cn('mt-[7px] block size-1.5 shrink-0 rounded-full', colors.dot)}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-foreground">{schedule.name}</div>
          <div className="truncate text-[12px] text-muted-foreground">{schedule.description}</div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="font-mono text-[11px] text-muted-foreground">{cronToLabel(schedule.cron, t)}</span>
            <span className="font-mono text-[11px] text-muted-foreground/50">{schedule.id}</span>
          </div>
        </div>
      </div>
      <div
        className="shrink-0"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') e.stopPropagation()
        }}
      >
        <ToggleSwitch
          checked={schedule.enabled}
          onChange={onToggle}
        />
      </div>
    </button>
  )
}

// ── Schedule Detail ──

function ScheduleDetail({
  detail,
  workflows,
  onTrigger,
  onExecutionClick,
}: {
  detail: ScheduleWithHistory
  workflows: Workflow[]
  onTrigger: () => void
  onExecutionClick: (exec: ScheduleExecution) => void
}) {
  const { t, i18n: i18nInstance } = useTranslation()
  const navigate = useNavigate()
  const locale = i18nInstance.language

  const lastExecution = detail.history.length > 0
    ? detail.history.reduce((a, b) => (a.triggered_at > b.triggered_at ? a : b))
    : undefined

  const colors = scheduleStatusColor(detail, lastExecution)

  const statusPillStatus: StatusPillStatus = colors.label === 'active' ? 'done'
    : colors.label === 'error' ? 'failed'
    : 'pending'

  const linkedWorkflow = detail.workflow_id
    ? workflows.find((w) => w.id === detail.workflow_id)
    : undefined

  // Collect task IDs from executions
  const createdTaskIds = detail.history
    .filter((e) => e.task_id !== null)
    .map((e) => ({ taskId: e.task_id ?? '', triggeredAt: e.triggered_at }))

  // Sort history by triggered_at descending
  const sortedHistory = [...detail.history].sort(
    (a, b) => b.triggered_at.localeCompare(a.triggered_at),
  )

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="border-b border-border/50 px-5 py-4">
        <h2 className="text-[18px] font-medium text-foreground">{detail.name}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusPill status={statusPillStatus} label={t(`automations.status_${colors.label}`)} />
          <span className="rounded-none bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
            {detail.id}
          </span>
          <span className="rounded-none bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
            {detail.mode}
          </span>
        </div>
        {detail.description && (
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{detail.description}</p>
        )}
      </div>

      {/* Config */}
      <div className="border-b border-border/50 px-5 py-4">
        <SectionHeader>{t('automations.config')}</SectionHeader>
        <div className="mt-3">
          <KvList
            items={[
              { label: t('automations.label_cron'), value: <span className="font-mono text-[12px]">{detail.cron}</span> },
              { label: t('automations.label_timezone'), value: detail.timezone },
              { label: t('automations.label_mode'), value: detail.mode },
              { label: t('automations.label_concurrency'), value: detail.concurrency_policy },
              ...(detail.workflow_id ? [{ label: t('automations.label_workflow_id'), value: <span className="font-mono text-[12px]">{detail.workflow_id}</span> }] : []),
              { label: t('automations.label_agent_id'), value: <span className="font-mono text-[12px]">{detail.agent_id}</span> },
            ]}
          />
        </div>
      </div>

      {/* Next run */}
      <div className="border-b border-border/50 px-5 py-4">
        <SectionHeader>{t('automations.next_run')}</SectionHeader>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[15px] font-medium text-foreground">
            {detail.enabled ? formatDateTime(detail.next_run_at, locale) : '\u2014'}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={onTrigger}
          >
            {t('automations.trigger_now')}
          </Button>
        </div>
      </div>

      {/* Recent executions */}
      {sortedHistory.length > 0 && (
        <div className="border-b border-border/50 px-5 py-4">
          <SectionHeader>{t('automations.executions')}</SectionHeader>
          <div className="mt-3">
            <FlatList
              items={sortedHistory}
              renderRow={(exec) => (
                <button
                  type="button"
                  onClick={() => onExecutionClick(exec)}
                  className="flex w-full items-center gap-3 px-0 py-2 text-left hover:bg-muted/10 transition-colors cursor-pointer"
                >
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground/60">{exec.id.slice(-8)}</span>
                  <StatusPill status={executionStatusToPill(exec.status)} label={exec.status} />
                  <span className="font-mono text-[11px] text-muted-foreground">{formatDateTime(exec.triggered_at, locale)}</span>
                  {exec.task_id && (
                    <span className="font-mono text-[11px] text-primary">
                      {exec.task_id.slice(-12)}
                    </span>
                  )}
                  {exec.error && (
                    <span className="text-[11px] text-red-500">{exec.error}</span>
                  )}
                  {exec.skip_reason && (
                    <span className="text-[11px] text-muted-foreground">{exec.skip_reason}</span>
                  )}
                </button>
              )}
            />
          </div>
        </div>
      )}

      {/* Created tasks */}
      {createdTaskIds.length > 0 && (
        <div className="border-b border-border/50 px-5 py-4">
          <SectionHeader>{t('automations.created_tasks')}</SectionHeader>
          <div className="mt-3 flex flex-col gap-1">
            {createdTaskIds.map((ct) => (
              <RelationLink
                key={ct.taskId}
                label={ct.taskId}
                sublabel={formatDateTime(ct.triggeredAt, locale)}
                onClick={() => void navigate({ to: '/tasks', search: { taskId: ct.taskId } })}
              />
            ))}
          </div>
        </div>
      )}

      {/* Linked workflow (FE-derived from schedule.workflow_id) */}
      {linkedWorkflow && (
        <div className="border-b border-border/50 px-5 py-4">
          <SectionHeader>{t('automations.linked_workflow')}</SectionHeader>
          <div className="mt-3">
            <RelationLink
              label={linkedWorkflow.name}
              sublabel={linkedWorkflow.description}
              onClick={() => void navigate({ to: '/workflows', search: { workflowId: linkedWorkflow.id } })}
            />
          </div>
        </div>
      )}

      {/* Failure handling */}
      <div className="px-5 py-4">
        <SectionHeader>{t('automations.error_handling')}</SectionHeader>
        <div className="mt-3">
          <KvList
            items={[
              { label: t('automations.label_concurrency'), value: detail.concurrency_policy },
              ...(lastExecution?.error ? [{ label: t('automations.last_error'), value: <span className="text-red-500">{lastExecution.error}</span> }] : []),
              ...(lastExecution?.skip_reason ? [{ label: t('automations.skip_reason'), value: lastExecution.skip_reason }] : []),
            ]}
          />
        </div>
      </div>
    </div>
  )
}

// ── Execution Detail Sheet ──

function ExecutionDetailSheet({
  execution,
  scheduleName,
  onClose,
  onNavigateToTask,
  onNavigateToChat,
}: {
  execution: ScheduleExecution
  scheduleName: string
  onClose: () => void
  onNavigateToTask: (taskId: string) => void
  onNavigateToChat: (queryId: string) => void
}) {
  const { t, i18n: i18nInstance } = useTranslation()
  const locale = i18nInstance.language

  function renderOutcome() {
    switch (execution.status) {
      case 'completed':
        if (execution.task_id) {
          return (
            <div className="flex flex-col gap-1">
              <span className="text-[13px] text-foreground">{t('automations.exec_task_created')}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{execution.task_id}</span>
            </div>
          )
        }
        if (execution.query_id) {
          return (
            <div className="flex flex-col gap-1">
              <span className="text-[13px] text-foreground">{t('automations.exec_query_sent')}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{execution.query_id}</span>
            </div>
          )
        }
        return <span className="text-[13px] text-foreground">{t('automations.exec_completed')}</span>
      case 'triggered':
        return <span className="text-[13px] text-foreground">{t('automations.exec_running')}</span>
      case 'skipped':
        return (
          <div className="flex flex-col gap-1">
            <span className="text-[13px] text-foreground">{t('automations.exec_skipped')}</span>
            {execution.skip_reason && (
              <span className="text-[12px] text-muted-foreground">{execution.skip_reason}</span>
            )}
          </div>
        )
      case 'failed':
        return (
          <div className="flex flex-col gap-1">
            <span className="text-[13px] text-red-500">{t('automations.exec_failed')}</span>
            {execution.error && (
              <span className="text-[12px] text-red-500/80">{execution.error}</span>
            )}
          </div>
        )
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      {/* Sheet */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-[420px] flex-col border-l border-border bg-background shadow-lg transition-transform duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="text-[15px] font-medium text-foreground">{t('automations.exec_detail_title')}</h3>
            <span className="font-mono text-[11px] text-muted-foreground">{scheduleName}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-7 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Status section */}
          <div className="border-b border-border/50 px-5 py-4">
            <SectionHeader>{t('automations.exec_status')}</SectionHeader>
            <div className="mt-3">
              <KvList
                items={[
                  { label: t('automations.label_status'), value: <StatusPill status={executionStatusToPill(execution.status)} label={execution.status} /> },
                  { label: t('automations.exec_triggered_at'), value: formatDateTime(execution.triggered_at, locale) },
                  { label: t('automations.exec_duration'), value: execution.status === 'completed' ? '2m 14s' : execution.status === 'triggered' ? t('automations.exec_running') : '\u2014' },
                  { label: t('automations.label_trigger'), value: t('automations.exec_trigger_cron') },
                ]}
              />
            </div>
          </div>

          {/* Outcome section */}
          <div className="border-b border-border/50 px-5 py-4">
            <SectionHeader>{t('automations.exec_outcome')}</SectionHeader>
            <div className="mt-3">
              {renderOutcome()}
            </div>
          </div>

          {/* Linked entity section */}
          {(execution.task_id || execution.query_id) && (
            <div className="border-b border-border/50 px-5 py-4">
              <SectionHeader>{t('automations.exec_follow_up')}</SectionHeader>
              <div className="mt-3">
                {execution.task_id && (
                  <Button size="sm" onClick={() => onNavigateToTask(execution.task_id!)}>
                    {t('automations.exec_open_task')}
                  </Button>
                )}
                {execution.query_id && (
                  <Button size="sm" onClick={() => onNavigateToChat(execution.query_id!)}>
                    {t('automations.exec_open_chat')}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* No action state */}
          {!execution.task_id && !execution.query_id && execution.status !== 'triggered' && (
            <div className="border-b border-border/50 px-5 py-4">
              <SectionHeader>{t('automations.exec_follow_up')}</SectionHeader>
              <p className="mt-3 text-[12px] text-muted-foreground">{t('automations.exec_no_follow_up')}</p>
            </div>
          )}

          {/* Execution ID */}
          <div className="px-5 py-4">
            <SectionHeader>{t('automations.exec_identifier')}</SectionHeader>
            <div className="mt-3">
              <KvList
                items={[
                  { label: t('automations.label_execution_id'), value: <span className="font-mono text-[11px]">{execution.id}</span> },
                  { label: t('automations.label_schedule_id'), value: <span className="font-mono text-[11px]">{execution.schedule_id}</span> },
                ]}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Page ──

function AutomationsPage() {
  const navigate = useNavigate()
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [executions, setExecutions] = useState<Map<string, ScheduleExecution | undefined>>(new Map())
  const [detail, setDetail] = useState<ScheduleWithHistory | null>(null)
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [selectedExecution, setSelectedExecution] = useState<ScheduleExecution | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [frequency, setFrequency] = useState('daily')
  const [time, setTime] = useState('09:00')
  const { t } = useTranslation()
  const { scheduleId: deepLinkScheduleId } = Route.useSearch()

  // Load schedules + workflows
  useEffect(() => {
    Promise.all([getSchedules(), getWorkflows()]).then(([scheds, wfs]) => {
      setSchedules(scheds)
      setWorkflows(wfs)

      // Load last execution status for each schedule
      const exMap = new Map<string, ScheduleExecution | undefined>()
      const loadDetails = scheds.map((s) =>
        getSchedule(s.id).then((det) => {
          if (det && det.history.length > 0) {
            const last = det.history.reduce((a, b) => (a.triggered_at > b.triggered_at ? a : b))
            exMap.set(s.id, last)
          }
        }),
      )
      Promise.all(loadDetails).then(() => setExecutions(exMap))
    })
  }, [])

  // Auto-select first
  useEffect(() => {
    if (schedules.length === 0) return
    if (selectedId !== null) return
    if (deepLinkScheduleId && schedules.some((s) => s.id === deepLinkScheduleId)) {
      setSelectedId(deepLinkScheduleId)
      return
    }
    setSelectedId(schedules[0].id)
  }, [schedules, selectedId, deepLinkScheduleId])

  // Load detail when selection changes
  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    let cancelled = false
    getSchedule(selectedId).then((d) => {
      if (!cancelled) setDetail(d)
    })
    return () => { cancelled = true }
  }, [selectedId])

  // Filter
  const filteredSchedules = schedules.filter((s) => {
    if (activeFilter === 'all') return true
    const lastExec = executions.get(s.id)
    const status = scheduleStatusColor(s, lastExec).label
    return status === activeFilter
  })

  function handleToggle(id: string) {
    const schedule = schedules.find((s) => s.id === id)
    if (!schedule) return
    const newEnabled = !schedule.enabled
    // Optimistic update
    setSchedules((prev) => prev.map((s) => s.id === id ? { ...s, enabled: newEnabled } : s))
    if (detail && detail.id === id) {
      setDetail({ ...detail, enabled: newEnabled })
    }
    toggleSchedule(id, newEnabled)
  }

  function handleTrigger() {
    if (!selectedId) return
    triggerSchedule(selectedId)
    // Could add toast or optimistic execution entry here
  }

  function handleCreate() {
    setWizardOpen(false)
    setName('')
    setDescription('')
    setFrequency('daily')
    setTime('09:00')
  }

  return (
    <>
    <ListDetail
      listSize={40}
      list={
        <ListPanel
          header={
            <>
              <PageHeader
                title={t('automations.title')}
                actions={
                  <Button variant="outline" size="sm" onClick={() => setWizardOpen(true)}>
                    <PlusIcon data-icon="inline-start" weight="bold" />
                    {t('automations.add')}
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
            </>
          }
        >
          {filteredSchedules.length === 0 ? (
            <EmptyState
              title={t('automations.empty_title')}
              description={t('automations.empty_desc')}
            />
          ) : (
            filteredSchedules.map((schedule) => (
              <ScheduleRow
                key={schedule.id}
                schedule={schedule}
                lastExecution={executions.get(schedule.id)}
                selected={schedule.id === selectedId}
                onClick={() => { setSelectedId(schedule.id); void navigate({ to: '/automations', search: { scheduleId: schedule.id }, replace: true }) }}
                onToggle={() => handleToggle(schedule.id)}
              />
            ))
          )}
        </ListPanel>
      }
      detail={
        detail ? (
          <ScheduleDetail
            detail={detail}
            workflows={workflows}
            onTrigger={handleTrigger}
            onExecutionClick={(exec) => setSelectedExecution(exec)}
          />
        ) : (
          <EmptyState
            title={t('automations.select')}
            description={t('automations.select_desc')}
          />
        )
      }
    />

      {/* Automation creation wizard */}
      <WizardDialog
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        title={t('wizard.new_automation')}
        actions={
          <>
            <Button variant="outline" onClick={() => setWizardOpen(false)}>
              {t('wizard.cancel')}
            </Button>
            <Button onClick={handleCreate}>{t('wizard.create')}</Button>
          </>
        }
      >
        <WizardField label={t('wizard.automation_name')}>
          <input
            type="text"
            className={wizardInputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('wizard.automation_name_placeholder')}
          />
        </WizardField>
        <WizardField label={t('wizard.automation_what')}>
          <textarea
            className={wizardTextareaClass}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('wizard.automation_what_placeholder')}
          />
        </WizardField>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <WizardField label={t('wizard.automation_when')}>
              <select
                className={wizardSelectClass}
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
              >
                <option value="daily">{t('wizard.frequency_daily')}</option>
                <option value="weekly">{t('wizard.frequency_weekly')}</option>
                <option value="monthly">{t('wizard.frequency_monthly')}</option>
              </select>
            </WizardField>
          </div>
          <div className="flex-1">
            <WizardField label={t('wizard.automation_time')}>
              <input
                type="time"
                className={wizardInputClass}
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </WizardField>
          </div>
        </div>
      </WizardDialog>

      {selectedExecution && detail && (
        <ExecutionDetailSheet
          execution={selectedExecution}
          scheduleName={detail.name}
          onClose={() => setSelectedExecution(null)}
          onNavigateToTask={(taskId) => void navigate({ to: '/tasks', search: { taskId } })}
          onNavigateToChat={() => void navigate({ to: '/chat' })}
        />
      )}
    </>
  )
}
