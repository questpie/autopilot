import { createFileRoute } from "@tanstack/react-router"
import { useTranslation } from "@/lib/i18n"
import { SettingsPageHeader } from "@/features/settings/settings-page-header"
import { AppearanceForm } from "@/features/settings/appearance-form"

export const Route = createFileRoute("/_app/settings/appearance")({
  component: SettingsAppearancePage,
})

function SettingsAppearancePage() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-1 flex-col">
      <SettingsPageHeader
        title={t("settings.appearance")}
        description={t("settings.appearance_description")}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <AppearanceForm />
      </div>
    </div>
  )
}
