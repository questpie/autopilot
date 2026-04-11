import { useState, useEffect } from 'react'
import { PlusIcon, ArrowsClockwise, Hand, Play } from '@phosphor-icons/react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { StatusPill, type StatusPillStatus } from '@/components/ui/status-pill'
import { SectionHeader } from '@/components/ui/section-header'
import { KvList } from '@/components/ui/kv-list'
import { FlatList } from '@/components/ui/flat-list'
import { RelationLink } from '@/components/ui/relation-link'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app.store'
import { useChatSeedStore } from '@/stores/chat-seed.store'
import {
  WizardDialog,
  WizardField,
  wizardInputClass,
  wizardTextareaClass,
} from '@/components/wizard-dialog'
import { getPlaybooks, getPlaybook, getPlaybookSteps, getPlaybookExecutions } from '@/api/playbooks.api'
import { getSchedules } from '@/api/schedules.api'
import type { Playbook, PlaybookStep, PlaybookExecution, Schedule } from '@/api/types'

export const Route = createFileRoute('/_app/playbooks')({
  component: PlaybooksPage,
})

// ── Filter types ──

type FilterKey = 'all' | 'active' | 'draft' | 'manual' | 'scheduled'

const FILTER_KEYS: FilterKey[] = ['active', 'draft', 'manual', 'scheduled', 'all']

const FILTER_LABEL_KEYS: Record<FilterKey, string> = {
  all: 'playbooks.filter_all',
  active: 'playbooks.filter_active',
  draft: 'playbooks.filter_draft',
  manual: 'playbooks.filter_manual',
  scheduled: 'playbooks.filter_scheduled',
}

// ── Helpers ──

type PlaybookStatus = Playbook['status']
type PlaybookTrigger = Playbook['trigger']

const TRIGGER_ICONS: Record<PlaybookTrigger, React.ComponentType<{ className?: string; weight?: 'bold' | 'regular' }>> = {
  scheduled: ArrowsClockwise,
  manual: Hand,
  on_demand: Play,
}

const TRIGGER_LABEL_KEYS: Record<PlaybookTrigger, string> = {
  scheduled: 'playbooks.trigger_scheduled',
  manual: 'playbooks.trigger_manual',
  on_demand: 'playbooks.trigger_on_demand',
}

function statusToPill(status: PlaybookStatus): StatusPillStatus {
  switch (status) {
    case 'active':
      return 'done'
    case 'draft':
      return 'draft'
    case 'disabled':
      return 'pending'
  }
}

function statusDotColor(status: PlaybookStatus): string {
  switch (status) {
    case 'active':
      return 'bg-green-500'
    case 'draft':
      return 'bg-zinc-400'
    case 'disabled':
      return 'bg-zinc-400/50'
  }
}

