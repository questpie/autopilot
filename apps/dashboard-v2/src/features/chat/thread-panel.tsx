import { useRef, useEffect, useMemo, useCallback, useState, memo } from "react"
import { useQuery } from "@tanstack/react-query"
import { XIcon, PaperPlaneTiltIcon } from "@phosphor-icons/react"
import { AnimatePresence, m } from "framer-motion"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/lib/i18n"
import { EASING, DURATION, useMotionPreference } from "@/lib/motion"
import { messagesQuery, threadMessagesQuery } from "./chat.queries"
import { MessageBlock } from "./message-block"
import { useChatUIStore } from "./chat-ui.store"
import { useSendMessage } from "./chat.mutations"

interface Message {
  id: string
  from: string
  at: string
  content: string
  mentions: string[]
  references: string[]
  thread: string | null
  thread_id?: string | null
  external: boolean
}

const FIVE_MINUTES = 5 * 60 * 1000

export function ThreadPanel() {
  const threadTarget = useChatUIStore((s) => s.threadTarget)
  const closeThread = useChatUIStore((s) => s.closeThread)
  const { shouldReduce } = useMotionPreference()

  if (!threadTarget) return null

  return (
    <m.div
      initial={shouldReduce ? false : { width: 0, opacity: 0 }}
      animate={{ width: 400, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: "tween", duration: shouldReduce ? 0 : 0.25 }}
      className="flex shrink-0 flex-col border-l border-border bg-background"
    >
      <ThreadPanelContent
        channelId={threadTarget.channelId}
        parentMessageId={threadTarget.messageId}
        onClose={closeThread}
      />
    </m.div>
  )
}

const ThreadPanelContent = memo(function ThreadPanelContent({
  channelId,
  parentMessageId,
  onClose,
}: {
  channelId: string
  parentMessageId: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const { shouldReduce } = useMotionPreference()

  // Fetch the parent message from the channel messages
  const { data: channelMessages } = useQuery(messagesQuery(channelId))
  const parentMessage = useMemo(
    () => (channelMessages as Message[] | undefined)?.find((m) => m.id === parentMessageId) ?? null,
    [channelMessages, parentMessageId],
  )

  // Fetch thread replies
  const { data: threadData } = useQuery(threadMessagesQuery(channelId, parentMessageId))
  const replies = useMemo(() => (threadData ?? []) as Message[], [threadData])

  // Thread input state
  const [draft, setDraft] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const sendMessage = useSendMessage(channelId)

  // Auto-scroll on new replies
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [replies.length])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 100)}px`
  }, [draft])

  const handleSend = useCallback(() => {
    const content = draft.trim()
    if (!content) return

    sendMessage.mutate({
      content,
      thread_id: parentMessageId,
    })

    setDraft("")
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }, [draft, parentMessageId, sendMessage])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  const handleDraftChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => setDraft(e.target.value),
    [],
  )

  const replyCount = replies.length
  const replyLabel = replyCount === 1 ? "reply" : "replies"

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="font-heading text-sm font-medium text-foreground">
            Thread
          </span>
          {replyCount > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {replyCount} {replyLabel}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label={t("common.close")}
          title={t("common.close")}
        >
          <XIcon size={14} />
        </Button>
      </div>

      {/* Scrollable content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {/* Parent message */}
        {parentMessage && (
          <div className="border-b border-border pb-2">
            <MessageBlock
              message={parentMessage}
              isGroupStart
              compact
            />
          </div>
        )}

        {/* Thread replies */}
        <AnimatePresence initial={false}>
          {replies.map((msg, i) => {
            const prev = replies[i - 1]
            const isGroupStart =
              !prev ||
              msg.from !== prev.from ||
              new Date(msg.at).getTime() - new Date(prev.at).getTime() >= FIVE_MINUTES

            return (
              <m.div
                key={msg.id}
                initial={shouldReduce ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: DURATION.normal, ease: EASING.enter }}
              >
                <MessageBlock
                  message={msg}
                  isGroupStart={isGroupStart}
                  isSending={msg.id.startsWith("temp-")}
                  compact
                />
              </m.div>
            )
          })}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* Thread input */}
      <div className="border-t border-border">
        <div className="flex items-end gap-2 px-3 py-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={handleDraftChange}
            onKeyDown={handleKeyDown}
            placeholder="Reply in thread..."
            aria-label="Reply in thread"
            rows={1}
            className="max-h-[100px] flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
          />
          <Button
            size="icon-sm"
            onClick={handleSend}
            disabled={!draft.trim() || sendMessage.isPending}
            className="mb-0.5 shrink-0"
            aria-label={t("chat.send")}
            title={t("chat.send")}
          >
            <PaperPlaneTiltIcon size={14} />
          </Button>
        </div>
      </div>
    </>
  )
})
