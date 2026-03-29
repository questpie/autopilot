import { memo, useState, useCallback } from "react"
import { MarkdownRenderer } from "@/components/markdown-renderer"
import { cn } from "@/lib/utils"
import {
  ArrowClockwiseIcon,
  CaretRightIcon,
  CheckCircleIcon,
  FileTextIcon,
  GearIcon,
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  SpinnerGapIcon,
  TerminalIcon,
  WrenchIcon,
  XCircleIcon,
} from "@phosphor-icons/react"
import type { StreamingState } from "./use-streaming-chat"

interface StreamingMessageProps {
  agentId: string
  state: StreamingState
  compact?: boolean
  /** D22: Retry callback for failed sessions. */
  onRetry?: () => void
}

const AVATAR_COLORS = [
  "bg-primary/20 text-primary",
  "bg-blue-500/20 text-blue-400",
  "bg-green-500/20 text-green-400",
  "bg-amber-500/20 text-amber-400",
  "bg-red-500/20 text-red-400",
  "bg-cyan-500/20 text-cyan-400",
  "bg-violet-500/20 text-violet-400",
  "bg-pink-500/20 text-pink-400",
] as const

/** Generates a deterministic color from a string (for avatar backgrounds). */
export function stringToColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

/** Returns an icon component for a tool name based on its category. */
function getToolIcon(tool: string) {
  const lower = tool.toLowerCase()
  if (lower.includes("read") || lower.includes("dir") || lower.includes("list"))
    return FileTextIcon
  if (lower.includes("edit") || lower.includes("write") || lower.includes("create"))
    return PencilSimpleIcon
  if (lower.includes("grep") || lower.includes("search") || lower.includes("find"))
    return MagnifyingGlassIcon
  if (lower.includes("bash") || lower.includes("exec") || lower.includes("shell") || lower.includes("terminal"))
    return TerminalIcon
  if (lower.includes("config") || lower.includes("setting"))
    return GearIcon
  return WrenchIcon
}

/** Formats tool call params into a compact args summary string. */
function formatArgsSummary(params?: Record<string, unknown>): string {
  if (!params || Object.keys(params).length === 0) return ""
  // Try to find the most meaningful arg (file path, command, query, etc.)
  const priorityKeys = ["file", "path", "file_path", "filePath", "command", "cmd", "query", "pattern", "url"]
  for (const key of priorityKeys) {
    if (params[key] && typeof params[key] === "string") {
      const val = params[key] as string
      // Shorten long paths — show last 2 segments
      if (val.includes("/")) {
        const parts = val.split("/")
        return parts.length > 2 ? parts.slice(-2).join("/") : val
      }
      return val.length > 50 ? `${val.slice(0, 50)}...` : val
    }
  }
  // Fallback: first param value
  const firstEntry = Object.entries(params)[0]
  if (!firstEntry) return ""
  const [, v] = firstEntry
  const str = typeof v === "string" ? v : JSON.stringify(v)
  return str.length > 50 ? `${str.slice(0, 50)}...` : str
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

const BORDER_COLORS: Record<ToolEmbedProps["status"], string> = {
  running: "border-l-primary",
  completed: "border-l-green-500",
  error: "border-l-red-500",
}

const ICON_COLORS: Record<ToolEmbedProps["status"], string> = {
  running: "text-primary",
  completed: "text-green-400",
  error: "text-red-400",
}

function StatusBadge({ status }: { status: ToolEmbedProps["status"] }) {
  if (status === "running") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
        <SpinnerGapIcon size={10} className="animate-spin" />
        running
      </span>
    )
  }
  if (status === "completed") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-1.5 py-0.5 text-[10px] font-medium text-green-400">
        <CheckCircleIcon size={10} weight="fill" />
        completed
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
      <XCircleIcon size={10} weight="fill" />
      error
    </span>
  )
}

interface ToolEmbedProps {
  tool: string
  status: "running" | "completed" | "error"
  params?: Record<string, unknown>
  content?: string
  onRetry?: () => void
}

/** Discord-style tool call embed with colored left border, status badge, and collapsible body. */
const ToolEmbed = memo(function ToolEmbed({ tool, status, params, content, onRetry }: ToolEmbedProps) {
  const [expanded, setExpanded] = useState(false)

  const ToolIcon = status === "error" ? XCircleIcon : getToolIcon(tool)
  const argsSummary = formatArgsSummary(params)
  const canExpand = !!content && content.length > 0

  const handleToggle = useCallback(() => {
    if (canExpand) setExpanded((prev) => !prev)
  }, [canExpand])

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border-l-[3px] bg-muted/10",
        BORDER_COLORS[status],
      )}
    >
      {/* Header */}
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          "flex w-full items-center gap-2 px-3 py-1.5 text-left",
          canExpand ? "cursor-pointer hover:bg-muted/20" : "cursor-default",
        )}
      >
        <ToolIcon
          size={14}
          weight={status === "error" ? "fill" : "regular"}
          className={cn("shrink-0", ICON_COLORS[status])}
        />
        <span className="font-mono text-xs font-medium text-foreground/90">{tool}</span>
        {argsSummary && (
          <span className="truncate font-mono text-[11px] text-muted-foreground/60">
            {argsSummary}
          </span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          <StatusBadge status={status} />
          {canExpand && (
            <CaretRightIcon
              size={10}
              className={cn(
                "text-muted-foreground/50 transition-transform",
                expanded && "rotate-90",
              )}
            />
          )}
        </span>
      </button>

      {/* Expanded body */}
      {expanded && content && (
        <div className="border-t border-border/20 px-3 py-2">
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-muted-foreground">
            {content}
          </pre>
        </div>
      )}

      {/* Collapsed preview for completed results */}
      {!expanded && content && status !== "running" && (
        <div className="border-t border-border/10 px-3 py-1">
          <p className="truncate font-mono text-[10px] text-muted-foreground/50">
            {content.length > 100 ? `${content.slice(0, 100)}...` : content}
          </p>
        </div>
      )}

      {/* Retry button for errors */}
      {status === "error" && onRetry && (
        <div className="border-t border-border/20 px-3 py-1.5">
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-1 text-[11px] text-primary/70 hover:text-primary"
          >
            <ArrowClockwiseIcon size={10} />
            Retry
          </button>
        </div>
      )}
    </div>
  )
})

/**
 * Mini tool call embed for use in typing indicator.
 * Shows a compact version of the currently active tool.
 */
export const MiniToolEmbed = memo(function MiniToolEmbed({
  tool,
  params,
}: {
  tool: string
  params?: Record<string, unknown>
}) {
  const ToolIcon = getToolIcon(tool)
  const argsSummary = formatArgsSummary(params)

  return (
    <div className="overflow-hidden rounded border-l-[3px] border-l-primary bg-muted/10">
      <div className="flex items-center gap-2 px-2 py-1">
        <ToolIcon size={12} className="shrink-0 text-primary" />
        <span className="font-mono text-[11px] font-medium text-foreground/80">{tool}</span>
        {argsSummary && (
          <span className="truncate font-mono text-[10px] text-muted-foreground/50">
            {argsSummary}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1 text-[10px] text-primary/60">
          <SpinnerGapIcon size={10} className="animate-spin" />
          running
        </span>
      </div>
    </div>
  )
})
