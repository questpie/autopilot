import { useState, useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowsClockwise, Hand, Play } from '@phosphor-icons/react'

import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import {
  WizardDialog,
  WizardField,
  wizardInputClass,
  wizardTextareaClass,
} from '@/components/wizard-dialog'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app.store'
import { useChatSeedStore } from '@/stores/chat-seed.store'
import { getPlaybooks } from '@/api/playbooks.api'
import { getSchedules } from '@/api/schedules.api'
import type { Playbook } from '@/api/types'

type PlaybookStatus = Playbook['status']
type PlaybookTrigger = Playbook['trigger']

// ── Display model enriched from Playbook + schedule names ──

interface PlaybookDisplay {
  id: string
  title: string
  desc: string
  status: PlaybookStatus
  trigger: PlaybookTrigger
  linkedAutomation: string | null
  lastUsed: string
  usageCount: number
  skillId: string | null
}

function formatDate(iso: string | null): string {
  if (!iso) return '\u2014'
  const d = new Date(iso)
  return `${d.getDate()}. ${['janu\u00e1ra','febru\u00e1ra','marca','apr\u00edla','m\u00e1ja','j\u00fana','j\u00fala','augusta','septembra','okt\u00f3bra','novembra','decembra'][d.getMonth()]}`
}

const STATUS_LABEL_KEYS: Record<PlaybookStatus, string> = {
  active: 'playbooks.status_active',
  draft: 'playbooks.status_draft',
  disabled: 'playbooks.status_disabled',
}

const TRIGGER_LABEL_KEYS: Record<PlaybookTrigger, string> = {
  scheduled: 'playbooks.trigger_scheduled',
  manual: 'playbooks.trigger_manual',
  on_demand: 'playbooks.trigger_on_demand',
}

const TRIGGER_ICONS: Record<PlaybookTrigger, React.ComponentType<{ className?: string; weight?: 'bold' | 'regular' }>> = {
  scheduled: ArrowsClockwise,
  manual: Hand,
  on_demand: Play,
}

export const Route = createFileRoute('/_app/playbooks')({
  component: PlaybooksPage,
})

function PlaybookStatusBadge({ status, label }: { status: PlaybookStatus; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-heading text-[11px]',
        status === 'active' && 'text-green-500',
        status === 'draft' && 'text-muted-foreground',
        status === 'disabled' && 'text-muted-foreground/50',
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          status === 'active' && 'bg-green-500',
          status === 'draft' && 'bg-muted-foreground',
          status === 'disabled' && 'bg-muted-foreground/50',
        )}
        aria-hidden="true"
      />
      {label}
    </span>
  )
}

function PlaybooksPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const developerMode = useAppStore((s) => s.developerMode)
  const setSeed = useChatSeedStore((s) => s.setSeed)
  const [playbooks, setPlaybooks] = useState<PlaybookDisplay[]>([])
  const [wizardOpen, setWizardOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    Promise.all([getPlaybooks(), getSchedules()]).then(([pbs, schedules]) => {
      const scheduleNameById = new Map(schedules.map((s) => [s.id, s.name]))
      setPlaybooks(
        pbs.map((pb): PlaybookDisplay => {
          const linkedName = pb.linked_schedule_ids
            .map((sid) => scheduleNameById.get(sid))
            .filter(Boolean)[0] ?? null
          return {
            id: pb.id,
            title: pb.name,
            desc: pb.description,
            status: pb.status,
            trigger: pb.trigger,
            linkedAutomation: linkedName ?? null,
            lastUsed: formatDate(pb.last_used_at),
            usageCount: pb.usage_count,
            skillId: pb.skill_id,
          }
        }),
      )
    })
  }, [])

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
    <div className="flex-1 overflow-y-auto p-8">
      <PageHeader
        title={t('playbooks.title')}
        subtitle={t('playbooks.subtitle')}
        actions={
          <Button onClick={() => setWizardOpen(true)}>{t('playbooks.new')}</Button>
        }
      />

      <div className="mt-6 flex max-w-2xl flex-col gap-3">
        {playbooks.map((playbook) => {
          const TriggerIcon = TRIGGER_ICONS[playbook.trigger]
          return (
            <div
              key={playbook.id}
              className="flex items-start gap-4 rounded-xl border border-border bg-card p-4"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[14px] font-medium">{playbook.title}</p>
                  <PlaybookStatusBadge status={playbook.status} label={t(STATUS_LABEL_KEYS[playbook.status])} />
                </div>
                <p className="line-clamp-2 text-[13px] text-muted-foreground">
                  {playbook.desc}
                </p>
                <div className="flex flex-wrap items-center gap-3 font-heading text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <TriggerIcon className="size-3" weight="bold" />
                    {t(TRIGGER_LABEL_KEYS[playbook.trigger])}
                  </span>
                  <span>{t('playbooks.last_used', { date: playbook.lastUsed })}</span>
                  <span>{t('playbooks.usage_count', { count: playbook.usageCount })}</span>
                </div>
                {playbook.linkedAutomation && (
                  <p className="text-[11px] text-primary/60">
                    {t('playbooks.linked_to', { name: playbook.linkedAutomation })}
                  </p>
                )}
                {developerMode && playbook.skillId && (
                  <p className="font-heading text-[11px] text-muted-foreground">
                    {t('playbooks.skill_id', { id: playbook.skillId })}
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => {
                  setSeed({
                    action: 'edit_playbook',
                    title: playbook.title,
                    context: t('chat.seed_editing_playbook', { name: playbook.title }) + '. ' + playbook.desc,
                    fields: { name: playbook.title },
                  })
                  void navigate({ to: '/chat' })
                }}
              >
                {t('playbooks.edit')}
              </Button>
            </div>
          )
        })}
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
