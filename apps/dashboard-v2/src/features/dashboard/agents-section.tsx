import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { CircleIcon, PlayIcon, UsersIcon } from "@phosphor-icons/react"
import { EmptyState } from "@/components/feedback"
import { Link, useNavigate } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/lib/i18n"
import { agentsQuery } from "@/features/team/team.queries"
import { statusQuery } from "@/features/dashboard/dashboard.queries"
import { AgentsSkeleton } from "./dashboard-skeleton"
import { cn } from "@/lib/utils"

interface AgentStatus {
  id: string
  name: string
  role: string
  isWorking: boolean
  currentTask?: string
  elapsedTime?: string
}

function AgentStatusCard({ agent }: { agent: AgentStatus }) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.15 }}
    >
      <Link
        to="/team/$id"
        params={{ id: agent.id }}
        className="group flex items-center gap-3 border border-border p-3 transition-colors hover:bg-muted/30"
      >
        <div className="relative shrink-0">
          <CircleIcon
            size={10}
            weight={agent.isWorking ? "fill" : "regular"}
            className={cn(
              agent.isWorking ? "text-green-500" : "text-muted-foreground",
              agent.isWorking && "animate-pulse motion-reduce:animate-none",
            )}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-heading text-sm font-medium text-foreground group-hover:text-primary">
            {agent.name}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {agent.isWorking
              ? agent.currentTask ?? t("dashboard.agent_working")
              : t("dashboard.agent_idle")}
          </span>
        </div>

        {agent.elapsedTime && (
          <span className="shrink-0 font-heading text-[10px] text-muted-foreground">
            {agent.elapsedTime}
          </span>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="h-6 shrink-0 gap-1 px-1.5 text-[10px] opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void navigate({ to: "/team/$id/session", params: { id: agent.id } })
          }}
          title={t("dashboard.attach")}
        >
          <PlayIcon size={10} weight="fill" />
          {t("dashboard.attach")}
        </Button>
      </Link>
    </motion.div>
  )
}

export function AgentsSection() {
  const { t } = useTranslation()
  const agentsResult = useQuery(agentsQuery)
  const statusResult = useQuery(statusQuery)

  if (agentsResult.isLoading) {
    return <AgentsSkeleton />
  }

  const agents = agentsResult.data ?? []
  const status = statusResult.data

  if (agents.length === 0) {
    return (
      <section className="flex flex-col">
        <div className="flex items-center justify-between px-1 pb-3">
          <h2 className="font-heading text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {t("dashboard.agents_title")}
          </h2>
        </div>
        <EmptyState
          icon={<UsersIcon size={32} />}
          message={t("dashboard.agents_empty")}
          description={t("dashboard.agents_empty_description")}
        />
      </section>
    )
  }

  const agentStatuses: AgentStatus[] = agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    role: agent.role,
    isWorking: false,
    currentTask: undefined,
    elapsedTime: undefined,
  }))

  // Sort: working first, then idle
  agentStatuses.sort((a, b) => {
    if (a.isWorking && !b.isWorking) return -1
    if (!a.isWorking && b.isWorking) return 1
    return 0
  })

  return (
    <section className="flex flex-col">
      <div className="flex items-center justify-between px-1 pb-3">
        <h2 className="font-heading text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {t("dashboard.agents_title")}
        </h2>
        {status && "agentCount" in status && (
          <span className="font-heading text-xs text-muted-foreground">
            {status.agentCount} {t("dashboard.agents_count")}
          </span>
        )}
      </div>

      {/* Desktop: vertical list */}
      <div className="hidden flex-col gap-0 md:flex">
        {agentStatuses.map((agent) => (
          <AgentStatusCard key={agent.id} agent={agent} />
        ))}
      </div>

      {/* Mobile: horizontal scroll */}
      <div className="flex gap-2 overflow-x-auto pb-2 md:hidden">
        {agentStatuses.map((agent) => (
          <div key={agent.id} className="w-[160px] shrink-0">
            <AgentStatusCard agent={agent} />
          </div>
        ))}
      </div>
    </section>
  )
}
