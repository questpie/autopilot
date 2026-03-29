import { createElement, memo, useState, useCallback } from "react"
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
export function formatArgsSummary(params?: Record<string, unknown>): string {
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

// ---------------------------------------------------------------------------
// Style maps
// ---------------------------------------------------------------------------

export interface ToolEmbedProps {
  tool: string
  status: "running" | "completed" | "error"
  params?: Record<string, unknown>
  content?: string
  onRetry?: () => void
}

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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

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

/** Renders the appropriate icon for a tool embed without creating a component during render. */
function ToolIconDisplay({ tool, status }: { tool: string; status: ToolEmbedProps["status"] }) {
  const Icon = status === "error" ? XCircleIcon : getToolIcon(tool)
  return createElement(Icon, {
    size: 14,
    weight: status === "error" ? "fill" : "regular",
    className: cn("shrink-0", ICON_COLORS[status]),
  })
}

// ---------------------------------------------------------------------------
// ToolEmbed
// ---------------------------------------------------------------------------

/** Discord-style tool call embed with colored left border, status badge, and collapsible body. */
export const ToolEmbed = memo(function ToolEmbed({ tool, status, params, content, onRetry }: ToolEmbedProps) {
  const [expanded, setExpanded] = useState(false)

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
        <ToolIconDisplay tool={tool} status={status} />
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

// ---------------------------------------------------------------------------
// MiniToolEmbed
// ---------------------------------------------------------------------------

/** Renders the appropriate icon for a mini tool embed. */
function MiniToolIconDisplay({ tool }: { tool: string }) {
  const Icon = getToolIcon(tool)
  return createElement(Icon, { size: 12, className: "shrink-0 text-primary" })
}

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
  const argsSummary = formatArgsSummary(params)

  return (
    <div className="overflow-hidden rounded border-l-[3px] border-l-primary bg-muted/10">
      <div className="flex items-center gap-2 px-2 py-1">
        <MiniToolIconDisplay tool={tool} />
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
