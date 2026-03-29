import { useRef, useEffect, useState, useMemo, useCallback, memo } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import { useVirtualizer } from "@tanstack/react-virtual"
import { ArrowDownIcon } from "@phosphor-icons/react"
import type { Message } from "./chat.types"
import { messagesInfiniteQuery } from "./chat.queries"
import { MessageBlock } from "./message-block"
import { DayDivider } from "./day-divider"
import { StreamingMessage } from "./streaming-message"
import { TypingIndicator } from "./typing-indicator"
import { InlineSessionPreview } from "./inline-session-preview"
import { ConversationSkeleton } from "./chat-skeletons"
import { ConversationEmpty } from "./chat-empty-states"
import { cn } from "@/lib/utils"
import { useChatUIStore } from "./chat-ui.store"
import type { StreamingState } from "./use-streaming-chat"

interface MessageGroup {
  type: "day-divider" | "message"
  date?: Date
  message?: Message
  isGroupStart?: boolean
}

/**
 * Groups messages by day and by consecutive sender within 5 minutes.
 */
function groupMessages(messages: Message[]): MessageGroup[] {
  const groups: MessageGroup[] = []
  let lastDate: string | null = null
  let lastFrom: string | null = null
  let lastTime: number | null = null

  const FIVE_MINUTES = 5 * 60 * 1000

  for (const msg of messages) {
    const msgDate = new Date(msg.at)
    const dateKey = msgDate.toDateString()

    // Day divider
    if (dateKey !== lastDate) {
      groups.push({ type: "day-divider", date: msgDate })
      lastDate = dateKey
      lastFrom = null
      lastTime = null
    }

    // Check if same sender within 5 min
    const isSameSender = msg.from === lastFrom
    const isWithinWindow =
      lastTime !== null && msgDate.getTime() - lastTime < FIVE_MINUTES
    const isGroupStart = !isSameSender || !isWithinWindow || msg.from === "system"

    groups.push({
      type: "message",
      message: msg,
      isGroupStart,
    })

    lastFrom = msg.from
    lastTime = msgDate.getTime()
  }

  return groups
}

/** Estimate row height: day dividers are small, group-start messages taller. */
function estimateSize(group: MessageGroup): number {
  if (group.type === "day-divider") return 40
  if (group.isGroupStart) return 72
  return 32
}

interface ConversationProps {
  channelId: string
  compact?: boolean
  /** D13: Live streaming state from useStreamingChat — renders live agent response below messages. */
  streaming?: StreamingState & { agentId: string }
  /** D17: Agents currently typing in this channel. */
  typingAgents?: Array<{ agentId: string; sessionId: string }>
  /** Human users currently typing in this channel. */
  typingUsers?: Array<{ userId: string; channelId: string }>
  /** D17: Callback when "Watch live" is clicked. */
  onWatchLive?: (sessionId: string) => void
}

