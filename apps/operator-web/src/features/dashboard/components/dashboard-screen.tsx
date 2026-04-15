import { useNavigate } from '@tanstack/react-router'
import { ChatCircle, Folder, SquaresFour } from '@phosphor-icons/react'
import { useAgents } from '@/hooks/use-agents'
import { useWorkers } from '@/hooks/use-workers'
import { useTasks } from '@/hooks/use-tasks'
import { useChatSessions } from '@/hooks/use-chat-sessions'
import { useSession } from '@/hooks/use-session'
import { useSetLayoutMode } from '@/features/shell/layout-mode-context'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusPill } from '@/components/ui/status-pill'
import { EmptyState } from '@/components/ui/empty-state'
import { taskStatusToPill } from '@/lib/status-colors'
import { composeConversations } from '@/api/conversations.api'
import { useQueryList } from '@/hooks/use-queries'
import { useMemo } from 'react'

// ── Stat card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string | number
  loading?: boolean
}

function StatCard({ label, value, loading }: StatCardProps) {
  return (
    <div className="bg-muted/40 p-4">
      <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-16" />
      ) : (
        <p className="mt-1 font-mono text-2xl font-bold text-foreground">{value}</p>
      )}
    </div>
  )
}

// ── Dashboard screen ──────────────────────────────────────────────────────────

export function DashboardScreen() {
  useSetLayoutMode('wide')

  const navigate = useNavigate()
  const { user } = useSession()

  const agentsQuery = useAgents()
  const workersQuery = useWorkers()
  const tasksQuery = useTasks()
  const sessionsQuery = useChatSessions()
  const queriesQuery = useQueryList()

  // Compose recent conversations from sessions + queries + tasks
  const conversations = useMemo(() => {
    const sessions = sessionsQuery.data ?? []
    const queries = queriesQuery.data ?? []
    const tasks = tasksQuery.data ?? []
    return composeConversations(sessions, queries, tasks)
  }, [sessionsQuery.data, queriesQuery.data, tasksQuery.data])

  const recentConversations = conversations.slice(0, 8)

  // Active = tasks that are currently running
  const activeTasks = (tasksQuery.data ?? []).filter(
    (t) => t.status === 'active' || t.status === 'blocked',
  )

  const connectedWorkers = (workersQuery.data ?? []).filter(
    (w) => w.status === 'online' || w.status === 'busy',
  )

  // Greeting
  const firstName = user?.name?.split(' ')[0] ?? 'there'
  const now = new Date()
  const dateStr = now.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const isStatsLoading =
    agentsQuery.isLoading || workersQuery.isLoading || tasksQuery.isLoading || sessionsQuery.isLoading

  return (
    <div className="space-y-8">
      {/* Welcome section */}
      <div>
        <p className="font-mono text-lg font-medium text-foreground">
          Hello, {firstName}
        </p>
        <p className="font-mono text-xs text-muted-foreground">{dateStr}</p>
      </div>

      {/* Quick stats grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Agents"
          value={agentsQuery.data?.length ?? 0}
          loading={agentsQuery.isLoading}
        />
        <StatCard
          label="Running tasks"
          value={activeTasks.length}
          loading={tasksQuery.isLoading}
        />
        <StatCard
          label="Conversations"
          value={conversations.length}
          loading={sessionsQuery.isLoading}
        />
        <StatCard
          label="Connected workers"
          value={connectedWorkers.length}
          loading={workersQuery.isLoading}
        />
      </div>

      {/* Quick actions */}
      <div>
        <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Quick actions
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="font-mono text-xs"
            onClick={() => void navigate({ to: '/chat' })}
          >
            <ChatCircle size={14} />
            New conversation
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="font-mono text-xs"
            onClick={() => void navigate({ to: '/files' })}
          >
            <Folder size={14} />
            View files
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="font-mono text-xs"
            onClick={() => void navigate({ to: '/tasks' })}
          >
            <SquaresFour size={14} />
            View tasks
          </Button>
        </div>
      </div>

      {/* Recent conversations */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Recent conversations
          </p>
          <Button
            variant="ghost"
            size="xs"
            className="font-mono text-xs text-muted-foreground"
            onClick={() => void navigate({ to: '/chat', search: { view: 'history' } })}
          >
            View all
          </Button>
        </div>

        {sessionsQuery.isLoading || isStatsLoading ? (
          <div className="bg-muted/40">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        ) : recentConversations.length === 0 ? (
          <EmptyState
            title="No conversations yet"
            description="Start a chat to see recent conversations here."
            height="h-32"
          />
        ) : (
          <div className="bg-muted/40">
            {recentConversations.map((conv) => (
              <button
                key={conv.session.id}
                type="button"
                onClick={() =>
                  void navigate({ to: '/chat', search: { sessionId: conv.session.id } })
                }
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="truncate text-sm text-foreground">
                    {conv.title || 'Untitled conversation'}
                  </span>
                  {conv.task && (
                    <StatusPill
                      status={taskStatusToPill(conv.task.status)}
                      className="shrink-0"
                    />
                  )}
                </div>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                  {conv.time}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Active tasks — only shown when there are running tasks */}
      {!tasksQuery.isLoading && activeTasks.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Active tasks
            </p>
            <Button
              variant="ghost"
              size="xs"
              className="font-mono text-xs text-muted-foreground"
              onClick={() => void navigate({ to: '/tasks', search: { filter: 'active' } })}
            >
              View all
            </Button>
          </div>
          <div className="bg-muted/40">
            {activeTasks.slice(0, 5).map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => void navigate({ to: '/tasks', search: { taskId: task.id } })}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted"
              >
                <span className="truncate text-sm text-foreground">{task.title}</span>
                <StatusPill status={taskStatusToPill(task.status)} className="shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
