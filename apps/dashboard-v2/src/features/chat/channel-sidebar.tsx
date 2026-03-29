import { useState, useMemo, useCallback, useEffect } from "react"
import {
  PlusIcon,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { CategoryHeader } from "./sidebar-category"
import {
  AgentChannelItem,
  GroupChannelItem,
  TaskChannelItem,
  type Channel,
} from "./sidebar-channel-item"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
// Main sidebar component
// ---------------------------------------------------------------------------

const EMPTY_AGENT_IDS: string[] = []

export function ChannelSidebar({
  channels,
  activeChannelId,
  onCreateChannel,
  workingAgentIds = EMPTY_AGENT_IDS,
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
                categoryKey={cat.key}
                onToggleCategory={toggleCategory}
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
