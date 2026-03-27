import { createFileRoute } from "@tanstack/react-router"
import { useTranslation } from "@/lib/i18n"
import { SettingsPageHeader } from "@/features/settings/settings-page-header"
import { TeamManagement } from "@/features/settings/team-management"

export const Route = createFileRoute("/_app/settings/team")({
  component: SettingsTeamPage,
})

function SettingsTeamPage() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-1 flex-col">
      <SettingsPageHeader
        title={t("settings.team")}
        description={t("settings.team_description")}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl">
          <TeamManagement />
        </div>
      </div>
    </div>
  )
}
