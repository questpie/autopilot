import { memo } from "react"
import { MarkdownRenderer } from "@/components/markdown-renderer"
import { ResourceLinker } from "@/components/resource-linker"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { ArrowClockwiseIcon } from "@phosphor-icons/react"

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

interface MessageBubbleProps {
  message: Message
  /** Whether this is the first message in a group (shows avatar + name) */
  isGroupStart: boolean
  /** Whether the message is still sending (optimistic) */
  isSending?: boolean
  /** Whether sending failed */
  isFailed?: boolean
  /** Retry callback for failed messages */
  onRetry?: () => void
  /** Compact mode for sidebar panel */
  compact?: boolean
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

function formatAbsoluteTimestamp(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

/** Generates a deterministic color from a string (for avatar backgrounds). */
function stringToColor(str: string): string {
  const colors = [
    "bg-primary/20 text-primary",
    "bg-blue-500/20 text-blue-400",
    "bg-green-500/20 text-green-400",
    "bg-amber-500/20 text-amber-400",
    "bg-red-500/20 text-red-400",
    "bg-cyan-500/20 text-cyan-400",
    "bg-violet-500/20 text-violet-400",
    "bg-pink-500/20 text-pink-400",
  ]
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

function SystemMessage({ message }: { message: Message }) {
  return (
    <div className="flex justify-center px-4 py-2">
      <span className="font-heading text-[11px] text-muted-foreground">
        {message.content}
      </span>
    </div>
  )
}

export const MessageBubble = memo(function MessageBubble({
  message,
  isGroupStart,
  isSending,
  isFailed,
  onRetry,
  compact = false,
}: MessageBubbleProps) {
  const { t } = useTranslation()

  // System messages render centered
  if (message.from === "system") {
    return <SystemMessage message={message} />
  }

  const avatarColor = stringToColor(message.from)
  const initial = message.from.charAt(0).toUpperCase()
  const isAgent = !message.external
  const primitiveLabel = isAgent ? "send_message" : null

  return (
    <div
      className={cn(
        "group flex gap-2.5 px-4",
        isGroupStart ? "pt-2" : "pt-0.5",
        compact && "px-3",
        isSending && "opacity-60",
      )}
    >
      {/* Avatar column */}
      <div className={cn("w-8 shrink-0", compact && "w-6")}>
        {isGroupStart && (
          <div
            className={cn(
              "flex items-center justify-center font-heading text-xs font-bold",
              compact ? "size-6 text-[10px]" : "size-8 text-xs",
              avatarColor,
            )}
            title={message.from}
          >
            {initial}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {isGroupStart && (
          <div className="mb-0.5 flex items-center gap-2">
            <span className="font-heading text-xs font-semibold text-foreground">
              {message.from}
            </span>
            <span
              className="text-[10px] text-muted-foreground/60"
              title={formatAbsoluteTimestamp(message.at)}
            >
              {formatTimestamp(message.at)}
            </span>
            {primitiveLabel && (
              <span className="text-[10px] italic text-muted-foreground/40">
                {t("chat.via_primitive", { primitive: primitiveLabel })}
              </span>
            )}
          </div>
        )}

        {/* Message body */}
        <div className="text-sm">
          <MarkdownRenderer content={message.content} mode="inline" />
        </div>

        {/* Resource references */}
        {message.references.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {message.references.map((ref) => (
              <ResourceLinker key={ref} text={ref} className="text-xs" />
            ))}
          </div>
        )}

        {/* Sending / failed state */}
        {isSending && (
          <span className="text-[10px] text-muted-foreground">
            {t("chat.sending")}
          </span>
        )}
        {isFailed && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-1 flex items-center gap-1 text-[10px] text-destructive hover:underline"
          >
            <ArrowClockwiseIcon size={10} />
            {t("chat.retry_send")}
          </button>
        )}
      </div>
    </div>
  )
})