export function Conversation({ channelId, compact = false, streaming, typingAgents, typingUsers, onWatchLive }: ConversationProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  // D18: Track which session is being previewed inline
  const [watchingSessionId, setWatchingSessionId] = useState<string | null>(null)
  const prevMessageCountRef = useRef(0)

  const setReplyingTo = useChatUIStore((s) => s.setReplyingTo)
  const openThread = useChatUIStore((s) => s.openThread)

  // Infinite query for cursor-based pagination
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery(messagesInfiniteQuery(channelId))

  // Flatten all pages into a single message array (oldest first)
  const messages = useMemo(() => {
    if (!data?.pages) return [] as Message[]
    // Pages are fetched newest-first via "before" cursor; reverse to get chronological order
    const allPages = [...data.pages].reverse()
    const flat: Message[] = []
    for (const page of allPages) {
      for (const msg of page as Message[]) {
        flat.push(msg)
      }
    }
    return flat
  }, [data])

  const grouped = useMemo(() => groupMessages(messages), [messages])

  // Build lookup map: messageId -> Message (for reply references)
  const messageMap = useMemo(() => {
    const map = new Map<string, Message>()
    for (const msg of messages) {
      map.set(msg.id, msg)
    }
    return map
  }, [messages])

  // Build thread reply counts: parentMessageId -> { count, lastAt }
  const threadStats = useMemo(() => {
    const stats = new Map<string, { count: number; lastAt: string }>()
    for (const msg of messages) {
      if (msg.thread_id) {
        const existing = stats.get(msg.thread_id)
        if (existing) {
          existing.count++
          if (msg.at > existing.lastAt) existing.lastAt = msg.at
        } else {
          stats.set(msg.thread_id, { count: 1, lastAt: msg.at })
        }
      }
    }
    return stats
  }, [messages])

  // Virtualizer for the message list
  const virtualizer = useVirtualizer({
    count: grouped.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => estimateSize(grouped[index]),
    overscan: 10,
  })

  // Callbacks for message actions
  const handleReply = useCallback(
    (msg: Message) => {
      setReplyingTo({
        messageId: msg.id,
        senderName: msg.from,
        content: msg.content,
      })
    },
    [setReplyingTo],
  )

  const handleThread = useCallback(
    (msg: Message) => {
      openThread({ messageId: msg.id, channelId })
    },
    [openThread, channelId],
  )

  const handleWatchLive = useCallback(
    (sid: string) => {
      setWatchingSessionId(sid)
      onWatchLive?.(sid)
    },
    [onWatchLive],
  )

  const handleClosePreview = useCallback(() => {
    setWatchingSessionId(null)
  }, [])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (autoScroll && messages.length > prevMessageCountRef.current) {
      virtualizer.scrollToIndex(grouped.length - 1, { align: "end" })
    }
    prevMessageCountRef.current = messages.length
  }, [messages.length, autoScroll, grouped.length, virtualizer])

  // D13: Auto-scroll on streaming text delta
  useEffect(() => {
    if (autoScroll && streaming?.isStreaming) {
      const el = scrollRef.current
      if (el) {
        el.scrollTop = el.scrollHeight
      }
    }
  }, [streaming?.streamedText, streaming?.isStreaming, autoScroll])

  // Initial scroll to bottom
  useEffect(() => {
    if (grouped.length > 0) {
      virtualizer.scrollToIndex(grouped.length - 1, { align: "end" })
    }
  }, [channelId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Detect user scrolling to disable auto-scroll + load older messages
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const threshold = 100
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
    setAutoScroll(isAtBottom)

    // Load older messages when scrolled near top
    if (el.scrollTop < 200 && hasNextPage && !isFetchingNextPage) {
      const prevHeight = el.scrollHeight
      fetchNextPage().then(() => {
        // Preserve scroll position after prepending older messages
        requestAnimationFrame(() => {
          const newHeight = el.scrollHeight
          el.scrollTop += newHeight - prevHeight
        })
      })
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const scrollToBottom = useCallback(() => {
    if (grouped.length > 0) {
      virtualizer.scrollToIndex(grouped.length - 1, { align: "end" })
    }
    setAutoScroll(true)
  }, [grouped.length, virtualizer])

  if (isLoading) {
    return <ConversationSkeleton compact={compact} />
  }

  if (messages.length === 0) {
    return <ConversationEmpty />
  }

  const virtualItems = virtualizer.getVirtualItems()

  return (
    <div className="relative flex flex-1 flex-col">
      <div
        ref={scrollRef}
        className={cn("flex-1 overflow-y-auto pb-2", compact && "text-xs")}
        onScroll={handleScroll}
      >
        {/* Loading older messages indicator */}
        {isFetchingNextPage && (
          <div className="flex justify-center py-2">
            <span className="text-[10px] text-muted-foreground">Loading older messages...</span>
          </div>
        )}

        {/* Virtualized message list */}
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualItems.map((virtualRow) => {
            const group = grouped[virtualRow.index]
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {group.type === "day-divider" && group.date ? (
                  <DayDivider date={group.date} />
                ) : group.type === "message" && group.message ? (
                  <MemoizedMessageRow
                    message={group.message}
                    channelId={channelId}
                    isGroupStart={group.isGroupStart ?? true}
                    compact={compact}
                    messageMap={messageMap}
                    threadStats={threadStats}
                    onReply={handleReply}
                    onThread={handleThread}
                  />
                ) : null}
              </div>
            )
          })}
        </div>

        {/* D13: Live streaming agent response */}
        {streaming && (streaming.isStreaming || streaming.streamedText || streaming.error) && (
          <StreamingMessage
            agentId={streaming.agentId}
            state={streaming}
            compact={compact}
          />
        )}

        {/* D18: Inline session preview when watching live */}
        {watchingSessionId && (
          <InlineSessionPreview
            sessionId={watchingSessionId}
            onClose={handleClosePreview}
            compact={compact}
          />
        )}

        {/* D17: Typing indicator (agents working + humans typing) */}
        {((typingAgents && typingAgents.length > 0) || (typingUsers && typingUsers.length > 0)) && (
          <TypingIndicator
            agents={typingAgents ?? []}
            users={typingUsers}
            onWatchLive={handleWatchLive}
            compact={compact}
          />
        )}
      </div>

      {/* Scroll-to-bottom indicator */}
      {!autoScroll && (
        <button
          type="button"
          onClick={scrollToBottom}
          aria-label="Scroll to bottom"
          className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5 border border-border bg-card px-3 py-1.5 font-heading text-[10px] text-muted-foreground shadow-sm transition-colors hover:text-foreground"
        >
          <ArrowDownIcon size={12} />
        </button>
      )}
    </div>
  )
}

/**
 * Memoized wrapper for a message row inside the virtualizer.
 * Avoids re-renders when sibling messages or virtualizer state changes.
 */
interface MemoizedMessageRowProps {
  message: Message
  channelId: string
  isGroupStart: boolean
  compact: boolean
  messageMap: Map<string, Message>
  threadStats: Map<string, { count: number; lastAt: string }>
  onReply: (msg: Message) => void
  onThread: (msg: Message) => void
}

const MemoizedMessageRow = memo(function MemoizedMessageRow({
  message,
  channelId,
  isGroupStart,
  compact,
  messageMap,
  threadStats,
  onReply,
  onThread,
}: MemoizedMessageRowProps) {
  const isSending = message.id.startsWith("temp-")
  const parentMsg = message.thread_id ? messageMap.get(message.thread_id) ?? null : undefined
  const stats = threadStats.get(message.id)

  return (
    <MessageBlock
      message={message}
      channelId={channelId}
      isGroupStart={isGroupStart}
      isSending={isSending}
      compact={compact}
      onReply={onReply}
      onThread={onThread}
      parentMessage={parentMsg}
      threadReplyCount={stats?.count}
      lastThreadReplyAt={stats?.lastAt}
    />
  )
}, (prev, next) => {
  // Custom comparator: only re-render when message data actually changes
  return (
    prev.message.id === next.message.id &&
    prev.message.content === next.message.content &&
    prev.message.edited_at === next.message.edited_at &&
    prev.isGroupStart === next.isGroupStart &&
    prev.compact === next.compact &&
    prev.channelId === next.channelId &&
    prev.messageMap === next.messageMap &&
    prev.threadStats === next.threadStats &&
    prev.onReply === next.onReply &&
    prev.onThread === next.onThread
  )
})
