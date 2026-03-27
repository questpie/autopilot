import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeftIcon, CaretDownIcon, SpinnerIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTranslation } from "@/lib/i18n"
import { agentDetailQuery } from "@/features/team/team.queries"
import { SessionView } from "@/features/team/session-view"
import { useSessionReplay, useSessionList } from "@/features/team/session-replay"

export const Route = createFileRoute("/_app/team_/$id/session/$sid")({
  component: SessionReplayPage,
})

/**
 * Session replay page.
 * Loads historical session data and renders with the same UI as live session.
 * Uses `team_.` prefix to break out of the team layout (no sheet wrapper).
 */
function SessionReplayPage() {
  const { t } = useTranslation()
  const { id, sid } = Route.useParams()
  const navigate = useNavigate()
  const { data: agent } = useQuery(agentDetailQuery(id))
  const { data: events, isLoading: eventsLoading } = useSessionReplay(id, sid)
  const { data: sessions } = useSessionList(id)

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

          <Badge variant="outline" className="text-[10px]">
            {t("team.session_replay")}
          </Badge>

          {/* Session picker */}
          {sessions && sessions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="gap-1.5 text-[10px]" />}>
                  {sid}
                  <CaretDownIcon size={10} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {sessions.map((session) => (
                  <DropdownMenuItem
                    key={session.id}
                    onClick={() =>
                      void navigate({
                        to: "/team/$id/session/$sid",
                        params: { id, sid: session.id },
                      })
                    }
                    className="font-mono text-xs"
                  >
                    {session.id}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => void navigate({ to: "/team/$id", params: { id } })}
        >
          {t("common.close")}
        </Button>
      </div>

      {/* Session content */}
      <div className="relative flex flex-1 flex-col overflow-hidden">
        {eventsLoading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2">
            <SpinnerIcon size={20} className="animate-spin text-muted-foreground" />
            <p className="font-heading text-xs text-muted-foreground">
              {t("common.loading")}
            </p>
          </div>
        ) : (
          <SessionView
            agentId={id}
            agentName={agentName}
            events={events ?? []}
            live={false}
          />
        )}
      </div>
    </div>
  )
}
