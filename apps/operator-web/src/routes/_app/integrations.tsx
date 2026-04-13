import { useState, useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { DetailSection } from '@/components/ui/detail-section'
import {
  WizardDialog,
  WizardField,
  wizardTextareaClass,
  wizardSelectClass,
} from '@/components/wizard-dialog'
import { useTranslation } from '@/lib/i18n'
import { useChatSeedStore } from '@/stores/chat-seed.store'
import { getIntegrations } from '@/api/integrations.api'
import type { Integration } from '@/api/types'

export const Route = createFileRoute('/_app/integrations')({
  component: IntegrationsPage,
})

function IntegrationsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setSeed = useChatSeedStore((s) => s.setSeed)
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [wizardOpen, setWizardOpen] = useState(false)

  useEffect(() => {
    getIntegrations().then(setIntegrations)
  }, [])
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
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Page header */}
      <div className="border-b border-border/50 px-5 py-4">
        <PageHeader
          title={t('integrations.title')}
          subtitle={t('integrations.subtitle')}
          actions={
            <Button variant="outline" size="sm" onClick={() => setWizardOpen(true)}>
              {t('integrations.add')}
            </Button>
          }
        />
      </div>

      {/* Integrations list */}
      <DetailSection last title={t('integrations.title')}>
        <div className="mt-2 flex flex-col">
          {integrations.map((integration, i) => {
            const connected = integration.status === 'connected'
            return (
              <div
                key={integration.id}
                className={cn(
                  'flex items-center gap-3 py-2.5',
                  i < integrations.length - 1 && 'border-b border-border/30',
                )}
              >
                <div className="flex size-8 items-center justify-center rounded-none bg-muted text-lg">
                  {integration.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-foreground">{integration.name}</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span
                      className={cn(
                        'inline-block size-1.5 rounded-full',
                        connected ? 'bg-success' : 'bg-muted-foreground',
                      )}
                    />
                    <span
                      className={cn(
                        'text-[12px]',
                        connected ? 'text-success' : 'text-muted-foreground',
                      )}
                    >
                      {connected
                        ? t('integrations.connected')
                        : t('integrations.disconnected', { name: integration.name })}
                    </span>
                  </div>
                </div>
                <Button
                  variant={connected ? 'outline' : 'default'}
                  size="sm"
                  onClick={() => {
                    if (!connected) {
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
                  {connected ? t('integrations.configure') : t('integrations.connect')}
                </Button>
              </div>
            )
          })}
        </div>
      </DetailSection>

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
