import { useQuery } from "@tanstack/react-query"
import { pinnedMessagesQuery, messagesQuery } from "./chat.queries"
import { useUnpinMessage } from "./chat.mutations"
import { PushPinIcon, PushPinSlashIcon, XIcon } from "@phosphor-icons/react"
import { useChatUIStore } from "./chat-ui.store"
import { memo, useCallback, useMemo } from "react"

interface PinnedMessagesPanelProps {
  channelId: string
}

export const PinnedMessagesPanel = memo(function PinnedMessagesPanel({ channelId }: PinnedMessagesPanelProps) {
  const setPinnedPanelOpen = useChatUIStore((s) => s.setPinnedPanelOpen)
  const { data: pins } = useQuery(pinnedMessagesQuery(channelId))
  const { data: messages } = useQuery(messagesQuery(channelId))
  const unpinMessage = useUnpinMessage(channelId)

  const pinnedWithContent = useMemo(() => {
    if (!pins || !messages) return []
    return pins
      .map((pin) => {
        const msg = (messages as Array<{ id: string; from: string; content: string; at: string }>).find(
          (m) => m.id === pin.message_id,
        )
        return msg ? { ...pin, message: msg } : null
      })
      .filter(Boolean) as Array<{
      id: string
      channel_id: string
      message_id: string
      pinned_by: string
      pinned_at: string
      message: { id: string; from: string; content: string; at: string }
    }>
  }, [pins, messages])

  const handleClose = useCallback(() => setPinnedPanelOpen(false), [setPinnedPanelOpen])

  return (
    <div className="flex h-full flex-col border-l border-border bg-background">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-1.5">
          <PushPinIcon size={14} className="text-muted-foreground" />
          <span className="font-heading text-xs font-semibold">
            Pinned Messages
          </span>
          {pins && (
            <span className="rounded bg-muted/60 px-1 py-px text-[10px] text-muted-foreground">
              {pins.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Close pinned messages"
        >
          <XIcon size={14} />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {pinnedWithContent.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
            No pinned messages
          </div>
        ) : (
          <div className="flex flex-col gap-px p-1">
            {pinnedWithContent.map((pin) => (
              <PinnedMessageItem
                key={pin.id}
                pin={pin}
                onUnpin={unpinMessage.mutate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
})

const PinnedMessageItem = memo(function PinnedMessageItem({
  pin,
  onUnpin,
}: {
  pin: {
    id: string
    message_id: string
    message: { id: string; from: string; content: string; at: string }
  }
  onUnpin: (messageId: string) => void
}) {
  const handleUnpin = useCallback(() => onUnpin(pin.message_id), [onUnpin, pin.message_id])

  return (
    <div className="group flex gap-2 rounded px-2 py-2 hover:bg-muted/30">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs font-semibold text-foreground">
            {pin.message.from}
          </span>
          <span className="text-[10px] text-muted-foreground/60">
            {new Date(pin.message.at).toLocaleDateString()}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-foreground/80">
          {pin.message.content}
        </p>
      </div>
      <button
        type="button"
        onClick={handleUnpin}
        className="shrink-0 self-start text-muted-foreground/50 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
        aria-label="Unpin message"
        title="Unpin"
      >
        <PushPinSlashIcon size={12} />
      </button>
    </div>
  )
})
