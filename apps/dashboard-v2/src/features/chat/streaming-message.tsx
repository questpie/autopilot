import { MarkdownRenderer } from "@/components/markdown-renderer"
import { cn } from "@/lib/utils"
import { CircleNotchIcon } from "@phosphor-icons/react"
import type { StreamingState } from "./use-streaming-chat"

interface StreamingMessageProps {
  agentId: string
  state: StreamingState
  compact?: boolean
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

/**
 * Renders a streaming agent response with live text_delta rendering,
 * active tool call indicators, and a blinking cursor animation.
 */
export function StreamingMessage({ agentId, state, compact = false }: StreamingMessageProps) {
  const { isStreaming, streamedText, activeToolCalls, error } = state
  const avatarColor = stringToColor(agentId)
  const initial = agentId.charAt(0).toUpperCase()

  // Don't render if nothing to show
  if (!isStreaming && !streamedText && !error) return null

  return (
    <div className={cn("group flex gap-2.5 px-4 pt-2", compact && "px-3")}>
      {/* Avatar */}
      <div className={cn("w-8 shrink-0", compact && "w-6")}>
        <div
          className={cn(
            "flex items-center justify-center font-heading text-xs font-bold",
            compact ? "size-6 text-[10px]" : "size-8 text-xs",
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
        <div className="mb-0.5 flex items-center gap-2">
          <span className="font-heading text-xs font-semibold text-foreground">{agentId}</span>
          {isStreaming && (
            <span className="flex items-center gap-1 text-[10px] text-primary/70">
              <CircleNotchIcon size={10} className="animate-spin" />
              streaming
            </span>
          )}
        </div>

        {/* Streamed text with cursor */}
        {streamedText && (
          <div className="text-sm">
            <MarkdownRenderer content={streamedText} mode="inline" />
            {isStreaming && <span className="inline-block h-4 w-0.5 animate-pulse bg-primary/60" />}
          </div>
        )}

        {/* Active tool calls */}
        {activeToolCalls.length > 0 && (
          <div className="mt-1 space-y-1">
            {activeToolCalls.map((tc, i) => (
              <div
                key={`${tc.tool}-${i}`}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
              >
                <CircleNotchIcon size={12} className="animate-spin text-primary/50" />
                <span className="font-mono">{tc.tool}</span>
              </div>
            ))}
          </div>
        )}

        {/* Waiting indicator when no text yet */}
        {isStreaming && !streamedText && activeToolCalls.length === 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <CircleNotchIcon size={12} className="animate-spin text-primary/50" />
            Thinking...
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-1 text-[11px] text-destructive">{error}</div>
        )}
      </div>
    </div>
  )
}
