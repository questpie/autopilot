import { createFileRoute } from "@tanstack/react-router"
import { useTranslation } from "@/lib/i18n"
import { AgentEditor } from "@/features/settings/agent-editor"

export const Route = createFileRoute("/_app/settings/agents")({
  component: SettingsAgentsPage,
})

function SettingsAgentsPage() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-border px-6 py-4">
        <h1 className="font-heading text-2xl font-semibold">
          {t("settings.agents")}
        </h1>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <AgentEditor />
      </div>
    </div>
  )
}
