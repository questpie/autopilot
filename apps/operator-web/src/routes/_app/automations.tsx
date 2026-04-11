import { useState, useEffect } from 'react'
import { PlusIcon } from '@phosphor-icons/react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { ToggleSwitch } from '@/components/ui/toggle-switch'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
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
import { getPlaybooks } from '@/api/playbooks.api'
import type { Schedule, ScheduleWithHistory, ScheduleExecution, Playbook } from '@/api/types'

export const Route = createFileRoute('/_app/automations')({
  component: AutomationsPage,
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

function cronToLabel(cron: string): string {
  const parts = cron.split(' ')
  const minute = parts[0]
  const hour = parts[1]
  const dom = parts[2]
  const dow = parts[4]
  const time = `${hour}:${minute?.padStart(2, '0')}`

  if (dom !== '*' && dom === '1') return `Kazdy 1. v mesiaci o ${time}`
  if (dom !== '*') return `Kazdy ${dom}. v mesiaci o ${time}`
  if (dow === '1') return `Kazdy pondelok o ${time}`
  if (dow === '5') return `Kazdy piatok o ${time}`
  if (dow === '0') return `Kazdu nedelu o ${time}`
  if (dow !== '*') return `Kazdy tyzden o ${time}`
  return `Denne o ${time}`
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '\u2014'
  const d = new Date(iso)
  return d.toLocaleString('sk-SK', {
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
            <span className="font-mono text-[11px] text-muted-foreground">{cronToLabel(schedule.cron)}</span>
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
  playbooks,
  onTrigger,
}: {
  detail: ScheduleWithHistory
  playbooks: Playbook[]
  onTrigger: () => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const lastExecution = detail.history.length > 0
    ? detail.history.reduce((a, b) => (a.triggered_at > b.triggered_at ? a : b))
    : undefined

  const colors = scheduleStatusColor(detail, lastExecution)

  const statusPillStatus: StatusPillStatus = colors.label === 'active' ? 'done'
    : colors.label === 'error' ? 'failed'
    : 'pending'

  // Find linked playbook by workflow_id match
  const linkedPlaybook = detail.workflow_id
    ? playbooks.find((pb) => pb.linked_schedule_ids.includes(detail.id))
    : null

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
              { label: 'Cron', value: <span className="font-mono text-[12px]">{detail.cron}</span> },
              { label: 'Timezone', value: detail.timezone },
              { label: 'Mode', value: detail.mode },
              { label: 'Concurrency', value: detail.concurrency_policy },
              ...(detail.workflow_id ? [{ label: 'Workflow ID', value: <span className="font-mono text-[12px]">{detail.workflow_id}</span> }] : []),
              { label: 'Agent ID', value: <span className="font-mono text-[12px]">{detail.agent_id}</span> },
            ]}
          />
        </div>
      </div>

      {/* Next run */}
      <div className="border-b border-border/50 px-5 py-4">
        <SectionHeader>{t('automations.next_run')}</SectionHeader>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[15px] font-medium text-foreground">
            {detail.enabled ? formatDateTime(detail.next_run_at) : '\u2014'}
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
                <div className="flex items-center gap-3 px-0 py-2">
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground/60">{exec.id.slice(-8)}</span>
                  <StatusPill status={executionStatusToPill(exec.status)} label={exec.status} />
                  <span className="font-mono text-[11px] text-muted-foreground">{formatDateTime(exec.triggered_at)}</span>
                  {exec.task_id && (
                    <button
                      type="button"
                      className="font-mono text-[11px] text-primary hover:underline"
                      onClick={() => void navigate({ to: '/tasks', search: { taskId: exec.task_id } })}
                    >
                      {exec.task_id.slice(-12)}
                    </button>
                  )}
                  {exec.error && (
                    <span className="text-[11px] text-red-500">{exec.error}</span>
                  )}
                  {exec.skip_reason && (
                    <span className="text-[11px] text-muted-foreground">{exec.skip_reason}</span>
                  )}
                </div>
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
                sublabel={formatDateTime(ct.triggeredAt)}
                onClick={() => void navigate({ to: '/tasks', search: { taskId: ct.taskId } })}
              />
            ))}
          </div>
        </div>
      )}

      {/* Linked playbook */}
      {linkedPlaybook && (
        <div className="border-b border-border/50 px-5 py-4">
          <SectionHeader>{t('automations.linked_playbook')}</SectionHeader>
          <div className="mt-3">
            <RelationLink
              label={linkedPlaybook.name}
              sublabel={linkedPlaybook.id}
              onClick={() => void navigate({ to: '/playbooks', search: { playbookId: linkedPlaybook.id } })}
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
              { label: 'Concurrency', value: detail.concurrency_policy },
              ...(lastExecution?.error ? [{ label: t('automations.last_error'), value: <span className="text-red-500">{lastExecution.error}</span> }] : []),
              ...(lastExecution?.skip_reason ? [{ label: t('automations.skip_reason'), value: lastExecution.skip_reason }] : []),
            ]}
          />
        </div>
      </div>
    </div>
  )
}

// ── Page ──

function AutomationsPage() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [executions, setExecutions] = useState<Map<string, ScheduleExecution | undefined>>(new Map())
  const [detail, setDetail] = useState<ScheduleWithHistory | null>(null)
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [wizardOpen, setWizardOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [frequency, setFrequency] = useState('daily')
  const [time, setTime] = useState('09:00')
  const { t } = useTranslation()

  // Load schedules + playbooks
  useEffect(() => {
    Promise.all([getSchedules(), getPlaybooks()]).then(([scheds, pbs]) => {
      setSchedules(scheds)
      setPlaybooks(pbs)

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
    if (schedules.length > 0 && selectedId === null) {
      setSelectedId(schedules[0].id)
    }
  }, [schedules, selectedId])

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
    <div className="flex h-full flex-1 overflow-hidden">
      {/* Left: schedule list */}
      <div className="flex w-[45%] shrink-0 flex-col border-r border-border/50">
        <div className="shrink-0 border-b border-border/50 px-5 py-4">
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
        </div>

        <div className="flex-1 overflow-y-auto">
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
                onClick={() => setSelectedId(schedule.id)}
                onToggle={() => handleToggle(schedule.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Right: schedule detail */}
      <div className="flex-1 overflow-y-auto">
        {detail ? (
          <ScheduleDetail
            detail={detail}
            playbooks={playbooks}
            onTrigger={handleTrigger}
          />
        ) : (
          <EmptyState
            title={t('automations.select')}
            description={t('automations.select_desc')}
          />
        )}
      </div>

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
    </div>
  )
}
