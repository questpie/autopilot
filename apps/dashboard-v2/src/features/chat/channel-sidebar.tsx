import { useState, useMemo } from "react"
import { Link, useParams } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import {
  HashIcon,
  UserIcon,
  ListChecksIcon,
  CaretDownIcon,
  CaretRightIcon,
  PlusIcon,
  CircleIcon,
} from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { channelsQuery } from "@/features/chat/chat.queries"
import { agentsQuery } from "@/features/team/team.queries"
import { ScrollArea } from "@/components/ui/scroll-area"

interface Channel {
  id: string
  name: string
  type: "group" | "direct" | "broadcast"
  description?: string
  metadata?: Record<string, unknown>
}

interface Agent {
  id: string
  name: string
  type?: string
  status?: "online" | "working" | "offline"
  avatar?: string
}

const TASK_PATTERN = /^(?:task-|[A-Z]+-\d+$)/

function StatusDot({ status }: { status?: string }) {
  const color =
    status === "online"
      ? "text-green-500"
      : status === "working"
        ? "text-yellow-500"
        : "text-muted-foreground/40"

  return <CircleIcon size={8} weight="fill" className={cn("shrink-0", color)} />
}

function SectionHeader({
  label,
  collapsed,
  onToggle,
  count,
  onAction,
  actionLabel,
}: {
  label: string
  collapsed: boolean
  onToggle: () => void
  count: number
  onAction?: () => void
  actionLabel?: string
}) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1 font-heading text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
      >
        {collapsed ? <CaretRightIcon size={10} /> : <CaretDownIcon size={10} />}
        {label}
        <span className="text-muted-foreground/50">({count})</span>
      </button>
      {onAction && (
        <button
          type="button"
          onClick={onAction}
          className="text-muted-foreground transition-colors hover:text-foreground"
          title={actionLabel}
        >
          <PlusIcon size={12} />
        </button>
      )}
    </div>
  )
}

function ChannelItem({
  id,
  label,
  icon,
  isActive,
  suffix,
}: {
  id: string
  label: string
  icon: React.ReactNode
  isActive: boolean
  suffix?: React.ReactNode
}) {
  return (
    <Link
      to="/channels/$channelId"
      params={{ channelId: id }}
      className={cn(
        "group flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors",
        isActive
          ? "border-l-2 border-primary bg-primary/5 text-foreground"
          : "border-l-2 border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
    >
      {icon}
      <span className="flex-1 truncate font-heading text-xs">{label}</span>
      {suffix}
    </Link>
  )
}

export function ChannelSidebar() {
  const { t } = useTranslation()
  const params = useParams({ strict: false }) as { channelId?: string }
  const activeId = params.channelId

  const { data: channelsData } = useQuery(channelsQuery)
  const { data: agentsData } = useQuery(agentsQuery)

  const channels = (channelsData ?? []) as Channel[]
  const agents = (agentsData ?? []) as Agent[]

  const [channelsCollapsed, setChannelsCollapsed] = useState(false)
  const [peopleCollapsed, setPeopleCollapsed] = useState(false)
  const [tasksCollapsed, setTasksCollapsed] = useState(false)

  const { groupChannels, taskChannels } = useMemo(() => {
    const groupChannels: Channel[] = []
    const taskChannels: Channel[] = []

    for (const ch of channels) {
      if (TASK_PATTERN.test(ch.id)) {
        taskChannels.push(ch)
      } else if (ch.type === "group" || ch.type === "broadcast") {
        groupChannels.push(ch)
      }
    }

    return { groupChannels, taskChannels }
  }, [channels])

  const people = useMemo(() => {
    const dmChannels = channels.filter((c) => c.type === "direct")
    const agentItems = agents.map((a) => ({
      id: a.id,
      name: a.name,
      status: a.status,
    }))
    const humanItems = dmChannels.map((c) => ({
      id: c.id,
      name: c.name,
      status: "online" as const,
    }))

    return [...agentItems, ...humanItems]
  }, [agents, channels])

  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="flex items-center justify-between border-b border-border px-3 py-3">
        <h2 className="font-heading text-sm font-semibold">
          {t("chat.title")}
        </h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1 py-2">
          <SectionHeader
            label={t("chat.channels")}
            collapsed={channelsCollapsed}
            onToggle={() => setChannelsCollapsed((p) => !p)}
            count={groupChannels.length}
          />
          {!channelsCollapsed &&
            groupChannels.map((ch) => (
              <ChannelItem
                key={ch.id}
                id={ch.id}
                label={`#${ch.name}`}
                icon={<HashIcon size={14} className="shrink-0" />}
                isActive={ch.id === activeId}
              />
            ))}

          <SectionHeader
            label={t("chat.direct_messages")}
            collapsed={peopleCollapsed}
            onToggle={() => setPeopleCollapsed((p) => !p)}
            count={people.length}
          />
          {!peopleCollapsed &&
            people.map((p) => (
              <ChannelItem
                key={p.id}
                id={p.id}
                label={p.name}
                icon={<UserIcon size={14} className="shrink-0" />}
                isActive={p.id === activeId}
                suffix={<StatusDot status={p.status} />}
              />
            ))}

          {taskChannels.length > 0 && (
            <>
              <SectionHeader
                label={t("chat.task_threads")}
                collapsed={tasksCollapsed}
                onToggle={() => setTasksCollapsed((p) => !p)}
                count={taskChannels.length}
              />
              {!tasksCollapsed &&
                taskChannels.map((ch) => (
                  <ChannelItem
                    key={ch.id}
                    id={ch.id}
                    label={ch.name}
                    icon={<ListChecksIcon size={14} className="shrink-0" />}
                    isActive={ch.id === activeId}
                  />
                ))}
            </>
          )}
        </div>
      </ScrollArea>
    </aside>
  )
}
