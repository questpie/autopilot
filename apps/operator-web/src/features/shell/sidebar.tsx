import { useMemo } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { ChatCircle, GearSix, Plus } from '@phosphor-icons/react'
import { SquareBuildLogo } from '@/components/brand'
import { fileIcon } from '@/lib/file-icons'
import { useChatSessions } from '@/hooks/use-chat-sessions'
import { useQueryList } from '@/hooks/use-queries'
import { useTasks } from '@/hooks/use-tasks'
import { useVfsList } from '@/hooks/use-vfs'
import { useActiveView } from '@/hooks/use-active-view'
import { composeConversations } from '@/api/conversations.api'
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from '@/components/ui/sidebar'

// ── Chat sidebar ─────────────────────────────────────────────

function ChatSidebar() {
  const sessionsQuery = useChatSessions()
  const queriesQuery = useQueryList()
  const tasksQuery = useTasks()

  const conversations = useMemo(() => {
    const sessions = sessionsQuery.data ?? []
    const queries = queriesQuery.data ?? []
    const tasks = tasksQuery.data ?? []
    return composeConversations(sessions, queries, tasks)
  }, [sessionsQuery.data, queriesQuery.data, tasksQuery.data])

  const search = useSearch({ strict: false }) as { sessionId?: string }
  const activeSessionId = search.sessionId ?? null
  const navigate = useNavigate()

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="font-mono text-[11px] font-bold uppercase tracking-widest">
        <span className="flex-1">Conversations</span>
        <button
          onClick={() => void navigate({ to: '/chat' })}
          className="flex size-5 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          title="New chat"
        >
          <Plus size={12} weight="bold" />
        </button>
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {conversations.map((conv) => {
            const isActive = conv.session.id === activeSessionId
            return (
              <SidebarMenuItem key={conv.session.id}>
                <SidebarMenuButton
                  render={<Link to="/chat" search={{ sessionId: conv.session.id }} />}
                  isActive={isActive}
                  className="font-mono text-xs"
                >
                  <ChatCircle
                    size={14}
                    weight={isActive ? 'fill' : 'regular'}
                    className="shrink-0 text-muted-foreground"
                  />
                  <span className="min-w-0 flex-1 truncate">{conv.title || 'New conversation'}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{conv.time}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
          {conversations.length === 0 && !sessionsQuery.isLoading && (
            <div className="px-3 py-4 text-center font-mono text-[11px] text-muted-foreground">
              No conversations yet
            </div>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

// ── Tasks sidebar ────────────────────────────────────────────

const TASK_FILTERS = ['all', 'active', 'backlog', 'done', 'failed'] as const
type TaskFilter = (typeof TASK_FILTERS)[number]

function TasksSidebar() {
  const { data: tasks = [] } = useTasks()
  const search = useSearch({ strict: false }) as { filter?: string }
  const activeFilter = (search.filter ?? 'all') as TaskFilter

  const counts: Record<TaskFilter, number> = {
    all: tasks.length,
    active: tasks.filter((t) => t.status === 'active' || t.status === 'blocked').length,
    backlog: tasks.filter((t) => t.status === 'backlog').length,
    done: tasks.filter((t) => t.status === 'done').length,
    failed: tasks.filter((t) => t.status === 'failed').length,
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="font-mono text-[11px] font-bold uppercase tracking-widest">
        Tasks
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {TASK_FILTERS.map((f) => (
            <SidebarMenuItem key={f}>
              <SidebarMenuButton
                render={
                  <Link
                    to="/tasks"
                    search={f === 'all' ? {} : { filter: f }}
                  />
                }
                isActive={activeFilter === f}
                className="font-mono text-xs"
              >
                <span className="flex-1 capitalize">{f}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{counts[f]}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

// ── Files sidebar ────────────────────────────────────────────

const CONFIG_ITEMS = [
  { label: 'agents', path: '.autopilot/agents' },
  { label: 'workflows', path: '.autopilot/workflows' },
  { label: 'providers', path: '.autopilot/providers' },
  { label: 'capabilities', path: '.autopilot/capabilities' },
  { label: 'scripts', path: '.autopilot/scripts' },
] as const

function FilesSidebar() {
  const search = useSearch({ strict: false }) as { path?: string; view?: string }
  const rawPath = search.path ?? ''
  // When viewing a file, list its parent directory
  const currentPath = search.view === 'file' && rawPath
    ? rawPath.split('/').slice(0, -1).join('/')
    : rawPath
  const uri = currentPath ? `company://${currentPath}` : 'company://.'
  const { data } = useVfsList(uri)

  return (
    <>
      {/* .autopilot config section */}
      <SidebarGroup>
        <SidebarGroupLabel className="font-mono text-[11px] font-bold uppercase tracking-widest">
          <GearSix size={12} className="mr-1 inline" />
          Config
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {CONFIG_ITEMS.map((item) => (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton
                  render={<Link to="/files" search={{ path: item.path }} />}
                  isActive={rawPath.startsWith(item.path)}
                  className="font-mono text-xs"
                >
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarSeparator />

      {/* File tree */}
      <SidebarGroup>
        <SidebarGroupLabel className="font-mono text-[11px] font-bold uppercase tracking-widest">
          {currentPath ? currentPath.split('/').pop() : 'Files'}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {currentPath && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link
                      to="/files"
                      search={{
                        path: currentPath.split('/').slice(0, -1).join('/') || undefined,
                      }}
                    />
                  }
                  className="font-mono text-xs text-muted-foreground"
                >
                  ..
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            {data?.entries.map((entry) => {
              const EntryIcon = fileIcon(entry.name, entry.type as 'file' | 'directory')
              return (
                <SidebarMenuItem key={entry.path}>
                  <SidebarMenuButton
                    render={
                      <Link
                        to="/files"
                        search={
                          entry.type === 'directory'
                            ? { path: entry.path }
                            : { path: entry.path, view: 'file' as const }
                        }
                      />
                    }
                    isActive={rawPath === entry.path}
                    className="font-mono text-xs"
                  >
                    <EntryIcon size={14} weight={entry.type === 'directory' ? 'fill' : 'regular'} className="shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  )
}

// ── Dashboard / fallback sidebar ─────────────────────────────

function DashboardSidebar() {
  const { data: tasks = [] } = useTasks()
  const activeTasks = tasks.filter((t) => t.status === 'active' || t.status === 'blocked').length
  const pendingTasks = tasks.filter((t) => t.status === 'backlog').length

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel className="font-mono text-[11px] font-bold uppercase tracking-widest">
          Overview
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link to="/chat" />}
                className="font-mono text-xs"
              >
                <ChatCircle size={14} className="shrink-0 text-muted-foreground" />
                <span className="flex-1">Chats</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link to="/tasks" search={{ filter: 'active' }} />}
                className="font-mono text-xs"
              >
                <span className="flex-1">Active tasks</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{activeTasks}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link to="/tasks" search={{ filter: 'backlog' }} />}
                className="font-mono text-xs"
              >
                <span className="flex-1">Backlog</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{pendingTasks}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link to="/files" />}
                className="font-mono text-xs"
              >
                <span className="flex-1">Files</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

    </>
  )
}

// ── Root sidebar ─────────────────────────────────────────────

export function Sidebar() {
  const view = useActiveView()

  return (
    <ShadcnSidebar collapsible="offcanvas">
      <SidebarHeader className="flex flex-row items-center gap-2 px-3 py-2">
        <Link to="/" className="flex items-center gap-2 text-foreground">
          <SquareBuildLogo size={16} />
          <span className="font-mono text-[11px] font-bold uppercase tracking-widest">
            Autopilot
          </span>
        </Link>
        <div className="flex-1" />
        <SidebarTrigger />
      </SidebarHeader>
      <SidebarContent>
        {view === 'chat' && <ChatSidebar />}
        {view === 'tasks' && <TasksSidebar />}
        {view === 'files' && <FilesSidebar />}
        {(view === 'dashboard' || view === 'settings') && <DashboardSidebar />}
      </SidebarContent>
      <SidebarRail />
    </ShadcnSidebar>
  )
}
