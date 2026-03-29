import { useQuery } from "@tanstack/react-query"
import { channelsQuery } from "./chat.queries"
import { cn } from "@/lib/utils"
import { CircleIcon, CircleNotchIcon } from "@phosphor-icons/react"

interface DmSidebarProps {
  activeChannelId: string | null
  onSelectChannel: (id: string) => void
  /** Agent IDs that are currently typing/working. */
  workingAgentIds?: string[]
  compact?: boolean
}

interface Channel {
  id: string
  name: string
  type: string
  updated_at: string
}

/**
 * D24: DM list sidebar with online/working status, sorted by recent activity.
 */
export function DmSidebar({
  activeChannelId,
  onSelectChannel,
  workingAgentIds = [],
  compact = false,
}: DmSidebarProps) {
  const { data: channels } = useQuery(channelsQuery)

  // Filter to DM channels only, sort by recent activity
  const dmChannels = ((channels ?? []) as Channel[])
    .filter((c) => c.type === "direct")
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())

  if (dmChannels.length === 0) {
    return (
      <div className="px-3 py-4 text-center text-[11px] text-muted-foreground">
        No direct messages yet.
      </div>
    )
  }

  return (
    <div className="space-y-0.5 py-1">
      {dmChannels.map((channel) => {
        const isActive = channel.id === activeChannelId
        // Extract agent ID from DM channel name pattern "dm-{userA}--{userB}"
        const agentId = channel.id.startsWith("dm-")
          ? channel.id.replace("dm-", "").split("--").find((id) => !id.startsWith("user-") && !id.startsWith("anonymous"))
          : null
        const isWorking = agentId ? workingAgentIds.includes(agentId) : false

        return (
          <button
            key={channel.id}
            type="button"
            onClick={() => onSelectChannel(channel.id)}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors",
              isActive
                ? "bg-primary/10 text-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              compact && "py-1 text-xs",
            )}
          >
            {/* Status indicator */}
            <span className="shrink-0">
              {isWorking ? (
                <CircleNotchIcon size={10} className="animate-spin text-primary" />
              ) : (
                <CircleIcon size={8} weight="fill" className="text-green-500/50" />
              )}
            </span>

            {/* Name */}
            <span className="min-w-0 flex-1 truncate">{channel.name}</span>

            {/* Working label */}
            {isWorking && (
              <span className="shrink-0 text-[9px] text-primary/60">working</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
