import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router"
import { PlusIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/lib/i18n"
import { AgentGrid } from "@/features/team/agent-grid"
import { PageTransition } from "@/components/layouts/page-transition"

export const Route = createFileRoute("/_app/team")({
  component: TeamPage,
})

function TeamPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <PageTransition className="flex flex-1 flex-col">
      {/* Page header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h1 className="font-heading text-2xl font-semibold">
          {t("team.title")}
        </h1>

        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => void navigate({ to: "/settings" })}
        >
          <PlusIcon size={14} />
          {t("team.add_agent")}
        </Button>
      </div>

      {/* Agent grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <AgentGrid />
      </div>

      {/* Outlet for nested routes (agent detail sheet) */}
      <Outlet />
    </PageTransition>
  )
}
