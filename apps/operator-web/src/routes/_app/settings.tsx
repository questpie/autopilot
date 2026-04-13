import { createFileRoute } from '@tanstack/react-router'
import { useAppStore } from '@/stores/app.store'
import { useTranslation, changeLanguage, SUPPORTED_LOCALES } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { DetailSection } from '@/components/ui/detail-section'
import { ToggleSwitch } from '@/components/ui/toggle-switch'

export const Route = createFileRoute('/_app/settings')({
  component: SettingsPage,
})

const LOCALE_OPTIONS = ['auto', ...SUPPORTED_LOCALES] as const

function SettingsPage() {
  const developerMode = useAppStore((s) => s.developerMode)
  const setDeveloperMode = useAppStore((s) => s.setDeveloperMode)
  const locale = useAppStore((s) => s.locale)
  const setLocale = useAppStore((s) => s.setLocale)
  const { t } = useTranslation()

  function handleLocaleChange(value: typeof LOCALE_OPTIONS[number]) {
    setLocale(value)
    changeLanguage(value)
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Page header */}
      <div className="border-b border-border/50 px-5 py-4">
        <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />
      </div>

      <DetailSection
        title={t('settings.users')}
        action={<Button variant="outline" size="sm">{t('settings.manage')}</Button>}
      >
        <p className="mt-2 text-[13px] text-muted-foreground">{t('settings.users_desc')}</p>
      </DetailSection>

      <DetailSection
        title={t('settings.preferences')}
        action={<Button variant="outline" size="sm">{t('settings.edit')}</Button>}
      >
        <p className="mt-2 text-[13px] text-muted-foreground">{t('settings.preferences_desc')}</p>
      </DetailSection>

      <DetailSection
        title={t('settings.language')}
        action={
          <div className="flex gap-1">
            {LOCALE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleLocaleChange(option)}
                className={cn(
                  'rounded-none px-3 py-1 font-heading text-[11px] transition-colors',
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
      >
        <p className="mt-2 text-[13px] text-muted-foreground">{t('settings.language_desc')}</p>
      </DetailSection>

      <DetailSection
        title={t('settings.dev_mode')}
        action={<ToggleSwitch checked={developerMode} onChange={setDeveloperMode} />}
      >
        <p className="mt-2 text-[13px] text-muted-foreground">{t('settings.dev_mode_desc')}</p>
      </DetailSection>

      <DetailSection last title={t('settings.about')}>
        <p className="mt-2 text-[13px] text-muted-foreground">{t('settings.about_version')}</p>
      </DetailSection>
    </div>
  )
}