function statusBorderColor(status: PlaybookStatus): string {
  switch (status) {
    case 'active':
      return 'border-l-green-500'
    case 'draft':
      return 'border-l-zinc-400'
    case 'disabled':
      return 'border-l-zinc-400/50'
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '\u2014'
  const d = new Date(iso)
  return d.toLocaleDateString('sk-SK', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '\u2014'
  const d = new Date(iso)
  return d.toLocaleString('sk-SK', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const STEP_TYPE_LABELS: Record<PlaybookStep['type'], string> = {
  gather: 'Gather',
  execute: 'Execute',
  review: 'Review',
  deliver: 'Deliver',
}

const STEP_TYPE_COLORS: Record<PlaybookStep['type'], string> = {
  gather: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
  execute: 'border-green-500/30 bg-green-500/10 text-green-400',
  review: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  deliver: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
}

// ── Playbook Row ──

function PlaybookRow({
  playbook,
  selected,
  onClick,
}: {
  playbook: Playbook
  selected: boolean
  onClick: () => void
}) {
  const { t } = useTranslation()
  const developerMode = useAppStore((s) => s.developerMode)
  const TriggerIcon = TRIGGER_ICONS[playbook.trigger]

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between gap-3 border-b border-border/50 border-l-3 px-3 py-2.5 text-left transition-colors',
        statusBorderColor(playbook.status),
        selected ? 'bg-muted/30' : 'hover:bg-muted/20',
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span
          className={cn('mt-[7px] block size-1.5 shrink-0 rounded-full', statusDotColor(playbook.status))}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-foreground">{playbook.name}</div>
          <div className="truncate text-[12px] text-muted-foreground">{playbook.description}</div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 font-heading text-[11px] text-muted-foreground">
              <TriggerIcon className="size-3" weight="bold" />
              {t(TRIGGER_LABEL_KEYS[playbook.trigger])}
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">{playbook.usage_count}x</span>
            {developerMode && playbook.skill_id && (
              <span className="font-mono text-[11px] text-muted-foreground/50">{playbook.skill_id}</span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

// ── Playbook Detail ──

interface PlaybookDetailData {
  playbook: Playbook
  steps: PlaybookStep[]
  executions: PlaybookExecution[]
  schedules: Schedule[]
}

function PlaybookDetail({ data }: { data: PlaybookDetailData }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const developerMode = useAppStore((s) => s.developerMode)
  const { playbook, steps, executions, schedules } = data

  const linkedSchedules = schedules.filter((s) =>
    playbook.linked_schedule_ids.includes(s.id),
  )

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="border-b border-border/50 px-5 py-4">
        <h2 className="text-[18px] font-medium text-foreground">{playbook.name}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusPill
            status={statusToPill(playbook.status)}
            label={t(`playbooks.status_${playbook.status}`)}
          />
          <span className="rounded-none bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
            {t(TRIGGER_LABEL_KEYS[playbook.trigger])}
          </span>
          {developerMode && playbook.skill_id && (
            <span className="rounded-none bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
              {playbook.skill_id}
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="border-b border-border/50 px-5 py-4">
        <SectionHeader>{t('playbooks.description')}</SectionHeader>
        <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{playbook.description}</p>
      </div>

      {/* Steps */}
      {steps.length > 0 && (
        <div className="border-b border-border/50 px-5 py-4">
          <SectionHeader>{t('playbooks.steps')}</SectionHeader>
          <div className="mt-3 flex flex-col">
            {steps.map((step, idx) => (
              <div
                key={idx}
                className={cn(
                  'flex items-start gap-3 py-2',
                  idx < steps.length - 1 && 'border-b border-border/20',
                )}
              >
                <div className="flex w-5 shrink-0 items-center justify-center pt-0.5">
                  <span className="font-heading text-[11px] text-muted-foreground">{idx + 1}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-foreground">{step.name}</span>
                    <span
                      className={cn(
                        'inline-block rounded-none border px-1.5 py-0.5 font-heading text-[10px]',
                        STEP_TYPE_COLORS[step.type],
                      )}
                    >
                      {STEP_TYPE_LABELS[step.type]}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Linked automations */}
      {linkedSchedules.length > 0 && (
        <div className="border-b border-border/50 px-5 py-4">
          <SectionHeader>{t('playbooks.linked_automations')}</SectionHeader>
          <div className="mt-3 flex flex-col gap-1">
            {linkedSchedules.map((s) => (
              <RelationLink
                key={s.id}
                label={s.name}
                sublabel={s.id}
                onClick={() => void navigate({ to: '/automations', search: { scheduleId: s.id } })}
              />
            ))}
          </div>
        </div>
      )}

      {/* Used resources */}
      {playbook.resource_refs.length > 0 && (
        <div className="border-b border-border/50 px-5 py-4">
          <SectionHeader>{t('playbooks.used_resources')}</SectionHeader>
          <div className="mt-3 flex flex-col gap-1">
            {playbook.resource_refs.map((ref) => (
              <RelationLink
                key={ref}
                label={ref.replace('company://', '')}
                sublabel={ref}
                onClick={() => void navigate({ to: '/resources' })}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recent executions */}
      {executions.length > 0 && (
        <div className="border-b border-border/50 px-5 py-4">
          <SectionHeader>{t('playbooks.recent_executions')}</SectionHeader>
          <div className="mt-3">
            <FlatList
              items={executions}
              renderRow={(exec) => (
                <div className="flex items-center gap-3 px-0 py-2">
                  <span className="font-mono text-[11px] text-muted-foreground">{formatDateTime(exec.date)}</span>
                  <StatusPill
                    status={exec.status === 'completed' ? 'done' : 'failed'}
                    label={exec.status}
                  />
                  <button
                    type="button"
                    className="font-mono text-[11px] text-primary hover:underline"
                    onClick={() => void navigate({ to: '/tasks', search: { taskId: exec.task_id } })}
                  >
                    {exec.task_id.slice(-12)}
                  </button>
                  <span className="text-[11px] text-muted-foreground">{exec.outcome}</span>
                </div>
              )}
            />
          </div>
        </div>
      )}

      {/* Output spec */}
      <div className="border-b border-border/50 px-5 py-4">
        <SectionHeader>{t('playbooks.output_spec')}</SectionHeader>
        <div className="mt-3">
          <KvList
            items={[
              { label: t('playbooks.output_artifacts'), value: steps.some((s) => s.type === 'deliver') ? t('playbooks.output_yes') : t('playbooks.output_no') },
              { label: t('playbooks.output_review'), value: steps.some((s) => s.type === 'review') ? t('playbooks.output_required') : t('playbooks.output_not_required') },
            ]}
          />
        </div>
      </div>

      {/* Statistics */}
      <div className="px-5 py-4">
        <SectionHeader>{t('playbooks.statistics')}</SectionHeader>
        <div className="mt-3">
          <KvList
            items={[
              { label: t('playbooks.stat_usage'), value: `${playbook.usage_count}x` },
              { label: t('playbooks.stat_success'), value: `${Math.round(playbook.success_rate * 100)}%` },
              { label: t('playbooks.stat_last_used'), value: formatDate(playbook.last_used_at) },
            ]}
          />
        </div>
      </div>
    </div>
  )
}

// ── Page ──

function PlaybooksPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setSeed = useChatSeedStore((s) => s.setSeed)

  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [detailData, setDetailData] = useState<PlaybookDetailData | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  // Load playbooks + schedules
  useEffect(() => {
    Promise.all([getPlaybooks(), getSchedules()]).then(([pbs, scheds]) => {
      setPlaybooks(pbs)
      setSchedules(scheds)
    })
  }, [])

  // Auto-select first
  useEffect(() => {
    if (playbooks.length > 0 && selectedId === null) {
      setSelectedId(playbooks[0].id)
    }
  }, [playbooks, selectedId])

  // Load detail when selection changes
  useEffect(() => {
    if (!selectedId) {
      setDetailData(null)
      return
    }
    let cancelled = false
    Promise.all([
      getPlaybook(selectedId),
      getPlaybookSteps(selectedId),
      getPlaybookExecutions(selectedId),
    ]).then(([pb, steps, execs]) => {
      if (cancelled || !pb) return
      setDetailData({ playbook: pb, steps, executions: execs, schedules })
    })
    return () => { cancelled = true }
  }, [selectedId, schedules])

  // Filter
  const filteredPlaybooks = playbooks.filter((pb) => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'active') return pb.status === 'active'
    if (activeFilter === 'draft') return pb.status === 'draft'
    if (activeFilter === 'manual') return pb.trigger === 'manual' || pb.trigger === 'on_demand'
    if (activeFilter === 'scheduled') return pb.trigger === 'scheduled'
    return true
  })

  function handleCreate() {
    setSeed({
      action: 'create_playbook',
      title: name || t('chat.seed_creating_playbook', { name: t('playbooks.title') }),
      context: t('chat.seed_creating_playbook', { name: name || t('playbooks.title') }) + '. ' + description,
      fields: { name, description },
    })
    setWizardOpen(false)
    setName('')
    setDescription('')
    void navigate({ to: '/chat' })
  }

  return (
    <div className="flex h-full flex-1 overflow-hidden">
      {/* Left: playbook list */}
      <div className="flex w-[45%] shrink-0 flex-col border-r border-border/50">
        <div className="shrink-0 border-b border-border/50 px-5 py-4">
          <PageHeader
            title={t('playbooks.title')}
            subtitle={t('playbooks.subtitle')}
            actions={
              <Button variant="outline" size="sm" onClick={() => setWizardOpen(true)}>
                <PlusIcon data-icon="inline-start" weight="bold" />
                {t('playbooks.new')}
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
          {filteredPlaybooks.length === 0 ? (
            <EmptyState
              title={t('playbooks.empty_title')}
              description={t('playbooks.empty_desc')}
            />
          ) : (
            filteredPlaybooks.map((pb) => (
              <PlaybookRow
                key={pb.id}
                playbook={pb}
                selected={pb.id === selectedId}
                onClick={() => setSelectedId(pb.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Right: playbook detail */}
      <div className="flex-1 overflow-y-auto">
        {detailData ? (
          <PlaybookDetail data={detailData} />
        ) : (
          <EmptyState
            title={t('playbooks.select')}
            description={t('playbooks.select_desc')}
          />
        )}
      </div>

      {/* Playbook creation wizard */}
      <WizardDialog
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        title={t('wizard.new_playbook')}
        actions={
          <>
            <Button variant="outline" onClick={() => setWizardOpen(false)}>
              {t('wizard.cancel')}
            </Button>
            <Button onClick={handleCreate}>{t('wizard.create_with_ai')}</Button>
          </>
        }
      >
        <WizardField label={t('wizard.playbook_name')}>
          <input
            type="text"
            className={wizardInputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('wizard.playbook_name_placeholder')}
          />
        </WizardField>
        <WizardField label={t('wizard.playbook_what')}>
          <textarea
            className={wizardTextareaClass}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('wizard.playbook_what_placeholder')}
          />
        </WizardField>
      </WizardDialog>
    </div>
  )
}
