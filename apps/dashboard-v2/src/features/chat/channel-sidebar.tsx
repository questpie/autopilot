import { useState, useMemo, useCallback, useEffect, memo } from "react"
import { Link } from "@tanstack/react-router"
import {
  HashIcon,
  ListChecksIcon,
  CircleIcon,
  PlusIcon,
  CaretDownIcon,
  MagnifyingGlassIcon,
  CircleNotchIcon,
  AtIcon,
} from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Channel {
  id: string
  name: string
  type: "group" | "direct" | "broadcast"
  description?: string
  metadata?: Record<string, unknown>
  updated_at?: string
}

interface ChannelSidebarProps {
  channels: Channel[]
  activeChannelId?: string
  onCreateChannel: () => void
  /** Agent IDs currently working — shows yellow indicator. */
  workingAgentIds?: string[]
}

interface CategoryDef {
  key: string
  labelKey: string
  channels: Channel[]
}

// ---------------------------------------------------------------------------
// localStorage helpers for collapsed state
// ---------------------------------------------------------------------------

const COLLAPSED_KEY = "chat-sidebar-collapsed"

function loadCollapsed(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveCollapsed(state: Record<string, boolean>) {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(state))
  } catch {
    // silent
  }
}

// ---------------------------------------------------------------------------
// Category header
// ---------------------------------------------------------------------------

const CategoryHeader = memo(function CategoryHeader({
  label,
  collapsed,
  onToggle,
  action,
}: {
  label: string
  collapsed: boolean
  onToggle: () => void
  action?: React.ReactNode
}) {
  return (
    <div className="group flex items-center px-2 pt-4 pb-0.5">
      <button
        type="button"
        onClick={onToggle}
        className="flex flex-1 items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
      >
        <CaretDownIcon
          size={10}
          className={cn(
            "shrink-0 transition-transform",
            collapsed && "-rotate-90",
          )}
        />
        {label}
      </button>
      {action && (
        <span className="opacity-0 transition-opacity group-hover:opacity-100">
          {action}
        </span>
      )}
    </div>
  )
})

// ---------------------------------------------------------------------------
// Channel items
// ---------------------------------------------------------------------------

const AgentChannelItem = memo(function AgentChannelItem({
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

const GroupChannelItem = memo(function GroupChannelItem({
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

const TaskChannelItem = memo(function TaskChannelItem({
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

// ---------------------------------------------------------------------------
// Main sidebar component
// ---------------------------------------------------------------------------

export function ChannelSidebar({
  channels,
  activeChannelId,
  onCreateChannel,
  workingAgentIds = [],
}: ChannelSidebarProps) {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(loadCollapsed)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  // Persist collapsed state
  const toggleCategory = useCallback(
    (key: string) => {
      setCollapsed((prev) => {
        const next = { ...prev, [key]: !prev[key] }
        saveCollapsed(next)
        return next
      })
    },
    [],
  )

  // Categorise channels
  const categories = useMemo((): CategoryDef[] => {
    const lowerSearch = debouncedSearch.toLowerCase()
    const filtered = debouncedSearch
      ? channels.filter((c) => c.name.toLowerCase().includes(lowerSearch))
      : channels

    const dmChannels = filtered
      .filter((c) => c.type === "direct")
      .sort((a, b) => {
        const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0
        const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0
        return bTime - aTime
      })

    const taskChannels = filtered.filter(
      (c) => c.id.startsWith("task-") || c.id.match(/^[A-Z]+-\d+$/),
    )
    const taskIds = new Set(taskChannels.map((c) => c.id))

    const groupChannels = filtered.filter(
      (c) => (c.type === "group" || c.type === "broadcast") && !taskIds.has(c.id),
    )

    return [
      { key: "agents", labelKey: "chat.agents", channels: dmChannels },
      { key: "channels", labelKey: "chat.channels", channels: groupChannels },
      { key: "tasks", labelKey: "chat.task_threads", channels: taskChannels },
    ]
  }, [channels, debouncedSearch])

  // Extract agent ID from DM channel pattern "dm-{userA}--{userB}"
  const getAgentId = useCallback((channel: Channel): string | null => {
    if (!channel.id.startsWith("dm-")) return null
    return (
      channel.id
        .replace("dm-", "")
        .split("--")
        .find((id) => !id.startsWith("user-") && !id.startsWith("anonymous")) ??
      null
    )
  }, [])

  return (
    <div className="flex flex-col">
      {/* Search */}
      <div className="px-2 pt-3 pb-1">
        <div className="flex items-center gap-2 rounded-sm border border-border bg-muted/30 px-2 py-1.5">
          <MagnifyingGlassIcon size={14} className="shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("chat.search_channels")}
            className="min-w-0 flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 outline-none"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex flex-col gap-0.5 overflow-y-auto px-1 pb-4">
        {categories.map((cat) => {
          if (cat.channels.length === 0 && !debouncedSearch) return null

          const isCollapsed = collapsed[cat.key] ?? false

          return (
            <div key={cat.key}>
              <CategoryHeader
                label={t(cat.labelKey)}
                collapsed={isCollapsed}
                onToggle={() => toggleCategory(cat.key)}
                action={
                  cat.key === "channels" ? (
                    <button
                      type="button"
                      onClick={onCreateChannel}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                      title={t("chat.new_channel")}
                    >
                      <PlusIcon size={14} />
                    </button>
                  ) : undefined
                }
              />

              {!isCollapsed && (
                <div className="mt-0.5 flex flex-col gap-px">
                  {cat.channels.length === 0 ? (
                    <span className="px-2 py-1 text-[10px] text-muted-foreground/40">
                      {t("common.none")}
                    </span>
                  ) : (
                    cat.channels.map((channel) => {
                      const isActive = channel.id === activeChannelId

                      if (cat.key === "agents") {
                        const agentId = getAgentId(channel)
                        const isWorking = agentId
                          ? workingAgentIds.includes(agentId)
                          : false
                        return (
                          <AgentChannelItem
                            key={channel.id}
                            channel={channel}
                            isActive={isActive}
                            isWorking={isWorking}
                          />
                        )
                      }

                      if (cat.key === "tasks") {
                        return (
                          <TaskChannelItem
                            key={channel.id}
                            channel={channel}
                            isActive={isActive}
                          />
                        )
                      }

                      return (
                        <GroupChannelItem
                          key={channel.id}
                          channel={channel}
                          isActive={isActive}
                        />
                      )
                    })
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
