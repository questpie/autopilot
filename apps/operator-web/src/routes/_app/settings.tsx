import { createFileRoute } from '@tanstack/react-router'
import { useAppStore } from '@/stores/app.store'
import { useTranslation, changeLanguage } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { ToggleSwitch } from '@/components/ui/toggle-switch'

export const Route = createFileRoute('/_app/settings')({
  component: SettingsPage,
})

function SettingsCard({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-5">
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-medium text-foreground">{title}</h3>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

const LOCALE_OPTIONS = ['sk', 'en', 'auto'] as const

function SettingsPage() {
  const developerMode = useAppStore((s) => s.developerMode)
  const setDeveloperMode = useAppStore((s) => s.setDeveloperMode)
  const locale = useAppStore((s) => s.locale)
  const setLocale = useAppStore((s) => s.setLocale)
  const { t } = useTranslation()

  function handleLocaleChange(value: 'sk' | 'en' | 'auto') {
    setLocale(value)
    changeLanguage(value)
  }

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <PageHeader title={t('settings.title')} />

      <div className="mt-6 flex max-w-2xl flex-col gap-3">
        <SettingsCard
          title={t('settings.users')}
          description={t('settings.users_desc')}
          action={<Button variant="outline">{t('settings.manage')}</Button>}
        />

        <SettingsCard
          title={t('settings.preferences')}
          description={t('settings.preferences_desc')}
          action={<Button variant="outline">{t('settings.edit')}</Button>}
        />

        <SettingsCard
          title={t('settings.language')}
          description={t('settings.language_desc')}
          action={
            <div className="flex gap-1">
              {LOCALE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleLocaleChange(option)}
                  className={cn(
                    'rounded-none px-3 py-1.5 font-heading text-[12px] transition-colors',
                    locale === option
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t(`settings.language_${option}`)}
                </button>
              ))}
            </div>
          }
        />

        <SettingsCard
          title={t('settings.dev_mode')}
          description={t('settings.dev_mode_desc')}
          action={
            <ToggleSwitch checked={developerMode} onChange={setDeveloperMode} />
          }
        />

        <SettingsCard
          title={t('settings.about')}
          description={t('settings.about_version')}
        />
      </div>
    </div>
  )
}
