import { useState, useRef, useEffect, useCallback } from 'react'
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
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { fadeInUp, EASING, DURATION } from '@/lib/motion'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'
import { useChatSeedStore } from '@/stores/chat-seed.store'
import {
  getConversations,
  type MockConversation,
  type MockMessage,
  type MockArtifact,
  type MockArtifactType,
  type MockToolCard,
  type MockArtifactRef,
  type MockTaskSummary,
  type ConversationType,
} from '@/api/conversations.api'

export const Route = createFileRoute('/_app/chat')({
  component: ChatPage,
})

// ── Helpers ──

const messageEntrance = {
  ...fadeInUp,
  transition: { duration: DURATION.normal, ease: EASING.enter },
}

const ARTIFACT_TYPE_ICONS: Record<MockArtifactType, typeof FileTextIcon> = {
  document: FileTextIcon,
  table: TableIcon,
  code: CodeIcon,
}

const ARTIFACT_TYPE_LABELS: Record<MockArtifactType, string> = {
  document: 'Dokument',
  table: 'Tabuľka',
  code: 'Kód',
}

function findArtifact(conversations: MockConversation[], artifactId: string): MockArtifact | undefined {
  for (const conv of conversations) {
    const found = conv.artifacts.find((a) => a.id === artifactId)
    if (found) return found
  }
  return undefined
}

// ── Sub-components ──

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 rounded-full bg-muted-foreground animate-bounce-dot"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  )
}

function ToolCardBlock({
  card,
  t,
  onNavigateToTasks,
}: {
  card: MockToolCard
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
        {card.taskId} &middot; {card.taskTitle}
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
  artifactRef: MockArtifactRef
  onSelect: (id: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(artifactRef.artifactId)}
      className="ml-1 font-heading text-[13px] text-primary hover:underline"
    >
      [{artifactRef.label}]
    </button>
  )
}

function TaskEventBlock({ event }: { event: MockMessage['taskEvent'] }) {
  if (!event) return null

  const iconMap = {
    step_completed: CheckCircleIcon,
    waiting_for_review: ClockIcon,
    step_started: LightningIcon,
    promoted: ArrowUpRightIcon,
  }

  const colorMap = {
    step_completed: 'text-success',
    waiting_for_review: 'text-warning',
    step_started: 'text-primary',
    promoted: 'text-primary',
  }

  const Icon = iconMap[event.kind]
  const color = colorMap[event.kind]

  return (
    <div className="my-1.5 flex items-start gap-2 py-1">
      <Icon weight="fill" className={cn('mt-0.5 size-3.5 shrink-0', color)} />
      <div>
        <span className="font-heading text-[12px] text-foreground">{event.stepLabel}</span>
        {event.detail && (
          <p className="text-[11px] text-muted-foreground">{event.detail}</p>
        )}
      </div>
    </div>
  )
}

function ActionButtons({
  actionRequest,
  onApprove,
  onReturn,
  resolved,
}: {
  actionRequest: MockMessage['actionRequest']
  onApprove: () => void
  onReturn: () => void
  resolved: string | null
}) {
  if (!actionRequest) return null

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
      {actionRequest.kind === 'approve_reject' && (
        <>
          <Button size="sm" onClick={onApprove}>
            <CheckCircleIcon className="size-3.5" />
            {/* Schváliť */}
            Schváliť
          </Button>
          <Button variant="outline" size="sm" onClick={onReturn}>
            <ArrowCounterClockwiseIcon className="size-3.5" />
            Vrátiť na úpravu
          </Button>
        </>
      )}
      {actionRequest.kind === 'return_approve' && (
        <>
          <Button variant="outline" size="sm" onClick={onReturn}>
            <ArrowCounterClockwiseIcon className="size-3.5" />
            Vrátiť na úpravu
          </Button>
          <Button size="sm" onClick={onApprove}>
            <CheckCircleIcon className="size-3.5" />
            Schváliť
          </Button>
        </>
      )}
    </div>
  )
}

