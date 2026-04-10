import { useState, useEffect } from 'react'
import { m } from 'framer-motion'
import {
  CalendarDotsIcon,
  ClockIcon,
  StarIcon,
  ArticleIcon,
  PlusIcon,
} from '@phosphor-icons/react'
import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { ToggleSwitch } from '@/components/ui/toggle-switch'
import { PageHeader } from '@/components/page-header'
import { useTranslation } from '@/lib/i18n'
import { staggerContainer, staggerItem } from '@/lib/motion'
import {
  WizardDialog,
  WizardField,
  wizardInputClass,
  wizardTextareaClass,
  wizardSelectClass,
} from '@/components/wizard-dialog'
import { getSchedules } from '@/api/schedules.api'
import type { Schedule } from '@/api/types'

export const Route = createFileRoute('/_app/automations')({
  component: AutomationsPage,
})

// ── Types ──

interface Automation {
  id: string
  title: string
  description: string
  schedule: string
  enabled: boolean
  icon: React.ComponentType<{ className?: string; weight?: 'regular' | 'bold' | 'fill' }>
}

// ── Transform schedule to automation display model ──

const SCHEDULE_ICONS: Record<string, React.ComponentType<{ className?: string; weight?: 'regular' | 'bold' | 'fill' }>> = {
  'agent_analytics': StarIcon,
  'agent_content': ArticleIcon,
  'agent_procurement': ClockIcon,
}

function cronToLabel(cron: string): string {
  const parts = cron.split(' ')
  const minute = parts[0]
  const hour = parts[1]
  const dom = parts[2]
  const dow = parts[4]
  const time = `${hour}:${minute?.padStart(2, '0')}`

  if (dom !== '*' && dom === '1') return `Ka\u017ed\u00fd 1. v mesiaci o ${time}`
  if (dom !== '*') return `Ka\u017ed\u00fd ${dom}. v mesiaci o ${time}`
  if (dow === '1') return `Ka\u017ed\u00fd pondelok o ${time}`
  if (dow === '5') return `Ka\u017ed\u00fd piatok o ${time}`
  if (dow === '0') return `Ka\u017ed\u00fa nede\u013eu o ${time}`
  if (dow !== '*') return `Ka\u017ed\u00fd t\u00fd\u017ede\u0148 o ${time}`
  return `Denne o ${time}`
}

function scheduleToAutomation(schedule: Schedule): Automation {
  return {
    id: schedule.id,
    title: schedule.name,
    description: schedule.description ?? '',
    schedule: cronToLabel(schedule.cron),
    enabled: schedule.enabled,
    icon: SCHEDULE_ICONS[schedule.agent_id] ?? CalendarDotsIcon,
  }
}

function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([])

  useEffect(() => {
    getSchedules().then((schedules) => {
      setAutomations(schedules.map(scheduleToAutomation))
    })
  }, [])
  const [wizardOpen, setWizardOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [frequency, setFrequency] = useState('daily')
  const [time, setTime] = useState('09:00')
  const { t } = useTranslation()

  function toggleAutomation(id: string) {
    setAutomations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)),
    )
  }

  function handleCreate() {
    setWizardOpen(false)
    setName('')
    setDescription('')
    setFrequency('daily')
    setTime('09:00')
  }

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <m.div variants={staggerContainer} initial="initial" animate="animate" className="flex flex-col gap-6">
        <m.div variants={staggerItem}>
          <PageHeader
            title={t('automations.title')}
            actions={
              <Button variant="outline" size="default" onClick={() => setWizardOpen(true)}>
                <PlusIcon data-icon="inline-start" weight="bold" />
                {t('automations.add')}
              </Button>
            }
          />
        </m.div>

        {/* Automation list */}
        <m.div variants={staggerContainer} initial="initial" animate="animate" className="flex flex-col gap-2">
          {automations.map((automation) => {
            const Icon = automation.icon
            return (
              <m.div
                key={automation.id}
                variants={staggerItem}
                className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/8">
                  <Icon className="size-[18px] text-primary" weight="bold" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium">{automation.title}</span>
                  <span className="text-[13px] text-muted-foreground">{automation.description}</span>
                  <span className="font-heading text-[11px] text-muted-foreground">
                    {automation.schedule}
                  </span>
                </div>
                <ToggleSwitch
                  checked={automation.enabled}
                  onChange={() => toggleAutomation(automation.id)}
                />
              </m.div>
            )
          })}
        </m.div>

      </m.div>

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
