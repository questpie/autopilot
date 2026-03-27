import { useMemo } from "react"
import { RobotIcon } from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getAvatarColor } from "@/features/team/agent-card"
import type { FileViewProps } from "@/lib/view-registry"

interface AgentConfig {
  name: string
  role: string
  model?: string
  description?: string
  provider?: string
}

/**
 * Basic YAML parser for agents.yaml — extracts agent entries.
 */
function parseAgentsYaml(content: string): AgentConfig[] {
  const agents: AgentConfig[] = []
  const lines = content.split("\n")
  let current: Partial<AgentConfig> | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith("- name:")) {
      if (current?.name) agents.push(current as AgentConfig)
      current = { name: trimmed.slice(7).trim() }
    } else if (current && trimmed.startsWith("role:")) {
      current.role = trimmed.slice(5).trim()
    } else if (current && trimmed.startsWith("model:")) {
      current.model = trimmed.slice(6).trim()
    } else if (current && trimmed.startsWith("description:")) {
      current.description = trimmed.slice(12).trim()
    } else if (current && trimmed.startsWith("provider:")) {
      current.provider = trimmed.slice(9).trim()
    }
  }
  if (current?.name) agents.push(current as AgentConfig)

  return agents
}


/**
 * Agent cards grid view for agents.yaml.
 * Displays each agent as a card with name, role, model info.
 */
function AgentCardsView({ content }: FileViewProps) {
  const { t } = useTranslation()
  const agents = useMemo(() => parseAgentsYaml(content), [content])

  if (agents.length === 0) {
    return (
      <div className="p-6">
        <p className="text-xs text-muted-foreground">{t("files.no_agents")}</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h2 className="mb-4 font-heading text-lg font-bold text-foreground">
        {t("files.agent_team", { count: agents.length })}
      </h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <div
            key={agent.name}
            className="flex flex-col gap-3 border border-border p-4 transition-colors hover:bg-muted/30"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center bg-muted">
                <RobotIcon size={18} className="text-muted-foreground" />
              </div>
              <div className="flex flex-col">
                <span className="font-heading text-sm font-medium text-foreground">
                  {agent.name}
                </span>
                <Badge
                  variant="secondary"
                  className={cn(
                    "w-fit rounded-none text-[9px] text-white",
                    getAvatarColor(agent.name),
                  )}
                >
                  {agent.role}
                </Badge>
              </div>
            </div>

            {agent.description && (
              <p className="text-xs text-muted-foreground">{agent.description}</p>
            )}

            <div className="flex flex-wrap gap-1.5">
              {agent.model && (
                <span className="font-mono text-[10px] text-muted-foreground">
                  {agent.model}
                </span>
              )}
              {agent.provider && (
                <span className="font-mono text-[10px] text-muted-foreground">
                  ({agent.provider})
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default AgentCardsView
