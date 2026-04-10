import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { createFileRoute } from '@tanstack/react-router'
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
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { fadeInUp, EASING, DURATION } from '@/lib/motion'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'
import { useChatSeedStore } from '@/stores/chat-seed.store'
import { getQueries } from '@/api/queries.api'
import type { Query } from '@/api/types'

export const Route = createFileRoute('/_app/chat')({
  component: ChatPage,
})

// ── UI View Models (derived from backend Query type) ──

type MessageRole = 'user' | 'bot'

interface ToolCard {
  kind: 'created' | 'updated'
  taskId: string
  taskTitle: string
}

interface ArtifactRef {
  artifactId: string
  label: string
}

interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  toolCard?: ToolCard
  artifactRef?: ArtifactRef
  typing?: boolean
}

type ArtifactType = 'document' | 'table' | 'code'

interface ChatArtifact {
  id: string
  title: string
  type: ArtifactType
  content: string
}

interface Conversation {
  id: string
  title: string
  lastPreview: string
  time: string
  messages: ChatMessage[]
  artifacts: ChatArtifact[]
}

// ── Transform: Query -> Conversation ──

function queryToConversation(query: Query): Conversation {
  const messages: ChatMessage[] = []
  const artifacts: ChatArtifact[] = []

  // User prompt becomes the first message
  messages.push({
    id: `${query.id}-user`,
    role: 'user',
    content: query.prompt,
  })

  // If the query spawned a task, show a tool card
  const spawnedTaskId = typeof query.metadata.spawned_task_id === 'string'
    ? query.metadata.spawned_task_id
    : null

  if (spawnedTaskId) {
    messages.push({
      id: `${query.id}-tool`,
      role: 'bot',
      content: '',
      toolCard: {
        kind: 'created',
        taskId: spawnedTaskId,
        taskTitle: query.prompt.slice(0, 50),
      },
    })
  }

  // Summary becomes the bot response
  if (query.summary) {
    const artifactId = `${query.id}-art`
    artifacts.push({
      id: artifactId,
      title: query.prompt.slice(0, 60),
      type: 'document',
      content: query.summary,
    })

    messages.push({
      id: `${query.id}-bot`,
      role: 'bot',
      content: query.summary,
      artifactRef: {
        artifactId,
        label: query.prompt.slice(0, 60),
      },
    })
  } else if (query.status === 'running') {
    messages.push({
      id: `${query.id}-typing`,
      role: 'bot',
      content: '',
      typing: true,
    })
  }

  const timeStr = formatQueryTime(query.created_at)

  return {
    id: query.id,
    title: query.prompt.slice(0, 60),
    lastPreview: query.summary ?? (query.status === 'running' ? '...' : ''),
    time: timeStr,
    messages,
    artifacts,
  }
}

function formatQueryTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (dateDay.getTime() >= today.getTime()) {
    return date.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })
  }
  const yesterday = new Date(today.getTime() - 86400000)
  if (dateDay.getTime() >= yesterday.getTime()) {
    return 'Vcera'
  }
  return date.toLocaleDateString('sk-SK', { weekday: 'short' })
}

// ── Helpers ──

const messageEntrance = {
  ...fadeInUp,
  transition: { duration: DURATION.normal, ease: EASING.enter },
}

const ARTIFACT_TYPE_ICONS: Record<ArtifactType, typeof FileTextIcon> = {
  document: FileTextIcon,
  table: TableIcon,
  code: CodeIcon,
}

const ARTIFACT_TYPE_LABELS: Record<ArtifactType, string> = {
  document: 'Dokument',
  table: 'Tabulka',
  code: 'Kod',
}

