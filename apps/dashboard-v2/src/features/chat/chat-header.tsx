import { useQuery } from "@tanstack/react-query"
import { agentsQuery } from "@/features/team/team.queries"
import { cn } from "@/lib/utils"
import { CircleIcon, GearIcon, CircleNotchIcon } from "@phosphor-icons/react"

interface ChatHeaderProps {
  /** Agent ID for DM chat headers. */
  agentId?: string | null
  /** Channel name for group chat headers. */
  channelName?: string
  /** Whether the agent is currently working (streaming/typing). */
  isWorking?: boolean
  compact?: boolean
}

/**
 * D20: Chat header showing agent status, model info, and settings gear.
 */
export function ChatHeader({
  agentId,
  channelName,
  isWorking = false,
  compact = false,
}: ChatHeaderProps) {
  const { data: agents } = useQuery(agentsQuery)
  const agent = agentId ? (agents as Array<{ id: string; name: string; role: string; model?: string }> | undefined)?.find((a) => a.id === agentId) : null

  const title = agent?.name ?? agentId ?? channelName ?? "Chat"
  const subtitle = agent?.role ?? null
  const model = agent?.model ?? null

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-3 border-b border-border px-4 py-2",
        compact && "px-3 py-1.5",
      )}
    >
      {/* Status dot + title */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {agentId && (
          <span className="shrink-0">
            {isWorking ? (
              <CircleNotchIcon size={14} className="animate-spin text-primary" />
            ) : (
              <CircleIcon size={14} weight="fill" className="text-green-500/70" />
            )}
          </span>
        )}

        <div className="min-w-0">
          <div className="truncate font-heading text-sm font-semibold">{title}</div>
          {subtitle && (
            <div className="truncate text-[10px] text-muted-foreground">{subtitle}</div>
          )}
        </div>
      </div>

      {/* Model badge */}
      {model && (
        <span className="shrink-0 rounded bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {model.includes("/") ? model.split("/").pop() : model}
        </span>
      )}

      {/* Settings gear */}
      <button
        type="button"
        className="shrink-0 text-muted-foreground/50 hover:text-foreground"
        title="Chat settings"
      >
        <GearIcon size={16} />
      </button>
    </div>
  )
}
