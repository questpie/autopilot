import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { m, AnimatePresence } from 'framer-motion'
import {
  PaperPlaneRightIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  WrenchIcon,
  ArrowRightIcon,
  DownloadSimpleIcon,
  CopyIcon,
  FloppyDiskIcon,
  FileTextIcon,
  TableIcon,
  CodeIcon,
  CheckCircleIcon,
  ArrowCounterClockwiseIcon,
  ChatCircleDotsIcon,
  ListChecksIcon,
  ArrowUpRightIcon,
  ClockIcon,
  LightningIcon,
  SidebarSimpleIcon,
  XIcon,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { fadeInUp, EASING, DURATION } from '@/lib/motion'
import { Button } from '@/components/ui/button'
import { FileViewer } from '@/components/file-viewer'
import { useTranslation } from '@/lib/i18n'
import { useChatSeedStore } from '@/stores/chat-seed.store'
import {
  composeConversations,
  type ConversationViewModel,
  type ConversationDisplayType,
  type TaskSummaryView,
} from '@/api/conversations.api'
import { useChatSessions, useChatMessages, useSendChatMessage } from '@/hooks/use-chat-sessions'
import { useQueryList } from '@/hooks/use-queries'
import { useTasks } from '@/hooks/use-tasks'
import type { SessionMessage, Artifact, ArtifactKind, WorkerEventType } from '@/api/types'
import { parseMessageMetadata } from '@/api/parse'

export const Route = createFileRoute('/_app/chat')({
  component: ChatPage,
})

// ── Helpers ──

const messageEntrance = {
  ...fadeInUp,
  transition: { duration: DURATION.normal, ease: EASING.enter },
}

const ARTIFACT_KIND_ICONS: Partial<Record<ArtifactKind, typeof FileTextIcon>> = {
  doc: FileTextIcon,
  diff_summary: TableIcon,
  changed_file: CodeIcon,
  test_report: TableIcon,
  validation_report: TableIcon,
  implementation_prompt: CodeIcon,
  preview_file: FileTextIcon,
  preview_url: FileTextIcon,
  external_receipt: FileTextIcon,
  other: FileTextIcon,
}

const ARTIFACT_KIND_I18N_KEYS: Partial<Record<ArtifactKind, string>> = {
  doc: 'chat.artifact_kind_doc',
  diff_summary: 'chat.artifact_kind_diff_summary',
  changed_file: 'chat.artifact_kind_changed_file',
  test_report: 'chat.artifact_kind_test_report',
  validation_report: 'chat.artifact_kind_validation_report',
  implementation_prompt: 'chat.artifact_kind_implementation_prompt',
  preview_file: 'chat.artifact_kind_preview_file',
  preview_url: 'chat.artifact_kind_preview_url',
  external_receipt: 'chat.artifact_kind_external_receipt',
  other: 'chat.artifact_kind_other',
}

function artifactIcon(kind: ArtifactKind): typeof FileTextIcon {
  return ARTIFACT_KIND_ICONS[kind] ?? FileTextIcon
}

function artifactLabel(kind: ArtifactKind, t: (key: string) => string): string {
  const key = ARTIFACT_KIND_I18N_KEYS[kind]
  return key ? t(key) : kind
}

function findArtifact(conversations: ConversationViewModel[], artifactId: string): Artifact | undefined {
  for (const conv of conversations) {
    const found = conv.artifacts.find((a) => a.id === artifactId)
    if (found) return found
  }
  return undefined
}


// ── Sub-components ──

function ToolCardBlock({
  card,
  t,
  onNavigateToTasks,
}: {
  card: { kind: 'created' | 'updated'; task_id: string; task_title: string }
  t: (key: string) => string
  onNavigateToTasks: () => void
}) {
  const label =
    card.kind === 'created' ? t('chat.tool_task_created') : t('chat.tool_task_updated')

  return (
    <div className="my-2 border border-border bg-muted/20 px-3.5 py-2.5">
      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <WrenchIcon className="size-3.5 shrink-0" />
        <span className="font-heading">{label}</span>
      </div>
      <p className="mt-1 font-heading text-[12px] text-foreground">
        {card.task_id} &middot; {card.task_title}
      </p>
      <button
        type="button"
        onClick={onNavigateToTasks}
        className="mt-1.5 font-heading text-[11px] text-primary hover:underline"
      >
        {t('chat.open_in_tasks')} <ArrowRightIcon className="inline size-3" />
      </button>
    </div>
  )
}

function ArtifactLink({
  artifactRef,
  onSelect,
}: {
  artifactRef: { artifact_id: string; title: string }
  onSelect: (id: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(artifactRef.artifact_id)}
      className="ml-1 font-heading text-[13px] text-primary hover:underline"
    >
      [{artifactRef.title}]
    </button>
  )
}

function WorkerEventBlock({ event }: { event: { type: WorkerEventType; summary: string } }) {
  const iconMap: Partial<Record<WorkerEventType, typeof CheckCircleIcon>> = {
    completed: CheckCircleIcon,
    approval_needed: ClockIcon,
    tool_use: LightningIcon,
    progress: ArrowUpRightIcon,
    started: LightningIcon,
    error: ArrowCounterClockwiseIcon,
  }

  const colorMap: Partial<Record<WorkerEventType, string>> = {
    completed: 'text-success',
    approval_needed: 'text-warning',
    tool_use: 'text-primary',
    progress: 'text-primary',
    started: 'text-primary',
    error: 'text-destructive',
  }

  const Icon = iconMap[event.type] ?? ArrowUpRightIcon
  const color = colorMap[event.type] ?? 'text-muted-foreground'

  return (
    <div className="my-1.5 flex items-start gap-2 py-1">
      <Icon weight="fill" className={cn('mt-0.5 size-3.5 shrink-0', color)} />
      <div>
        <span className="font-heading text-[12px] text-foreground">{event.summary}</span>
      </div>
    </div>
  )
}

function ApprovalButtons({
  onApprove,
  onReturn,
  resolved,
}: {
  onApprove: () => void
  onReturn: () => void
  resolved: string | null
}) {
  const { t } = useTranslation()

  if (resolved) {
    return (
      <div className="mt-2 flex items-center gap-2 text-[12px]">
        <CheckCircleIcon weight="fill" className="size-3.5 text-success" />
        <span className="font-heading text-muted-foreground">{resolved}</span>
      </div>
    )
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={onReturn}>
        <ArrowCounterClockwiseIcon className="size-3.5" />
        {t('chat.return_for_changes')}
      </Button>
      <Button size="sm" onClick={onApprove}>
        <CheckCircleIcon className="size-3.5" />
        {t('chat.approve')}
      </Button>
    </div>
  )
}

function TaskProgressStrip({ task }: { task: TaskSummaryView }) {
  const progressPct = task.runs_total > 0
    ? Math.round((task.runs_completed / task.runs_total) * 100)
    : 0

  const statusColors: Record<string, string> = {
    running: 'bg-primary',
    waiting: 'bg-warning',
    done: 'bg-success',
    failed: 'bg-destructive',
  }

  return (
    <div className="border-b border-border px-5 py-2.5">
      <div className="mx-auto flex max-w-[640px] items-center gap-3">
        <ListChecksIcon className="size-4 shrink-0 text-muted-foreground" />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="font-heading text-[12px] text-foreground">
              {task.id} &middot; {task.workflow_step ?? '—'}
            </span>
            <span className="font-heading text-[11px] text-muted-foreground">
              {task.runs_completed}/{task.runs_total}
            </span>
          </div>
          <div className="mt-1 h-1 w-full bg-muted/30">
            <div
              className={cn('h-full transition-all', statusColors[task.status] ?? 'bg-primary')}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function PromotedBanner({
  taskId,
  taskTitle,
  onNavigate,
}: {
  taskId: string
  taskTitle: string
  onNavigate: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className="border-b border-border bg-primary/5 px-5 py-2">
      <div className="mx-auto flex max-w-[640px] items-center justify-between">
        <span className="text-[12px] text-muted-foreground">
          {t('chat.promoted_banner_text', { taskId, taskTitle })}
        </span>
        <button
          type="button"
          onClick={onNavigate}
          className="font-heading text-[11px] text-primary hover:underline"
        >
          {t('chat.promoted_banner_open')} <ArrowRightIcon className="inline size-3" />
        </button>
      </div>
    </div>
  )
}

function DiscussionHeader({
  taskId,
  taskTitle,
  onNavigate,
}: {
  taskId: string
  taskTitle: string
  onNavigate: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className="border-b border-border bg-muted/10 px-5 py-2">
      <div className="mx-auto flex max-w-[640px] items-center justify-between">
        <div className="flex items-center gap-2">
          <ChatCircleDotsIcon className="size-3.5 text-muted-foreground" />
          <span className="text-[12px] text-muted-foreground">
            {t('chat.discussion_header_text', { taskId, taskTitle })}
          </span>
        </div>
        <button
          type="button"
          onClick={onNavigate}
          className="font-heading text-[11px] text-primary hover:underline"
        >
          {t('chat.discussion_header_open')} <ArrowRightIcon className="inline size-3" />
        </button>
      </div>
    </div>
  )
}

type RightPanelTab = 'artifacts' | 'tasks'

function TaskSummaryPanel({ task }: { task: TaskSummaryView }) {
  const { t } = useTranslation()

  const statusLabel = (() => {
    switch (task.status) {
      case 'running': return t('chat.task_status_running')
      case 'waiting': return t('chat.task_status_waiting')
      case 'done': return t('chat.task_status_done')
      case 'failed': return t('chat.task_status_failed')
      default: return task.status
    }
  })()

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-5">
      <div className="mb-4">
        <span className="font-heading text-[11px] text-muted-foreground">{task.id}</span>
        <h3 className="mt-0.5 text-[14px] font-semibold text-foreground">{task.title}</h3>
      </div>

      <div className="space-y-3">
        <div>
          <span className="font-heading text-[11px] text-muted-foreground">{t('chat.task_summary_status')}</span>
          <p className="text-[13px] text-foreground">{statusLabel}</p>
        </div>

        <div>
          <span className="font-heading text-[11px] text-muted-foreground">{t('chat.task_summary_current_step')}</span>
          <p className="text-[13px] text-foreground">{task.workflow_step ?? '—'}</p>
        </div>

        <div>
          <span className="font-heading text-[11px] text-muted-foreground">{t('chat.task_summary_progress')}</span>
          <p className="text-[13px] text-foreground">
            {t('chat.task_summary_progress_value', { completed: task.runs_completed, total: task.runs_total })}
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Conversation type indicators ──

function ConversationTypeIndicator({
  type,
  taskId,
}: {
  type: ConversationDisplayType
  taskId?: string
}) {
  const { t } = useTranslation()

  if (type === 'task') {
    return (
      <span className="shrink-0 font-mono text-[10px] text-muted-foreground bg-primary/10 border border-primary/20 px-1.5 py-0.5">
        {taskId ?? 'T-???'}
      </span>
    )
  }

  if (type === 'discussion') {
    return (
      <span className="inline-flex items-center gap-1 shrink-0 font-heading text-[10px] text-muted-foreground bg-muted/20 px-1.5 py-0.5">
        <ChatCircleDotsIcon className="size-2.5" />
        {t('chat.conversation_type_discussion')} {taskId ? `· ${taskId}` : ''}
      </span>
    )
  }
  return null
}

// ── Main Component ──

function ChatPage() {
  const { t, i18n: i18nInstance } = useTranslation()
  const locale = i18nInstance.language
  const navigate = useNavigate()
  const pendingSeed = useChatSeedStore((s) => s.pendingSeed)
  const clearSeed = useChatSeedStore((s) => s.clearSeed)

  // Backend data
  const { data: sessions } = useChatSessions()
  const { data: allQueries } = useQueryList()
  const { data: allTasks } = useTasks()

  // Local-only conversations (seeds, new chats)
  const [localConversations, setLocalConversations] = useState<ConversationViewModel[]>([])

  // Compose backend conversations from primitives
  const backendConversations = useMemo(
    () => composeConversations(sessions ?? [], allQueries ?? [], allTasks ?? []),
    [sessions, allQueries, allTasks],
  )

  // Merge: local first, then backend
  const conversations = useMemo(
    () => [...localConversations, ...backendConversations],
    [localConversations, backendConversations],
  )
  // User's explicit conversation selection (null = use first available)
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)

  // Derived active ID: explicit pick if still in list, otherwise first conversation
  const activeId = (selectedConvId != null && conversations.some((c) => c.session.id === selectedConvId))
    ? selectedConvId
    : (conversations[0]?.session.id ?? null)

  // User overrides for panel state (null = use defaults derived from conversation)
  const [userArtifactId, setUserArtifactId] = useState<string | null>(null)
  const [userRightTab, setUserRightTab] = useState<RightPanelTab | null>(null)
  const [userPanelOpen, setUserPanelOpen] = useState<boolean | null>(null)

  // Reset panel overrides when conversation changes (React-recommended setState-during-render)
  const [prevActiveId, setPrevActiveId] = useState<string | null>(null)
  if (prevActiveId !== activeId) {
    setPrevActiveId(activeId)
    setUserArtifactId(null)
    setUserRightTab(null)
    setUserPanelOpen(null)
  }

  const [inputValue, setInputValue] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  // Track resolved approval requests: messageId -> resolution label
  const [resolvedActions, setResolvedActions] = useState<Record<string, string>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Determine if active session is local (seed/new) vs backend
  const isLocalSession = activeId != null && (activeId.startsWith('seed_') || activeId.startsWith('new_'))

  // Messages: from backend hook for real sessions, from local state for local sessions
  const { data: backendMessages } = useChatMessages(isLocalSession ? null : activeId)

  // Send message mutation
  const sendMutation = useSendChatMessage()

  // Handle seed arrival
  useEffect(() => {
    if (pendingSeed) {
      const seedId = `seed_${Date.now()}`
      const now = new Date().toISOString()
      const seedSession = {
        id: seedId,
        provider_id: 'demo',
        external_conversation_id: seedId,
        external_thread_id: null,
        mode: 'query' as const,
        task_id: null as string | null,
        status: 'active' as const,
        created_at: now,
        updated_at: now,
        metadata: '{}',
        runtime_session_ref: null,
        preferred_worker_id: null,
      }

      const seedMessages: SessionMessage[] = [
        {
          id: `${seedId}-assistant`,
          session_id: seedId,
          role: 'assistant',
          content: pendingSeed.context,
          query_id: null,
          external_message_id: null,
          metadata: '{}',
          created_at: now,
        },
      ]

      const seedConv: ConversationViewModel = {
        session: seedSession,
        displayType: 'query',
        title: pendingSeed.title,
        lastPreview: pendingSeed.context.slice(0, 80),
        time: new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
        messages: seedMessages,
        artifacts: [],
        task: null,
        queries: [],
      }

      // If seed action is task-related, add a tool card message
      if (pendingSeed.action === 'create_task') {
        const taskId = `T-${150 + Math.floor(Math.random() * 50)}`
        seedConv.messages = [
          ...seedConv.messages,
          {
            id: `${seedId}-tool`,
            session_id: seedId,
            role: 'assistant',
            content: '',
            query_id: null,
            external_message_id: null,
            metadata: JSON.stringify({
              tool_card: {
                kind: 'created',
                task_id: taskId,
                task_title: pendingSeed.title,
              },
            }),
            created_at: now,
          },
        ]
        seedConv.session = { ...seedConv.session, task_id: taskId, mode: 'task_thread' }
        seedConv.displayType = 'task'
        seedConv.task = {
          id: taskId,
          title: pendingSeed.title,
          status: 'running',
          workflow_step: null,
          runs_total: 0,
          runs_completed: 0,
        }
      }

      setLocalConversations((prev) => [seedConv, ...prev])
      setSelectedConvId(seedId)
      clearSeed()
    }
  }, [pendingSeed, clearSeed])

  const currentConversationBase =
    conversations.find((c) => c.session.id === activeId) ?? conversations[0] ?? null

  // Enrich with messages from the correct source
  const currentConversation = useMemo(() => {
    if (!currentConversationBase) return null
    if (isLocalSession) return currentConversationBase
    return {
      ...currentConversationBase,
      messages: backendMessages ?? [],
    }
  }, [currentConversationBase, isLocalSession, backendMessages])

  // Derive panel state: user override ?? default from conversation
  const hasTaskSummary = currentConversation?.task != null
  const hasArtifacts = currentConversation != null && currentConversation.artifacts.length > 0
  const selectedArtifactId = userArtifactId ?? currentConversation?.artifacts.at(-1)?.id ?? null
  const rightTab: RightPanelTab = userRightTab ?? (hasTaskSummary ? 'tasks' : 'artifacts')
  const rightPanelOpen = userPanelOpen ?? (hasTaskSummary || hasArtifacts)

  const selectedArtifact = selectedArtifactId
    ? findArtifact(conversations, selectedArtifactId)
    : undefined

  const filteredConversations = searchQuery
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeId, currentConversation?.messages.length])

  const handleNavigateToTasks = useCallback(() => {
    void navigate({ to: '/tasks' })
  }, [navigate])

  const handleArtifactSelect = useCallback((artifactId: string) => {
    setUserArtifactId(artifactId)
    setUserRightTab('artifacts')
    setUserPanelOpen(true)
  }, [])

  const handleConversationSelect = useCallback((id: string) => {
    setSelectedConvId(id)
  }, [])

  const handleTextareaInput = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [])

  const handleSendMessage = useCallback(() => {
    if (!inputValue.trim() || !activeId) return

    const trimmed = inputValue.trim()

    if (isLocalSession) {
      // Local-only: append to local state
      const now = new Date().toISOString()
      const newMsg: SessionMessage = {
        id: `usr_${Date.now()}`,
        session_id: activeId,
        role: 'user',
        content: trimmed,
        query_id: null,
        external_message_id: null,
        metadata: '{}',
        created_at: now,
      }
      setLocalConversations((prev) =>
        prev.map((c) => {
          if (c.session.id !== activeId) return c
          return {
            ...c,
            messages: [...c.messages, newMsg],
            lastPreview: trimmed.slice(0, 80),
          }
        })
      )
    } else {
      // Backend session: send via API, messages will refresh via query invalidation
      sendMutation.mutate({ sessionId: activeId, message: trimmed })
    }

    setInputValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [inputValue, activeId, isLocalSession, sendMutation])

  const handleNewConversation = useCallback(() => {
    const newId = `new_${Date.now()}`
    const now = new Date().toISOString()
    const newConv: ConversationViewModel = {
      session: {
        id: newId,
        provider_id: 'demo',
        external_conversation_id: newId,
        external_thread_id: null,
        mode: 'query',
        task_id: null,
        status: 'active',
        created_at: now,
        updated_at: now,
        metadata: '{}',
        runtime_session_ref: null,
        preferred_worker_id: null,
      },
      displayType: 'query',
      title: t('chat.new_conversation_title'),
      lastPreview: '',
      time: new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
      messages: [],
      artifacts: [],
      task: null,
      queries: [],
    }
    setLocalConversations((prev) => [newConv, ...prev])
    setSelectedConvId(newId)
  }, [t, locale])

  const handleApprove = useCallback((messageId: string) => {
    setResolvedActions((prev) => ({ ...prev, [messageId]: t('chat.approved') }))
  }, [t])

  const handleReturn = useCallback((messageId: string) => {
    setResolvedActions((prev) => ({ ...prev, [messageId]: t('chat.returned') }))
  }, [t])

  const showRightPanelTabs = hasTaskSummary && hasArtifacts

  // Derive promoted task from queries
  const promotedQuery = currentConversation?.queries.find((q) => q.promoted_task_id != null)
  const promotedTask = promotedQuery && currentConversation?.task && currentConversation.displayType !== 'discussion'
    ? { taskId: currentConversation.task.id, taskTitle: currentConversation.task.title }
    : null

  return (
    <div className="flex h-full">
      {/* ── Left rail: Conversation list ── */}
      <div className={cn(
        'flex flex-col border-r border-border transition-all duration-200',
        sidebarCollapsed ? 'w-0 min-w-0 overflow-hidden border-r-0' : 'w-[260px] min-w-[260px]'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-[13px] font-semibold text-foreground">
            {t('chat.conversations')}
          </h2>
          <Button variant="ghost" size="xs" onClick={handleNewConversation}>
            <PlusIcon className="size-3.5" />
            {t('chat.new')}
          </Button>
        </div>

        {/* Search */}
        <div className="border-b border-border px-3 py-2">
          <div className="flex items-center gap-2 rounded-none border border-border bg-input/30 px-2.5 py-1.5">
            <MagnifyingGlassIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              placeholder={t('chat.search_placeholder')}
              className="w-full bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map((conv) => (
            <button
              key={conv.session.id}
              type="button"
              onClick={() => handleConversationSelect(conv.session.id)}
              className={cn(
                'flex w-full flex-col gap-0.5 border-b border-border/50 px-4 py-3 text-left transition-colors hover:bg-muted/10',
                activeId === conv.session.id && 'bg-muted/20',
                conv.displayType === 'task' && 'border-l-2 border-l-primary/40',
                conv.displayType === 'discussion' && 'border-l-2 border-l-muted-foreground/30'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[13px] font-medium text-foreground">
                  {conv.title}
                </span>
                <span className="shrink-0 font-heading text-[11px] text-muted-foreground">
                  {conv.time}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex-1 truncate text-[12px] text-muted-foreground">
                  {conv.lastPreview}
                </span>
                <ConversationTypeIndicator
                  type={conv.displayType}
                  taskId={conv.task?.id}
                />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Center: Chat pane ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Chat header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarCollapsed((v) => !v)}
              className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <SidebarSimpleIcon className="size-4" />
            </button>
            <span className="truncate text-[14px] font-semibold text-foreground">
              {currentConversation?.title ?? ''}
            </span>
            {currentConversation && currentConversation.displayType !== 'query' && (
              <span className="shrink-0 font-heading text-[11px] text-muted-foreground bg-muted/20 px-1.5 py-0.5">
                {currentConversation.displayType === 'task' ? t('chat.conversation_type_task') : t('chat.conversation_type_discussion')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {(hasTaskSummary || hasArtifacts) && (
              <button
                type="button"
                onClick={() => setUserPanelOpen(!rightPanelOpen)}
                className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <SidebarSimpleIcon weight={rightPanelOpen ? 'fill' : 'regular'} className="size-4 -scale-x-100" />
              </button>
            )}
            <div className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-success" />
              <span className="font-heading text-[11px] text-muted-foreground">
                {t('chat.online')}
              </span>
            </div>
          </div>
        </div>

        {/* Promoted banner */}
        {promotedTask && (
          <PromotedBanner
            taskId={promotedTask.taskId}
            taskTitle={promotedTask.taskTitle}
            onNavigate={handleNavigateToTasks}
          />
        )}

        {/* Discussion header */}
        {currentConversation?.displayType === 'discussion' && currentConversation.task && (
          <DiscussionHeader
            taskId={currentConversation.task.id}
            taskTitle={currentConversation.task.title}
            onNavigate={handleNavigateToTasks}
          />
        )}

        {/* Task progress strip */}
        {currentConversation?.task && currentConversation.displayType === 'task' && (
          <TaskProgressStrip task={currentConversation.task} />
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <AnimatePresence mode="wait">
            {currentConversation && (
              <m.div
                key={activeId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: DURATION.fast }}
                className="mx-auto flex max-w-[640px] flex-col gap-3"
              >
                {currentConversation.messages.map((msg) => {
                  const meta = parseMessageMetadata(msg)
                  const workerEvent = meta.worker_event ?? null
                  const artifactRefs = meta.artifact_refs ?? []
                  const toolCard = meta.tool_card ?? null
                  const approvalNeeded = workerEvent?.type === 'approval_needed'

                  return (
                    <m.div
                      key={msg.id}
                      {...messageEntrance}
                      className={cn(
                        'max-w-[85%]',
                        msg.role === 'user' && 'self-end',
                        msg.role === 'assistant' && 'self-start',
                        msg.role === 'system' && 'self-center max-w-full'
                      )}
                    >
                      {/* System message */}
                      {msg.role === 'system' && (
                        <div className="py-2 text-center">
                          <span className="font-heading text-[11px] text-muted-foreground">
                            {msg.content}
                          </span>
                        </div>
                      )}

                      {/* Worker event (non-approval) with no content */}
                      {workerEvent && !approvalNeeded && !msg.content && !toolCard && (
                        <WorkerEventBlock event={workerEvent} />
                      )}

                      {/* Tool card only */}
                      {toolCard && !msg.content && !workerEvent && (
                        <ToolCardBlock card={toolCard} t={t} onNavigateToTasks={handleNavigateToTasks} />
                      )}

                      {/* User message */}
                      {msg.role === 'user' && msg.content && (
                        <div className="rounded-none border border-primary/15 bg-primary/8 px-3.5 py-2.5 text-[13px] leading-relaxed text-foreground">
                          {msg.content}
                        </div>
                      )}

                      {/* Assistant message */}
                      {msg.role === 'assistant' && msg.content && (
                        <div className="py-1">
                          <>
                            <span
                              className="text-[13px] leading-relaxed text-muted-foreground [&_strong]:text-foreground"
                              dangerouslySetInnerHTML={{
                                __html: msg.content.replace(/\n/g, '<br/>'),
                              }}
                            />
                            {artifactRefs.map((ref) => (
                              <span key={ref.artifact_id}>
                                <span className="text-[13px] text-muted-foreground">
                                  {' '}
                                  &rarr;
                                </span>
                                <ArtifactLink
                                  artifactRef={ref}
                                  onSelect={handleArtifactSelect}
                                />
                              </span>
                            ))}
                          </>
                        </div>
                      )}

                      {/* Tool card after content */}
                      {toolCard && msg.content && (
                        <ToolCardBlock card={toolCard} t={t} onNavigateToTasks={handleNavigateToTasks} />
                      )}

                      {/* Worker event after content (non-approval) */}
                      {workerEvent && !approvalNeeded && msg.content && (
                        <WorkerEventBlock event={workerEvent} />
                      )}

                      {/* Approval buttons */}
                      {approvalNeeded && (
                        <ApprovalButtons
                          onApprove={() => handleApprove(msg.id)}
                          onReturn={() => handleReturn(msg.id)}
                          resolved={resolvedActions[msg.id] ?? null}
                        />
                      )}
                    </m.div>
                  )
                })}
                <div ref={messagesEndRef} />
              </m.div>
            )}
          </AnimatePresence>
        </div>

        {/* Input */}
        <div className="border-t border-border px-5 pb-4 pt-3">
          <div className="mx-auto flex max-w-[640px] items-end gap-2">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.currentTarget.value)
                handleTextareaInput()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              placeholder={t('chat.input_placeholder')}
              rows={1}
              className="min-h-[40px] max-h-[120px] flex-1 resize-none rounded-none border border-border bg-input/30 px-3 py-2.5 text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            <Button size="icon" className="size-9 shrink-0" onClick={handleSendMessage}>
              <PaperPlaneRightIcon weight="fill" className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Right: Artifacts / Tasks panel ── */}
      <div className={cn(
        'flex flex-col border-l border-border transition-all duration-200',
        rightPanelOpen ? 'w-[380px] min-w-[380px]' : 'w-0 min-w-0 overflow-hidden border-l-0'
      )}>
        {/* Tab bar (when both tasks and artifacts are available) */}
        {showRightPanelTabs && (
          <div className="flex border-b border-border">
            <button
              type="button"
              onClick={() => setUserRightTab('artifacts')}
              className={cn(
                'flex-1 py-2.5 text-center font-heading text-[12px] transition-colors',
                rightTab === 'artifacts'
                  ? 'border-b-2 border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t('chat.tab_artifacts')}
              {currentConversation && currentConversation.artifacts.length > 0 && (
                <span className="ml-1 text-muted-foreground/60">{currentConversation.artifacts.length}</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setUserRightTab('tasks')}
              className={cn(
                'flex-1 py-2.5 text-center font-heading text-[12px] transition-colors',
                rightTab === 'tasks'
                  ? 'border-b-2 border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t('chat.tab_tasks')}
            </button>
            <button
              type="button"
              onClick={() => setUserPanelOpen(false)}
              className="shrink-0 px-2.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <XIcon className="size-3.5" />
            </button>
          </div>
        )}

        {/* Close button header (when only one type of content) */}
        {!showRightPanelTabs && rightPanelOpen && (
          <div className="flex items-center justify-end border-b border-border px-3 py-2">
            <button
              type="button"
              onClick={() => setUserPanelOpen(false)}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <XIcon className="size-3.5" />
            </button>
          </div>
        )}

        {/* ── Tasks tab content ── */}
        {rightTab === 'tasks' && currentConversation?.task && (
          <TaskSummaryPanel task={currentConversation.task} />
        )}

        {/* ── Artifacts tab content ── */}
        {rightTab === 'artifacts' && currentConversation ? (
          currentConversation.artifacts.length > 0 ? (
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Artifact list */}
              <div className="flex flex-col border-b border-border">
                {currentConversation.artifacts.map((art) => {
                  const Icon = artifactIcon(art.kind)
                  const isSelected = art.id === selectedArtifactId
                  return (
                    <button
                      key={art.id}
                      type="button"
                      onClick={() => setUserArtifactId(art.id)}
                      className={cn(
                        'flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors',
                        isSelected ? 'bg-muted/30' : 'hover:bg-muted/10'
                      )}
                    >
                      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] font-medium text-foreground">{art.title}</div>
                        <div className="text-[11px] text-muted-foreground">{artifactLabel(art.kind, t)}</div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Selected artifact preview */}
              {selectedArtifact ? (
                <>
                  <div className="flex-1 overflow-hidden">
                    {selectedArtifact.ref_kind === 'inline' ? (
                      <FileViewer
                        path={selectedArtifact.title}
                        content={selectedArtifact.ref_value}
                        mime={selectedArtifact.mime_type ?? undefined}
                        className="h-full"
                      />
                    ) : (
                      <div className="p-5">
                        <p className="text-[12px] text-muted-foreground break-all">
                          {selectedArtifact.ref_value}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 border-t border-border px-5 py-3">
                    <Button variant="outline" size="sm">
                      <DownloadSimpleIcon className="size-3.5" />
                      {t('chat.artifact_download')}
                    </Button>
                    <Button variant="outline" size="sm">
                      <CopyIcon className="size-3.5" />
                      {t('chat.artifact_copy')}
                    </Button>
                    <Button variant="outline" size="sm">
                      <FloppyDiskIcon className="size-3.5" />
                      {t('chat.artifact_save')}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center px-5">
                  <p className="text-center text-[12px] text-muted-foreground">
                    {t('chat.artifact_select')}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5">
              <FileTextIcon className="size-8 text-muted-foreground/30" />
              <p className="text-center text-[12px] text-muted-foreground">
                {t('chat.artifact_empty')}
              </p>
            </div>
          )
        ) : null}
      </div>
    </div>
  )
}
