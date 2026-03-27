import { createFileRoute } from "@tanstack/react-router"
import { useTranslation } from "@/lib/i18n"
import { SettingsPageHeader } from "@/features/settings/settings-page-header"
import { WorkflowEditor } from "@/features/settings/workflow-editor"

export const Route = createFileRoute("/_app/settings/workflows")({
  component: SettingsWorkflowsPage,
})

function SettingsWorkflowsPage() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-1 flex-col">
      <SettingsPageHeader
        title={t("settings.workflows")}
        description={t("settings.workflows_description")}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl">
          <WorkflowEditor />
        </div>
      </div>
    </div>
  )
}
