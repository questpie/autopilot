import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeftIcon, CircleIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useTranslation } from "@/lib/i18n"
import { agentDetailQuery } from "@/features/team/team.queries"
import { SessionView } from "@/features/team/session-view"

export const Route = createFileRoute("/_app/team_/$id/session")({
  component: LiveSessionPage,
})

/**
 * Full-page live session view.
 * Equivalent to `autopilot attach <name>`.
 * Shows real-time agent activity stream via SSE.
 * Uses `team_.` prefix to break out of the team layout (no sheet wrapper).
 */
function LiveSessionPage() {
  const { t } = useTranslation()
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const { data: agent } = useQuery(agentDetailQuery(id))

  const agentName = agent?.name ?? id
  const agentRole = agent?.role ?? ""

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => void navigate({ to: "/team/$id", params: { id } })}
          >
            <ArrowLeftIcon size={16} />
          </Button>

          <div className="flex items-center gap-2">
            <span className="font-heading text-sm font-semibold">
              {agentName}
            </span>
            {agentRole && (
              <Badge variant="secondary" className="text-[10px]">
                {agentRole}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <CircleIcon size={8} weight="fill" className="animate-pulse text-green-500 motion-reduce:animate-none" />
            <span className="font-heading text-[10px] font-medium text-green-500">
              {t("team.session_live")}
            </span>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => void navigate({ to: "/team/$id", params: { id } })}
        >
          {t("team.session_detach")}
        </Button>
      </div>

      {/* Session content */}
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <SessionView
          agentId={id}
          agentName={agentName}
          live
        />
      </div>
    </div>
  )
}
