import { createFileRoute } from "@tanstack/react-router"
import { useTranslation } from "@/lib/i18n"
import { SettingsPageHeader } from "@/features/settings/settings-page-header"
import { TwoFactorSetup } from "@/features/settings/two-factor-setup"

export const Route = createFileRoute("/_app/settings/security/2fa")({
  component: Settings2FAPage,
})

function Settings2FAPage() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-1 flex-col">
      <SettingsPageHeader
        title={t("settings.two_factor")}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <TwoFactorSetup />
      </div>
    </div>
  )
}
