import { useMemo } from "react"
import { Link } from "@tanstack/react-router"
import { HashIcon, UserIcon, ListChecksIcon, CircleIcon, PlusIcon } from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { Icon } from "@phosphor-icons/react"

interface Channel {
  id: string
  name: string
  type: "group" | "direct" | "broadcast"
  description?: string
  metadata?: Record<string, unknown>
}

interface ChannelListProps {
  channels: Channel[]
  activeChannelId?: string
  onCreateChannel: () => void
}

const TYPE_ICONS: Record<string, Icon> = {
  group: HashIcon,
  direct: UserIcon,
  broadcast: ListChecksIcon,
}

interface ChannelGroup {
  labelKey: string
  channels: Channel[]
}

function formatTimestamp(_channel: Channel): string {
  // In a real implementation, this would use the last message timestamp
  return ""
}

function ChannelListItem({
  channel,
  isActive,
}: {
  channel: Channel
  isActive: boolean
}) {
  const IconComponent = TYPE_ICONS[channel.type] ?? HashIcon

  return (
    <Link
      to="/chat/$channelId"
      params={{ channelId: channel.id }}
      className={cn(
        "group flex items-center gap-2.5 px-3 py-2 text-sm transition-colors",
        isActive
          ? "bg-primary/5 text-foreground"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
    >
      <IconComponent size={16} className="shrink-0" />
      <span className="flex-1 truncate font-heading text-xs">
        {channel.name}
      </span>
      {/* Unread indicator placeholder */}
      {channel.metadata?.unread ? (
        <CircleIcon size={8} weight="fill" className="shrink-0 text-primary" />
      ) : null}
      <span className="shrink-0 text-[10px] text-muted-foreground/60">
        {formatTimestamp(channel)}
      </span>
    </Link>
  )
}

function ChannelGroupSection({
  group,
  activeChannelId,
}: {
  group: ChannelGroup
  activeChannelId?: string
}) {
  const { t } = useTranslation()

  if (group.channels.length === 0) return null

  return (
    <div>
      <div className="px-3 py-2 font-heading text-[10px] uppercase tracking-widest text-muted-foreground">
        {t(group.labelKey)}
      </div>
      {group.channels.map((channel) => (
        <ChannelListItem
          key={channel.id}
          channel={channel}
          isActive={channel.id === activeChannelId}
        />
      ))}
    </div>
  )
}

export function ChannelList({
  channels,
  activeChannelId,
  onCreateChannel,
}: ChannelListProps) {
  const { t } = useTranslation()

  const groups = useMemo((): ChannelGroup[] => {
    const groupChannels = channels.filter((c) => c.type === "group" || c.type === "broadcast")
    const dmChannels = channels.filter((c) => c.type === "direct")
    // Task threads would be channels whose ID starts with a task pattern
    const taskThreads = channels.filter(
      (c) => c.id.startsWith("task-") || c.id.match(/^[A-Z]+-\d+$/),
    )
    const regularChannels = groupChannels.filter(
      (c) => !taskThreads.some((t) => t.id === c.id),
    )

    return [
      { labelKey: "chat.channels", channels: regularChannels },
      { labelKey: "chat.direct_messages", channels: dmChannels },
      { labelKey: "chat.task_threads", channels: taskThreads },
    ]
  }, [channels])

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-3">
        <h2 className="font-heading text-sm font-semibold">
          {t("chat.title")}
        </h2>
        <button
          type="button"
          onClick={onCreateChannel}
          className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          title={t("chat.new_channel")}
        >
          <PlusIcon size={14} />
        </button>
      </div>

      {/* Channel groups */}
      <div className="flex flex-col gap-2 py-2">
        {groups.map((group) => (
          <ChannelGroupSection
            key={group.labelKey}
            group={group}
            activeChannelId={activeChannelId}
          />
        ))}
      </div>
    </div>
  )
}
