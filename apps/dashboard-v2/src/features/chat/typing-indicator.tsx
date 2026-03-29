import { cn } from "@/lib/utils"
import { EyeIcon } from "@phosphor-icons/react"

interface TypingIndicatorProps {
  /** Agents currently typing. */
  agents: Array<{ agentId: string; sessionId: string }>
  /** Callback when "Watch live" is clicked (passes sessionId). */
  onWatchLive?: (sessionId: string) => void
  compact?: boolean
}

/**
 * D17: Shows "developer is working..." typing indicator in channel view,
 * with a "Watch live" link to expand inline session preview.
 */
export function TypingIndicator({ agents, onWatchLive, compact = false }: TypingIndicatorProps) {
  if (agents.length === 0) return null

  const names = agents.map((a) => a.agentId)
  const label =
    names.length === 1
      ? `${names[0]} is working...`
      : names.length === 2
        ? `${names[0]} and ${names[1]} are working...`
        : `${names[0]} and ${names.length - 1} others are working...`

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-1.5",
        compact && "px-3 py-1",
      )}
    >
      {/* Animated dots */}
      <span className="flex gap-0.5">
        <span className="size-1 animate-bounce rounded-full bg-primary/40" style={{ animationDelay: "0ms" }} />
        <span className="size-1 animate-bounce rounded-full bg-primary/40" style={{ animationDelay: "150ms" }} />
        <span className="size-1 animate-bounce rounded-full bg-primary/40" style={{ animationDelay: "300ms" }} />
      </span>

      <span className="text-[11px] text-muted-foreground">{label}</span>

      {/* Watch live link (only for single agent) */}
      {agents.length === 1 && onWatchLive && (
        <button
          type="button"
          onClick={() => onWatchLive(agents[0].sessionId)}
          className="flex items-center gap-1 text-[11px] text-primary/70 hover:text-primary"
        >
          <EyeIcon size={12} />
          Watch live
        </button>
      )}
    </div>
  )
}
