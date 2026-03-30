import { useQuery } from "@tanstack/react-query"
import { agentsQuery } from "@/features/team/team.queries"
import { pinnedMessagesQuery } from "./chat.queries"
import { useChatUIStore } from "./chat-ui.store"
import { cn } from "@/lib/utils"
import { CircleIcon, GearIcon, CircleNotchIcon, PushPinIcon } from "@phosphor-icons/react"

interface ChatHeaderProps {
  /** Agent ID for DM chat headers. */
  agentId?: string | null
  /** Channel name for group chat headers. */
  channelName?: string
  /** Channel ID for pin count. */
  channelId?: string
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
  channelId,
  isWorking = false,
  compact = false,
}: ChatHeaderProps) {
  const { data: agents } = useQuery(agentsQuery)
  const { data: pins } = useQuery(pinnedMessagesQuery(channelId ?? ''))
  const setPinnedPanelOpen = useChatUIStore((s) => s.setPinnedPanelOpen)
  const pinnedPanelOpen = useChatUIStore((s) => s.pinnedPanelOpen)
  const agent = agentId ? (agents as Array<{ id: string; name: string; role: string; model?: string }> | undefined)?.find((a) => a.id === agentId) : null

  const title = agent?.name ?? agentId ?? channelName ?? "Chat"
  const subtitle = agent?.role ?? null
  const model = agent?.model ?? null
  const pinCount = pins?.length ?? 0

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
              <CircleIcon size={14} weight="fill" className="text-success/70" />
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

      {/* Pin count button */}
      {channelId && pinCount > 0 && (
        <button
          type="button"
          onClick={() => setPinnedPanelOpen(!pinnedPanelOpen)}
          className={cn(
            "flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground/50 transition-colors hover:bg-muted/50 hover:text-foreground",
            pinnedPanelOpen && "bg-muted/50 text-foreground",
          )}
          title={`${pinCount} pinned message${pinCount === 1 ? '' : 's'}`}
        >
          <PushPinIcon size={14} />
          <span className="text-[10px] font-medium">{pinCount}</span>
        </button>
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
