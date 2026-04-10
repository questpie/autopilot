import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import {
  WizardDialog,
  WizardField,
  wizardTextareaClass,
  wizardSelectClass,
} from '@/components/wizard-dialog'
import { useTranslation } from '@/lib/i18n'
import { useChatSeedStore } from '@/stores/chat-seed.store'

const MOCK_INTEGRATIONS = [
  {
    icon: '💬',
    name: 'Telegram',
    connected: true,
  },
  {
    icon: '📷',
    name: 'Instagram',
    connected: false,
  },
  {
    icon: '✉️',
    name: 'Email',
    connected: true,
  },
  {
    icon: '🛒',
    name: 'E-shop',
    connected: false,
  },
]

export const Route = createFileRoute('/_app/integrations')({
  component: IntegrationsPage,
})

function IntegrationsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setSeed = useChatSeedStore((s) => s.setSeed)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [service, setService] = useState('instagram')
  const [description, setDescription] = useState('')

  function handleCreate() {
    setSeed({
      action: 'create_integration',
      title: service,
      context: t('chat.seed_creating_integration', { service }) + '. ' + description,
      fields: { service, description },
    })
    setWizardOpen(false)
    setService('instagram')
    setDescription('')
    void navigate({ to: '/chat' })
  }

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <PageHeader
        title={t('integrations.title')}
        subtitle={t('integrations.subtitle')}
        actions={
          <Button variant="outline" onClick={() => setWizardOpen(true)}>
            {t('integrations.add')}
          </Button>
        }
      />

      <div className="mt-6 flex max-w-2xl flex-col gap-3">
        {MOCK_INTEGRATIONS.map((integration) => (
          <div
            key={integration.name}
            className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
          >
            <div className="flex size-9 items-center justify-center rounded-none bg-muted text-xl">
              {integration.icon}
            </div>
            <div className="flex-1">
              <p className="text-[14px] font-medium">{integration.name}</p>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span
                  className={cn(
                    'inline-block size-1.5 rounded-full',
                    integration.connected ? 'bg-success' : 'bg-muted-foreground',
                  )}
                />
                <span
                  className={cn(
                    'text-[12px]',
                    integration.connected ? 'text-success' : 'text-muted-foreground',
                  )}
                >
                  {integration.connected ? t('integrations.connected') : t('integrations.disconnected', { name: integration.name })}
                </span>
              </div>
            </div>
            <Button
              variant={integration.connected ? 'outline' : 'default'}
              size="sm"
              onClick={() => {
                if (!integration.connected) {
                  setSeed({
                    action: 'create_integration',
                    title: integration.name,
                    context: t('chat.seed_creating_integration', { service: integration.name }),
                    fields: { service: integration.name },
                  })
                  void navigate({ to: '/chat' })
                }
              }}
            >
              {integration.connected ? t('integrations.configure') : t('integrations.connect')}
            </Button>
          </div>
        ))}

      </div>

      {/* Integration wizard */}
      <WizardDialog
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        title={t('wizard.new_integration')}
        actions={
          <>
            <Button variant="outline" onClick={() => setWizardOpen(false)}>
              {t('wizard.cancel')}
            </Button>
            <Button onClick={handleCreate}>{t('wizard.setup_with_ai')}</Button>
          </>
        }
      >
        <WizardField label={t('wizard.integration_service')}>
          <select
            className={wizardSelectClass}
            value={service}
            onChange={(e) => setService(e.target.value)}
          >
            <option value="instagram">Instagram</option>
            <option value="slack">Slack</option>
            <option value="calendar">Calendar</option>
            <option value="crm">CRM</option>
            <option value="eshop">E-shop</option>
            <option value="other">{t('wizard.service_other')}</option>
          </select>
        </WizardField>
        <WizardField label={t('wizard.integration_what')}>
          <textarea
            className={wizardTextareaClass}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('wizard.integration_what_placeholder')}
          />
        </WizardField>
      </WizardDialog>
    </div>
  )
}
