import { createFileRoute } from "@tanstack/react-router"
import { useTranslation } from "@/lib/i18n"
import { SettingsPageHeader } from "@/features/settings/settings-page-header"
import { CompanyProfileForm } from "@/features/settings/company-profile-form"

export const Route = createFileRoute("/_app/settings/general")({
  component: SettingsGeneralPage,
})

function SettingsGeneralPage() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-1 flex-col">
      <SettingsPageHeader
        title={t("settings.general")}
        description={t("settings.general_description")}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <CompanyProfileForm />
      </div>
    </div>
  )
}
