import { useMemo } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import type { Message } from "./chat.types"
import { messagesInfiniteQuery } from "./chat.queries"

export interface MessageGroup {
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
export function estimateSize(group: MessageGroup): number {
  if (group.type === "day-divider") return 40
  if (group.isGroupStart) return 72
  return 32
}

export function useConversationData(channelId: string) {
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

  const groups = useMemo(() => groupMessages(messages), [messages])

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

  return {
    messages,
    groups,
    messageMap,
    threadStats,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  }
}
