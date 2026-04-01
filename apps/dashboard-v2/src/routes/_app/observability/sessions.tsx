import { EmptyState } from "@/components/feedback/empty-state"
import { Badge } from "@/components/ui/badge"
import { agentsQuery } from "@/features/team/team.queries"
import { useTranslation } from "@/lib/i18n"
import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"
import { ClockIcon, RobotIcon, ArrowRightIcon } from "@phosphor-icons/react"
import { useQuery, queryOptions } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Skeleton } from "@/components/feedback"
import { useMemo } from "react"

export const Route = createFileRoute("/_app/observability/sessions")({
  component: ObservabilitySessionsTab,
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(agentsQuery)
  },
})

interface AgentSession {
  id: string
  agentId: string
  fileName: string
}

const allSessionsQuery = queryOptions({
  queryKey: queryKeys.sessions.list(),
  queryFn: async () => {
    const res = await api.api.fs[":path{.+}"].$get({
      param: { path: "logs/sessions/" },
    })
    if (!res.ok) return [] as AgentSession[]

    const files = (await res.json()) as Array<{ name: string; path: string }>
    return files
      .filter((f) => f.name.endsWith(".jsonl"))
      .map((f) => {
        const id = f.name.replace(".jsonl", "")
        const parts = id.split("-")
        const agentId = parts.length > 1 ? parts[0] : "unknown"
        return { id, agentId, fileName: f.name }
      })
      .reverse()
  },
})

function ObservabilitySessionsTab() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: agents } = useQuery(agentsQuery)
  const { data: sessions, isLoading: sessionsLoading } =
    useQuery(allSessionsQuery)

  const enrichedSessions = useMemo(() => {
    const agentNameMap = new Map<string, string>()
    for (const agent of agents ?? []) {
      agentNameMap.set(agent.id, agent.name)
    }
    return (sessions ?? []).map((s) => ({
      ...s,
      agentName: agentNameMap.get(s.agentId) ?? s.agentId,
    }))
  }, [agents, sessions])

  if (sessionsLoading) {
    return (
      <div className="flex flex-col gap-3 p-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  if (enrichedSessions.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<ClockIcon size={32} />}
          message={t("team.session_no_sessions")}
          description={t("team.session_no_sessions_description")}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="border border-border">
        {enrichedSessions.map((session, idx) => (
          <button
            key={session.id}
            type="button"
            onClick={() =>
              void navigate({
                to: "/team/$id/session/$sid",
                params: { id: session.agentId, sid: session.id },
              })
            }
            className={`flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/30 ${
              idx < enrichedSessions.length - 1
                ? "border-b border-border"
                : ""
            }`}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-muted">
              <RobotIcon size={16} className="text-muted-foreground" />
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="font-heading text-xs font-medium text-foreground truncate">
                  {session.agentName}
                </span>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {t("team.session_replay")}
                </Badge>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground truncate">
                {session.id}
              </span>
            </div>

            <ArrowRightIcon
              size={14}
              className="shrink-0 text-muted-foreground"
            />
          </button>
        ))}
      </div>
    </div>
  )
}