function TaskProgressStrip({ summary }: { summary: MockTaskSummary }) {
  const progressPct = summary.totalSteps > 0
    ? Math.round((summary.completedSteps / summary.totalSteps) * 100)
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
              {summary.taskId} &middot; {summary.currentStep}
            </span>
            <span className="font-heading text-[11px] text-muted-foreground">
              {summary.completedSteps}/{summary.totalSteps}
            </span>
          </div>
          <div className="mt-1 h-1 w-full bg-muted/30">
            <div
              className={cn('h-full transition-all', statusColors[summary.status] ?? 'bg-primary')}
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
  return (
    <div className="border-b border-border bg-primary/5 px-5 py-2">
      <div className="mx-auto flex max-w-[640px] items-center justify-between">
        <span className="text-[12px] text-muted-foreground">
          Táto konverzácia vytvorila úlohu{' '}
          <span className="font-heading text-foreground">{taskId}</span>
          {' '}&middot; {taskTitle}
        </span>
        <button
          type="button"
          onClick={onNavigate}
          className="font-heading text-[11px] text-primary hover:underline"
        >
          Otvoriť <ArrowRightIcon className="inline size-3" />
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
  return (
    <div className="border-b border-border bg-muted/10 px-5 py-2">
      <div className="mx-auto flex max-w-[640px] items-center justify-between">
        <div className="flex items-center gap-2">
          <ChatCircleDotsIcon className="size-3.5 text-muted-foreground" />
          <span className="text-[12px] text-muted-foreground">
            Diskusia k{' '}
            <span className="font-heading text-foreground">{taskId}</span>
            {' '}&middot; {taskTitle}
          </span>
        </div>
        <button
          type="button"
          onClick={onNavigate}
          className="font-heading text-[11px] text-primary hover:underline"
        >
          Otvoriť úlohu <ArrowRightIcon className="inline size-3" />
        </button>
      </div>
    </div>
  )
}

type RightPanelTab = 'artifact' | 'task'

function TaskSummaryPanel({ summary }: { summary: MockTaskSummary }) {
  const statusLabels: Record<string, string> = {
    running: 'Pracuje sa',
    waiting: 'Čaká na schválenie',
    done: 'Hotové',
    failed: 'Zlyhalo',
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-5">
      <div className="mb-4">
        <span className="font-heading text-[11px] text-muted-foreground">{summary.taskId}</span>
        <h3 className="mt-0.5 text-[14px] font-semibold text-foreground">{summary.title}</h3>
      </div>

      <div className="space-y-3">
        <div>
          <span className="font-heading text-[11px] text-muted-foreground">Stav</span>
          <p className="text-[13px] text-foreground">{statusLabels[summary.status] ?? summary.status}</p>
        </div>

        <div>
          <span className="font-heading text-[11px] text-muted-foreground">Aktuálny krok</span>
          <p className="text-[13px] text-foreground">{summary.currentStep}</p>
        </div>

        <div>
          <span className="font-heading text-[11px] text-muted-foreground">Priebeh</span>
          <p className="text-[13px] text-foreground">
            {summary.completedSteps} z {summary.totalSteps} krokov
          </p>
        </div>

        {summary.outputs.length > 0 && (
          <div>
            <span className="font-heading text-[11px] text-muted-foreground">Výstupy</span>
            {summary.outputs.map((output) => (
              <p key={output} className="text-[13px] text-foreground">
                &middot; {output}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function renderMarkdown(md: string): React.ReactNode[] {
  const lines = md.split('\n')
  const elements: React.ReactNode[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={i} className="mb-3 text-[18px] font-bold text-foreground">
          {line.slice(2)}
        </h1>
      )
    } else if (line.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="mb-2 mt-4 text-[15px] font-semibold text-foreground">
          {line.slice(3)}
        </h2>
      )
    } else if (line.startsWith('### ')) {
      elements.push(
        <h3 key={i} className="mb-1 mt-3 text-[13px] font-semibold text-foreground">
          {line.slice(4)}
        </h3>
      )
    } else if (line.startsWith('---')) {
      elements.push(<hr key={i} className="my-3 border-border" />)
    } else if (line.startsWith('- ')) {
      elements.push(
        <p key={i} className="pl-3 text-[12px] leading-relaxed text-muted-foreground">
          <span className="mr-1.5 text-muted-foreground/50">&middot;</span>
          <InlineFormat text={line.slice(2)} />
        </p>
      )
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-1" />)
    } else {
      elements.push(
        <p key={i} className="text-[12px] leading-relaxed text-muted-foreground">
          <InlineFormat text={line} />
        </p>
      )
    }
  }

  return elements
}

function InlineFormat({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} className="font-semibold text-foreground">
              {part.slice(2, -2)}
            </strong>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

// ── Conversation type indicators ──

function ConversationTypeIndicator({ type, taskRef }: { type: ConversationType; taskRef?: { taskId: string } }) {
  if (type === 'task') {
    return (
      <span className="shrink-0 font-mono text-[10px] text-muted-foreground bg-muted/30 px-1 py-0.5">
        {taskRef?.taskId ?? 'T-???'}
      </span>
    )
  }
  if (type === 'discussion') {
    return (
      <span className="shrink-0 font-heading text-[10px] text-muted-foreground">
        Diskusia {taskRef?.taskId ? `· ${taskRef.taskId}` : ''}
      </span>
    )
  }
  return null
}

// ── Main Component ──

function ChatPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const pendingSeed = useChatSeedStore((s) => s.pendingSeed)
  const clearSeed = useChatSeedStore((s) => s.clearSeed)

  // Local state — all conversations (loaded from adapter)
  const [conversations, setConversations] = useState<MockConversation[]>([])

  // Load conversations from adapter
  useEffect(() => {
    getConversations().then(setConversations)
  }, [])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [rightTab, setRightTab] = useState<RightPanelTab>('artifact')
  // Track resolved action requests: messageId -> resolution label
  const [resolvedActions, setResolvedActions] = useState<Record<string, string>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Handle seed arrival
  useEffect(() => {
    if (pendingSeed) {
      const seedId = `seed_${Date.now()}`
      const seedConv: MockConversation = {
        id: seedId,
        type: 'query',
        title: pendingSeed.title,
        lastPreview: pendingSeed.context.slice(0, 80),
        time: new Date().toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' }),
        messages: [
          {
            id: `${seedId}-bot`,
            role: 'bot',
            content: pendingSeed.context,
          },
        ],
        artifacts: [],
      }

      // If seed action is task-related, add a tool card
      if (pendingSeed.action === 'create_task') {
        const taskId = `T-${150 + Math.floor(Math.random() * 50)}`
        seedConv.messages.push({
          id: `${seedId}-tool`,
          role: 'bot',
          content: '',
          toolCard: {
            kind: 'created',
            taskId,
            taskTitle: pendingSeed.title,
          },
        })
        seedConv.promotedTo = { taskId, taskTitle: pendingSeed.title }
        seedConv.type = 'task'
      }

      setConversations((prev) => [seedConv, ...prev])
      setActiveId(seedId)
      clearSeed()
    }
  }, [pendingSeed, clearSeed])

  // Auto-select first conversation
  useEffect(() => {
    if (activeId === null && conversations.length > 0) {
      setActiveId(conversations[0].id)
    }
  }, [activeId, conversations])

  // Auto-select artifact when switching conversations
  useEffect(() => {
    const conv = conversations.find((c) => c.id === activeId)
    if (conv && conv.artifacts.length > 0) {
      setSelectedArtifactId(conv.artifacts[conv.artifacts.length - 1].id)
    } else {
      setSelectedArtifactId(null)
    }
    // Reset right panel tab based on conversation type
    if (conv && (conv.type === 'task' || conv.type === 'discussion') && conv.taskSummary) {
      setRightTab('task')
    } else {
      setRightTab('artifact')
    }
  }, [activeId, conversations])

  const currentConversation =
    conversations.find((c) => c.id === activeId) ?? conversations[0] ?? null

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
    setSelectedArtifactId(artifactId)
    setRightTab('artifact')
  }, [])

  const handleConversationSelect = useCallback((id: string) => {
    setActiveId(id)
  }, [])

  const handleTextareaInput = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [])

  const handleSendMessage = useCallback(() => {
    if (!inputValue.trim() || !activeId) return

    const newMsg: MockMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
    }

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== activeId) return c
        return {
          ...c,
          messages: [...c.messages, newMsg],
          lastPreview: inputValue.trim().slice(0, 80),
        }
      })
    )
    setInputValue('')

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [inputValue, activeId])

  const handleNewConversation = useCallback(() => {
    const newId = `new_${Date.now()}`
    const newConv: MockConversation = {
      id: newId,
      type: 'query',
      title: t('chat.new_conversation_title'),
      lastPreview: '',
      time: new Date().toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' }),
      messages: [],
      artifacts: [],
    }
    setConversations((prev) => [newConv, ...prev])
    setActiveId(newId)
  }, [t])

  const handleApprove = useCallback((messageId: string) => {
    setResolvedActions((prev) => ({ ...prev, [messageId]: 'Schválené' }))
  }, [])

  const handleReturn = useCallback((messageId: string) => {
    setResolvedActions((prev) => ({ ...prev, [messageId]: 'Vrátené na úpravu' }))
  }, [])

  // Right panel has tabs when there's a task summary
  const hasTaskSummary = currentConversation?.taskSummary != null
  const showArtifactTab = selectedArtifact != null
  const showRightPanelTabs = hasTaskSummary && showArtifactTab

  return (
    <div className="flex h-full">
      {/* ── Left rail: Conversation list ── */}
      <div className="flex w-[260px] min-w-[260px] flex-col border-r border-border">
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
              key={conv.id}
              type="button"
              onClick={() => handleConversationSelect(conv.id)}
              className={cn(
                'flex w-full flex-col gap-0.5 border-b border-border/50 px-4 py-3 text-left transition-colors hover:bg-muted/10',
                activeId === conv.id && 'bg-muted/20'
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
                  type={conv.type}
                  taskRef={conv.taskRef ?? conv.promotedTo}
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
          <span className="truncate text-[14px] font-semibold text-foreground">
            {currentConversation?.title ?? ''}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-success" />
            <span className="font-heading text-[11px] text-muted-foreground">
              {t('chat.online')}
            </span>
          </div>
        </div>

        {/* Promoted banner */}
        {currentConversation?.promotedTo && (
          <PromotedBanner
            taskId={currentConversation.promotedTo.taskId}
            taskTitle={currentConversation.promotedTo.taskTitle}
            onNavigate={handleNavigateToTasks}
          />
        )}

        {/* Discussion header */}
        {currentConversation?.type === 'discussion' && currentConversation.taskRef && (
          <DiscussionHeader
            taskId={currentConversation.taskRef.taskId}
            taskTitle={currentConversation.taskRef.taskTitle}
            onNavigate={handleNavigateToTasks}
          />
        )}

        {/* Task progress strip */}
        {currentConversation?.taskSummary && currentConversation.type === 'task' && (
          <TaskProgressStrip summary={currentConversation.taskSummary} />
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
                {currentConversation.messages.map((msg) => (
                  <m.div
                    key={msg.id}
                    {...messageEntrance}
                    className={cn(
                      'max-w-[85%]',
                      msg.role === 'user' && 'self-end',
                      msg.role === 'bot' && 'self-start',
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

                    {/* Task event */}
                    {msg.taskEvent && !msg.content && !msg.toolCard && (
                      <TaskEventBlock event={msg.taskEvent} />
                    )}

                    {/* Tool card only */}
                    {msg.toolCard && !msg.content && !msg.taskEvent && (
                      <ToolCardBlock card={msg.toolCard} t={t} onNavigateToTasks={handleNavigateToTasks} />
                    )}

                    {/* User message */}
                    {msg.role === 'user' && msg.content && (
                      <div className="rounded-none border border-primary/15 bg-primary/8 px-3.5 py-2.5 text-[13px] leading-relaxed text-foreground">
                        {msg.content}
                      </div>
                    )}

                    {/* Bot message */}
                    {msg.role === 'bot' && msg.content && (
                      <div className="py-1">
                        {msg.typing ? (
                          <TypingIndicator />
                        ) : (
                          <>
                            <span
                              className="text-[13px] leading-relaxed text-muted-foreground [&_strong]:text-foreground"
                              dangerouslySetInnerHTML={{
                                __html: msg.content.replace(/\n/g, '<br/>'),
                              }}
                            />
                            {msg.artifactRef && (
                              <>
                                <span className="text-[13px] text-muted-foreground">
                                  {' '}
                                  &rarr;
                                </span>
                                <ArtifactLink
                                  artifactRef={msg.artifactRef}
                                  onSelect={handleArtifactSelect}
                                />
                              </>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {/* Bot typing (no content) */}
                    {msg.role === 'bot' && !msg.content && msg.typing && (
                      <div className="py-1">
                        <TypingIndicator />
                      </div>
                    )}

                    {/* Tool card after content */}
                    {msg.toolCard && msg.content && (
                      <ToolCardBlock card={msg.toolCard} t={t} onNavigateToTasks={handleNavigateToTasks} />
                    )}

                    {/* Task event after content */}
                    {msg.taskEvent && msg.content && (
                      <TaskEventBlock event={msg.taskEvent} />
                    )}

                    {/* Action buttons */}
                    {msg.actionRequest && (
                      <ActionButtons
                        actionRequest={msg.actionRequest}
                        onApprove={() => handleApprove(msg.id)}
                        onReturn={() => handleReturn(msg.id)}
                        resolved={resolvedActions[msg.id] ?? null}
                      />
                    )}
                  </m.div>
                ))}
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

      {/* ── Right: Artifact / Task summary panel ── */}
      <div className="flex w-[380px] min-w-[380px] flex-col border-l border-border">
        {/* Tab bar (when both artifact and task summary available) */}
        {showRightPanelTabs && (
          <div className="flex border-b border-border">
            <button
              type="button"
              onClick={() => setRightTab('artifact')}
              className={cn(
                'flex-1 py-2.5 text-center font-heading text-[12px] transition-colors',
                rightTab === 'artifact'
                  ? 'border-b-2 border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t('chat.tab_artifact')}
            </button>
            <button
              type="button"
              onClick={() => setRightTab('task')}
              className={cn(
                'flex-1 py-2.5 text-center font-heading text-[12px] transition-colors',
                rightTab === 'task'
                  ? 'border-b-2 border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t('chat.tab_task')}
            </button>
          </div>
        )}

        {/* Task summary (no tabs, task/discussion without artifacts) */}
        {hasTaskSummary && !showRightPanelTabs && rightTab === 'task' && currentConversation?.taskSummary && (
          <TaskSummaryPanel summary={currentConversation.taskSummary} />
        )}

        {/* Task summary (with tabs) */}
        {showRightPanelTabs && rightTab === 'task' && currentConversation?.taskSummary && (
          <TaskSummaryPanel summary={currentConversation.taskSummary} />
        )}

        {/* Artifact view */}
        {rightTab === 'artifact' && selectedArtifact ? (
          <>
            {/* Artifact header */}
            <div className="flex items-center gap-3 border-b border-border px-5 py-3">
              <h3 className="flex-1 truncate text-[14px] font-semibold text-foreground">
                {selectedArtifact.title}
              </h3>
              <span className="inline-flex items-center gap-1 bg-muted/30 px-2 py-0.5 font-heading text-[11px] text-muted-foreground">
                {(() => {
                  const Icon = ARTIFACT_TYPE_ICONS[selectedArtifact.type]
                  return <Icon className="size-3" />
                })()}
                {ARTIFACT_TYPE_LABELS[selectedArtifact.type]}
              </span>
            </div>

            {/* Artifact content */}
            <div className="flex-1 overflow-y-auto p-5">
              {renderMarkdown(selectedArtifact.content)}
            </div>

            {/* Artifact actions */}
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
        ) : rightTab === 'artifact' && !selectedArtifact && !hasTaskSummary ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5">
            <FileTextIcon className="size-8 text-muted-foreground/30" />
            <p className="text-center text-[12px] text-muted-foreground">
              {t('chat.artifact_empty')}
            </p>
          </div>
        ) : null}

        {/* Empty state when no artifact and no task summary */}
        {!selectedArtifact && !hasTaskSummary && rightTab === 'artifact' ? null : null}
      </div>
    </div>
  )
}