function findArtifact(conversations: Conversation[], artifactId: string): ChatArtifact | undefined {
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

function ToolCardBlock({ card, t }: { card: ToolCard; t: (key: string) => string }) {
  const label =
    card.kind === 'created' ? t('chat.tool_task_created') : t('chat.tool_task_updated')

  return (
    <div className="my-2 border border-border bg-muted/20 px-3.5 py-2.5">
      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <WrenchIcon className="size-3.5 shrink-0" />
        <span className="font-heading">{label}</span>
      </div>
      <p className="mt-1 font-heading text-[12px] text-foreground">
        {card.taskId} \u00b7 {card.taskTitle}
      </p>
      <button
        type="button"
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
  artifactRef: ArtifactRef
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
          <span className="mr-1.5 text-muted-foreground/50">\u00b7</span>
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
  // Handle **bold** inline
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

// ── Main Component ──

function ChatPage() {
  const { t } = useTranslation()
  const pendingSeed = useChatSeedStore((s) => s.pendingSeed)
  const clearSeed = useChatSeedStore((s) => s.clearSeed)

  // Load queries from adapter
  const [queries, setQueries] = useState<Query[]>([])

  useEffect(() => {
    getQueries().then(setQueries)
  }, [])

  // Derive conversations from queries
  const queryConversations = useMemo<Conversation[]>(
    () => queries.map(queryToConversation),
    [queries],
  )

  // Build seed conversation
  const seedConversation = useMemo<Conversation | null>(() => {
    if (!pendingSeed) return null
    return {
      id: '__seed__',
      title: pendingSeed.title,
      lastPreview: pendingSeed.context.slice(0, 60),
      time: 'Teraz',
      artifacts: [],
      messages: [
        {
          id: 'seed-bot',
          role: 'bot',
          content: pendingSeed.context,
        },
      ],
    }
  }, [pendingSeed])

  const allConversations = useMemo<Conversation[]>(() => {
    if (!seedConversation) return queryConversations
    return [seedConversation, ...queryConversations]
  }, [seedConversation, queryConversations])

  const [activeId, setActiveId] = useState<string | null>(() =>
    pendingSeed ? '__seed__' : null
  )

  // Auto-select first conversation when loaded
  useEffect(() => {
    if (activeId === null && allConversations.length > 0) {
      setActiveId(allConversations[0].id)
    }
  }, [activeId, allConversations])

  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-select first artifact when conversations load
  useEffect(() => {
    if (selectedArtifactId === null && allConversations.length > 0) {
      const first = allConversations[0]
      if (first.artifacts.length > 0) {
        setSelectedArtifactId(first.artifacts[first.artifacts.length - 1].id)
      }
    }
  }, [selectedArtifactId, allConversations])

  // Auto-select seed when it arrives
  useEffect(() => {
    if (pendingSeed) {
      setActiveId('__seed__')
      clearSeed()
    }
  }, [pendingSeed, clearSeed])

  const currentConversation =
    allConversations.find((c) => c.id === activeId) ?? allConversations[0] ?? null

  const selectedArtifact = selectedArtifactId
    ? findArtifact(allConversations, selectedArtifactId)
    : undefined

  const filteredConversations = searchQuery
    ? allConversations.filter((c) =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allConversations

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeId])

  const handleArtifactSelect = useCallback((artifactId: string) => {
    setSelectedArtifactId(artifactId)
  }, [])

  const handleConversationSelect = useCallback(
    (id: string) => {
      setActiveId(id)
      // Select the latest artifact from that conversation
      const conv = allConversations.find((c) => c.id === id)
      if (conv && conv.artifacts.length > 0) {
        setSelectedArtifactId(conv.artifacts[conv.artifacts.length - 1].id)
      } else {
        setSelectedArtifactId(null)
      }
    },
    [allConversations]
  )

  const handleTextareaInput = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [])

  return (
    <div className="flex h-full">
      {/* ── Left rail: Conversation list ── */}
      <div className="flex w-[260px] min-w-[260px] flex-col border-r border-border">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-[13px] font-semibold text-foreground">
            {t('chat.conversations')}
          </h2>
          <Button variant="ghost" size="xs">
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
              <span className="truncate text-[12px] text-muted-foreground">
                {conv.lastPreview}
              </span>
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
                      msg.role === 'bot' && 'self-start'
                    )}
                  >
                    {/* Tool card only */}
                    {msg.toolCard && !msg.content && (
                      <ToolCardBlock card={msg.toolCard} t={t} />
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
                      <ToolCardBlock card={msg.toolCard} t={t} />
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
                  // send handler would go here
                }
              }}
              placeholder={t('chat.input_placeholder')}
              rows={1}
              className="min-h-[40px] max-h-[120px] flex-1 resize-none rounded-none border border-border bg-input/30 px-3 py-2.5 text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            <Button size="icon" className="size-9 shrink-0">
              <PaperPlaneRightIcon weight="fill" className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Right: Artifact panel ── */}
      <div className="flex w-[380px] min-w-[380px] flex-col border-l border-border">
        {selectedArtifact ? (
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
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5">
            <FileTextIcon className="size-8 text-muted-foreground/30" />
            <p className="text-center text-[12px] text-muted-foreground">
              {t('chat.artifact_empty')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
