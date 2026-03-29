import { memo } from "react"
import { Link } from "@tanstack/react-router"
import {
  HashIcon,
  ListChecksIcon,
  CircleIcon,
  CircleNotchIcon,
  AtIcon,
} from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Types (shared with channel-sidebar)
// ---------------------------------------------------------------------------

export interface Channel {
  id: string
  name: string
  type: "group" | "direct" | "broadcast"
  description?: string
  metadata?: Record<string, unknown>
  updated_at?: string
}

// ---------------------------------------------------------------------------
// AgentChannelItem
// ---------------------------------------------------------------------------

export const AgentChannelItem = memo(function AgentChannelItem({
  channel,
  isActive,
  isWorking,
}: {
  channel: Channel
  isActive: boolean
  isWorking: boolean
}) {
  return (
    <Link
      to="/chat/$channelId"
      params={{ channelId: channel.id }}
      className={cn(
        "group flex items-center gap-2 rounded-sm px-2 py-1 text-sm transition-colors",
        isActive
          ? "bg-primary/10 text-foreground"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
    >
      {/* @ prefix */}
      <AtIcon size={14} className="shrink-0 text-muted-foreground/60" />

      {/* Name */}
      <span
        className={cn(
          "min-w-0 flex-1 truncate font-heading text-xs",
          !!channel.metadata?.unread && "font-semibold text-foreground",
        )}
      >
        {channel.name}
      </span>

      {/* Unread badge */}
      {typeof channel.metadata?.unread === "number" && channel.metadata.unread > 0 ? (
        <span className="shrink-0 rounded-full bg-primary px-1.5 text-[10px] font-medium text-primary-foreground">
          {channel.metadata.unread}
        </span>
      ) : null}

      {/* Status dot */}
      <span className="shrink-0">
        {isWorking ? (
          <CircleNotchIcon size={10} className="animate-spin text-yellow-400" />
        ) : (
          <CircleIcon
            size={8}
            weight="fill"
            className="text-green-500/50"
          />
        )}
      </span>
    </Link>
  )
})

// ---------------------------------------------------------------------------
// GroupChannelItem
// ---------------------------------------------------------------------------

export const GroupChannelItem = memo(function GroupChannelItem({
  channel,
  isActive,
}: {
  channel: Channel
  isActive: boolean
}) {
  const unreadCount =
    typeof channel.metadata?.unread === "number"
      ? channel.metadata.unread
      : 0

  return (
    <Link
      to="/chat/$channelId"
      params={{ channelId: channel.id }}
      className={cn(
        "group flex items-center gap-2 rounded-sm px-2 py-1 text-sm transition-colors",
        isActive
          ? "bg-primary/10 text-foreground"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
    >
      <HashIcon size={14} className="shrink-0 text-muted-foreground/60" />
      <span
        className={cn(
          "min-w-0 flex-1 truncate font-heading text-xs",
          unreadCount > 0 && "font-semibold text-foreground",
        )}
      >
        {channel.name}
      </span>
      {unreadCount > 0 ? (
        <span className="shrink-0 rounded-full bg-primary px-1.5 text-[10px] font-medium text-primary-foreground">
          {unreadCount}
        </span>
      ) : null}
    </Link>
  )
})

// ---------------------------------------------------------------------------
// TaskChannelItem
// ---------------------------------------------------------------------------

export const TaskChannelItem = memo(function TaskChannelItem({
  channel,
  isActive,
}: {
  channel: Channel
  isActive: boolean
}) {
  // Derive status from metadata if available
  const status = (channel.metadata?.status as string) ?? "unknown"
  const statusColor =
    status === "done" || status === "completed"
      ? "text-green-500"
      : status === "in_progress"
        ? "text-yellow-400"
        : "text-muted-foreground/40"

  return (
    <Link
      to="/chat/$channelId"
      params={{ channelId: channel.id }}
      className={cn(
        "group flex items-center gap-2 rounded-sm px-2 py-1 text-sm transition-colors",
        isActive
          ? "bg-primary/10 text-foreground"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
    >
      <ListChecksIcon size={14} className="shrink-0 text-muted-foreground/60" />
      <span className="min-w-0 flex-1 truncate font-heading text-xs">
        {channel.name}
      </span>
      <CircleIcon size={8} weight="fill" className={cn("shrink-0", statusColor)} />
    </Link>
  )
})
