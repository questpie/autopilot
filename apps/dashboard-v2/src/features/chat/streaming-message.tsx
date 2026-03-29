import { memo } from "react"
import { MarkdownRenderer } from "@/components/markdown-renderer"
import { cn, stringToColor } from "@/lib/utils"
import { SpinnerGapIcon } from "@phosphor-icons/react"
import type { StreamingState } from "./use-streaming-chat"
import { ToolEmbed } from "./tool-embed"

export { stringToColor } from "@/lib/utils"
export { MiniToolEmbed } from "./tool-embed"

interface StreamingMessageProps {
  agentId: string
  state: StreamingState
  compact?: boolean
  /** D22: Retry callback for failed sessions. */
  onRetry?: () => void
}

/**
 * Renders a streaming agent response with live text_delta rendering,
 * Discord-style tool call embeds, and a blinking cursor animation.
 */
export const StreamingMessage = memo(function StreamingMessage({ agentId, state, compact = false, onRetry }: StreamingMessageProps) {
  const { isStreaming, streamedText, activeToolCalls, toolResults, error } = state
  const avatarColor = stringToColor(agentId)
  const initial = agentId.charAt(0).toUpperCase()

  // Don't render if nothing to show
  if (!isStreaming && !streamedText && !error && toolResults.length === 0) return null

  return (
    <div className={cn("group relative flex gap-3 px-4 py-0.5 mt-2", compact && "gap-2 px-3")}>
      {/* Avatar */}
      <div className={cn("w-10 shrink-0", compact && "w-7")}>
        <div
          className={cn(
            "flex items-center justify-center rounded-full font-heading text-xs font-bold",
            compact ? "size-7 text-[10px]" : "size-8 text-xs",
            avatarColor,
          )}
          title={agentId}
        >
          {initial}
        </div>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Header */}
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-foreground">{agentId}</span>
          <span className="rounded bg-primary/20 px-1.5 py-px text-[10px] font-medium text-primary">
            BOT
          </span>
          {isStreaming && (
            <span className="flex items-center gap-1 text-[10px] text-primary/70">
              <SpinnerGapIcon size={10} className="animate-spin" />
              streaming
            </span>
          )}
        </div>

        {/* Streamed text with blinking cursor */}
        {streamedText && (
          <div className="text-sm leading-relaxed">
            <MarkdownRenderer content={streamedText} mode="inline" />
            {isStreaming && (
              <span className="animate-blink-cursor ml-px inline-block h-[1.1em] w-[2px] translate-y-[2px] bg-primary/80" />
            )}
          </div>
        )}

        {/* D14: Completed tool results — Discord-style embeds */}
        {toolResults.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {toolResults.map((tr) => (
              <ToolEmbed
                key={tr.id}
                tool={tr.tool}
                status="completed"
                content={tr.content}
              />
            ))}
          </div>
        )}

        {/* D14: Active tool calls — Discord-style embeds with spinner */}
        {activeToolCalls.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {activeToolCalls.map((tc) => (
              <ToolEmbed
                key={tc.id}
                tool={tc.tool}
                status="running"
                params={tc.params}
              />
            ))}
          </div>
        )}

        {/* Waiting indicator when no text yet */}
        {isStreaming && !streamedText && activeToolCalls.length === 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <SpinnerGapIcon size={12} className="animate-spin text-primary/50" />
            Thinking...
          </div>
        )}

        {/* D22: Error with retry */}
        {error && (
          <div className="mt-2">
            <ToolEmbed tool="error" status="error" content={error} onRetry={onRetry} />
          </div>
        )}
      </div>
    </div>
  )
})
