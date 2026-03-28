import { useRef, useEffect, useState, useMemo, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { AnimatePresence, m } from "framer-motion"
import { ArrowDownIcon } from "@phosphor-icons/react"
import { messagesQuery } from "./chat.queries"
import { MessageBubble } from "./message-bubble"
import { DayDivider } from "./day-divider"
import { ConversationSkeleton } from "./chat-skeletons"
import { ConversationEmpty } from "./chat-empty-states"
import { cn } from "@/lib/utils"
import { EASING, DURATION, useMotionPreference } from "@/lib/motion"

interface Message {
  id: string
  from: string
  at: string
  content: string
  mentions: string[]
  references: string[]
  thread: string | null
  external: boolean
}

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

interface ConversationProps {
  channelId: string
  compact?: boolean
}

export function Conversation({ channelId, compact = false }: ConversationProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const prevMessageCountRef = useRef(0)
  const { shouldReduce } = useMotionPreference()

  const { data, isLoading } = useQuery(messagesQuery(channelId))

  const messages = useMemo(() => (data ?? []) as Message[], [data])
  const grouped = useMemo(() => groupMessages(messages), [messages])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (autoScroll && messages.length > prevMessageCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
    prevMessageCountRef.current = messages.length
  }, [messages.length, autoScroll])

  // Initial scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView()
  }, [channelId])

  // Detect user scrolling up to disable auto-scroll
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const threshold = 100
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
    setAutoScroll(isAtBottom)
  }, [])

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    setAutoScroll(true)
  }, [])

  if (isLoading) {
    return <ConversationSkeleton compact={compact} />
  }

  if (messages.length === 0) {
    return <ConversationEmpty />
  }

  return (
    <div className="relative flex flex-1 flex-col">
      <div
        ref={scrollRef}
        className={cn("flex-1 overflow-y-auto pb-2", compact && "text-xs")}
        onScroll={handleScroll}
      >
        <AnimatePresence initial={false}>
          {grouped.map((group) => {
            if (group.type === "day-divider" && group.date) {
              return <DayDivider key={`day-${group.date.toISOString()}`} date={group.date} />
            }

            if (group.type === "message" && group.message) {
              const msg = group.message
              const isSending = msg.id.startsWith("temp-")

              // Directional slide: own messages from right, others from left
              const slideX = msg.external ? -12 : 12

              return (
                <m.div
                  key={msg.id}
                  initial={shouldReduce ? false : { opacity: 0, x: slideX }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{
                    duration: DURATION.normal,
                    ease: EASING.enter,
                  }}
                >
                  <MessageBubble
                    message={msg}
                    isGroupStart={group.isGroupStart ?? true}
                    isSending={isSending}
                    compact={compact}
                  />
                </m.div>
              )
            }

            return null
          })}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Scroll-to-bottom indicator */}
      {!autoScroll && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5 border border-border bg-card px-3 py-1.5 font-heading text-[10px] text-muted-foreground shadow-sm transition-colors hover:text-foreground"
        >
          <ArrowDownIcon size={12} />
        </button>
      )}
    </div>
  )
}
