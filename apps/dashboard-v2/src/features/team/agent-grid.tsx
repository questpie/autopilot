import { useSuspenseQuery } from "@tanstack/react-query"
import { UserPlusIcon } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { useTranslation } from "@/lib/i18n"
import { agentsQuery } from "./team.queries"
import { AgentCard } from "./agent-card"

function HumanCard({ name, role, pendingCount }: { name: string; role: string; pendingCount: number }) {
  const initial = name.charAt(0).toUpperCase()

  return (
    <div className="flex flex-col items-center gap-2 border border-border p-4">
      <div className="flex h-12 w-12 items-center justify-center bg-muted text-lg font-bold text-muted-foreground">
        {initial}
      </div>
      <span className="font-heading text-sm font-medium text-foreground">
        {name}
      </span>
      <Badge variant="secondary" className="text-[10px]">
        {role}
      </Badge>
      {pendingCount > 0 && (
        <span className="font-heading text-[10px] text-muted-foreground">
          {pendingCount} pending
        </span>
      )}
    </div>
  )
}

export function AgentGrid() {
  const { t } = useTranslation()
  const { data: agents } = useSuspenseQuery(agentsQuery)

  const agentList = agents ?? []

  if (agentList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <UserPlusIcon size={32} className="text-muted-foreground" />
        <p className="font-heading text-sm text-muted-foreground">
          {t("team.no_agents")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("team.no_agents_description")}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Agents section */}
      <section>
        <div className="flex items-center gap-2 px-1 pb-3">
          <h2 className="font-heading text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {t("team.agents")}
          </h2>
          <Badge variant="secondary" className="text-[10px]">
            {agentList.length}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-0 lg:grid-cols-3">
          {agentList.map((agent, index) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              isWorking={false}
              taskCount={0}
              index={index}
            />
          ))}
        </div>
      </section>

      {/* Humans section */}
      <section>
        <div className="flex items-center gap-2 px-1 pb-3">
          <h2 className="font-heading text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {t("team.humans")}
          </h2>
          <Badge variant="secondary" className="text-[10px]">
            1
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-0 lg:grid-cols-3">
          <HumanCard name="Owner" role="Owner" pendingCount={0} />
        </div>
      </section>
    </div>
  )
}
