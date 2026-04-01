import { Suspense, useState, type FormEvent } from "react"
import { useNavigate, Link } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import {
  PaperPlaneRightIcon,
  ChatCircleIcon,
  TrayIcon,
  UsersIcon,
  ClockIcon,
} from "@phosphor-icons/react"
import { m } from "framer-motion"
import { authClient } from "@/lib/auth"
import { channelsQuery } from "@/features/chat/chat.queries"
import { unreadNotificationsQuery } from "@/features/notifications/notification.queries"
import { agentsQuery } from "@/features/team/team.queries"
import { formatTimeAgo } from "@/features/tasks/task-list-item"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

/** Hero section with greeting and chat input */
function WelcomeHero() {
  const navigate = useNavigate()
  const session = authClient.useSession()
  const [message, setMessage] = useState("")

  const userName = session.data?.user?.name ?? ""
  // TODO: i18n greeting
  const greeting = userName
    ? `${getGreeting()}, ${userName}`
    : getGreeting()

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = message.trim()
    if (!trimmed) return
    // Navigate to /chat with the message as a search param
    void navigate({ to: "/chat", search: { message: trimmed } })
  }

  return (
    <section className="flex flex-col items-center gap-6 py-8 text-center">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          {greeting}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {/* TODO: i18n */}
          How can I help you today?
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-lg items-center gap-2"
      >
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask anything..."
          className="h-10 flex-1 text-sm"
        />
        <Button type="submit" size="default" disabled={!message.trim()}>
          <PaperPlaneRightIcon size={16} weight="fill" />
          {/* TODO: i18n */}
          Send
        </Button>
      </form>
    </section>
  )
}

/** Quick stats row */
function QuickStats() {
  return (
    <Suspense fallback={<QuickStatsSkeleton />}>
      <QuickStatsContent />
    </Suspense>
  )
}

function QuickStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4">
      {Array.from({ length: 2 }).map((_, i) => (
        <Card key={i} size="sm">
          <CardContent className="flex items-center gap-3">
            <Skeleton className="h-8 w-8" />
            <div className="flex flex-col gap-1">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function QuickStatsContent() {
  const { data: notifications } = useSuspenseQuery(unreadNotificationsQuery())
  const { data: agents } = useSuspenseQuery(agentsQuery)

  const unreadCount = Array.isArray(notifications) ? notifications.length : 0
  const agentCount = Array.isArray(agents) ? agents.length : 0

  return (
    <div className="grid grid-cols-2 gap-4">
      <Link to="/inbox" className="group">
        <Card size="sm" className="transition-colors group-hover:bg-muted/30">
          <CardContent className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-primary/10">
              <TrayIcon size={18} className="text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="font-heading text-sm font-medium">
                {unreadCount}
              </span>
              <span className="text-xs text-muted-foreground">
                {/* TODO: i18n */}
                Unread notifications
              </span>
            </div>
          </CardContent>
        </Card>
      </Link>

      <Link to="/team" className="group">
        <Card size="sm" className="transition-colors group-hover:bg-muted/30">
          <CardContent className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-primary/10">
              <UsersIcon size={18} className="text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="font-heading text-sm font-medium">
                {agentCount}
              </span>
              <span className="text-xs text-muted-foreground">
                {/* TODO: i18n */}
                Active agents
              </span>
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  )
}

/** Recent conversations section */
function RecentConversations() {
  return (
    <Suspense fallback={<RecentConversationsSkeleton />}>
      <RecentConversationsContent />
    </Suspense>
  )
}

function RecentConversationsSkeleton() {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Recent conversations
      </h2>
      <div className="flex flex-col">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border border-border p-3">
            <Skeleton className="h-8 w-8" />
            <div className="flex flex-1 flex-col gap-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    </section>
  )
}

interface Channel {
  id: string
  name: string
  type: string
  description?: string
  updated_at?: string
  last_message?: {
    content?: string
    created_at?: string
  }
}

function RecentConversationsContent() {
  const { data } = useSuspenseQuery(channelsQuery)
  const channels = (data ?? []) as Channel[]

  // Show last 8 conversations, sorted by most recent
  const recent = [...channels]
    .sort((a, b) => {
      const aTime = a.last_message?.created_at ?? a.updated_at ?? ""
      const bTime = b.last_message?.created_at ?? b.updated_at ?? ""
      return bTime.localeCompare(aTime)
    })
    .slice(0, 8)

  if (recent.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {/* TODO: i18n */}
          Recent conversations
        </h2>
        <div className="flex items-center gap-3 border border-border px-4 py-6 text-xs text-muted-foreground">
          <ChatCircleIcon size={18} />
          {/* TODO: i18n */}
          <span>No conversations yet. Start one above!</span>
        </div>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {/* TODO: i18n */}
        Recent conversations
      </h2>
      <div className="flex flex-col">
        {recent.map((channel) => (
          <m.div
            key={channel.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Link
              to="/chat/$channelId"
              params={{ channelId: channel.id }}
              className="group flex items-center gap-3 border border-border p-3 transition-colors hover:bg-muted/30"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-muted/50">
                <ChatCircleIcon
                  size={16}
                  className="text-muted-foreground group-hover:text-primary"
                />
              </div>

              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-heading text-sm font-medium text-foreground group-hover:text-primary">
                  {channel.name}
                </span>
                {channel.last_message?.content && (
                  <span className="truncate text-xs text-muted-foreground">
                    {channel.last_message.content}
                  </span>
                )}
              </div>

              {(channel.last_message?.created_at ?? channel.updated_at) && (
                <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  <ClockIcon size={12} />
                  {formatTimeAgo(
                    channel.last_message?.created_at ?? channel.updated_at ?? ""
                  )}
                </span>
              )}
            </Link>
          </m.div>
        ))}
      </div>
    </section>
  )
}

export { WelcomeHero, QuickStats, RecentConversations }
