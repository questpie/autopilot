import { useQuery } from "@tanstack/react-query"
import { UserIcon, RobotIcon } from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { agentsQuery } from "@/features/team/team.queries"
import { cn } from "@/lib/utils"

interface MentionAutocompleteProps {
  filter: string
  selectedIndex: number
  onSelect: (mention: string) => void
}

interface AgentItem {
  id: string
  name: string
  type: "agent" | "human"
}

export function MentionAutocomplete({
  filter,
  selectedIndex,
  onSelect,
}: MentionAutocompleteProps) {
  const { t } = useTranslation()
  const { data: agents } = useQuery(agentsQuery)

  const items: AgentItem[] = (
    (agents ?? []) as Array<{ id: string; name: string }>
  )
    .map((a) => ({ id: a.id, name: a.name, type: "agent" as const }))
    .filter((a) =>
      a.name.toLowerCase().includes(filter.toLowerCase()) ||
      a.id.toLowerCase().includes(filter.toLowerCase()),
    )

  // Add a "human" mention option
  const allItems: AgentItem[] = [
    ...items,
    ...(filter === "" || "human".includes(filter.toLowerCase())
      ? [{ id: "human", name: "Human", type: "human" as const }]
      : []),
  ]

  if (allItems.length === 0) return null

  // Group by type
  const agentItems = allItems.filter((i) => i.type === "agent")
  const humanItems = allItems.filter((i) => i.type === "human")

  let globalIndex = 0

  return (
    <div className="absolute bottom-full left-0 z-50 mb-1 w-56 border border-border bg-card py-1 shadow-lg">
      {agentItems.length > 0 && (
        <>
          <div className="px-3 py-1 font-heading text-[10px] uppercase tracking-widest text-muted-foreground">
            {t("chat.mention_agents")}
          </div>
          {agentItems.map((item) => {
            const idx = globalIndex++
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors",
                  idx === selectedIndex
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                <RobotIcon size={14} className="shrink-0" />
                <span className="font-heading">{item.name}</span>
                <span className="text-muted-foreground/60">{item.id}</span>
              </button>
            )
          })}
        </>
      )}

      {humanItems.length > 0 && (
        <>
          <div className="px-3 py-1 font-heading text-[10px] uppercase tracking-widest text-muted-foreground">
            {t("chat.mention_humans")}
          </div>
          {humanItems.map((item) => {
            const idx = globalIndex++
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors",
                  idx === selectedIndex
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                <UserIcon size={14} className="shrink-0" />
                <span className="font-heading">{item.name}</span>
              </button>
            )
          })}
        </>
      )}
    </div>
  )
}
