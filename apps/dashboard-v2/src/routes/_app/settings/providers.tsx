import { createFileRoute } from "@tanstack/react-router"
import { useTranslation } from "@/lib/i18n"
import { SettingsPageHeader } from "@/features/settings/settings-page-header"
import { ProviderForm } from "@/features/settings/provider-form"

export const Route = createFileRoute("/_app/settings/providers")({
  component: SettingsProvidersPage,
})

function SettingsProvidersPage() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-1 flex-col">
      <SettingsPageHeader
        title={t("settings.providers")}
        description={t("settings.providers_description")}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <ProviderForm />
      </div>
    </div>
  )
}
