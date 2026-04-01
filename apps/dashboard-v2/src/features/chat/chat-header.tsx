import { useQuery } from "@tanstack/react-query"
import { UsersIcon } from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { channelDetailQuery, channelMembersQuery } from "./chat.queries"

interface ChatHeaderProps {
  channelId: string
  compact?: boolean
}

export function ChatHeader({ channelId, compact = false }: ChatHeaderProps) {
  const { t } = useTranslation()

  const { data: channel } = useQuery(channelDetailQuery(channelId))
  const { data: members } = useQuery(channelMembersQuery(channelId))

  const memberCount = Array.isArray(members) ? members.length : 0
  const channelName = (channel && typeof channel === "object" && "name" in channel)
    ? String(channel.name)
    : channelId

  const isLive = Array.isArray(members) && members.some(
    (m) => typeof m === "object" && m !== null && "sessionStatus" in m && m.sessionStatus === "working",
  )

  return (
    <div
      className={cn(
        "flex items-center gap-2 border-b border-border px-3 py-2",
        compact && "py-1.5",
      )}
    >
      <span
        className={cn(
          "flex-1 truncate font-heading font-semibold",
          compact ? "text-xs" : "text-sm",
        )}
      >
        {channelName}
      </span>

      {isLive && (
        <span className="flex items-center gap-1 bg-green-500/15 px-1.5 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider text-green-500">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-500 opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-green-500" />
          </span>
          {t("chat.live")}
        </span>
      )}

      {memberCount > 0 && (
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <UsersIcon size={12} />
          {memberCount}
        </span>
      )}
    </div>
  )
}
