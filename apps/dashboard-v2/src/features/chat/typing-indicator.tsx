import { useCallback, memo } from "react"
import { cn } from "@/lib/utils"
import { EyeIcon } from "@phosphor-icons/react"
import { MiniToolEmbed, stringToColor } from "./streaming-message"

interface TypingIndicatorProps {
  /** Agents currently typing/working. */
  agents: Array<{ agentId: string; sessionId: string }>
  /** Human users currently typing in this channel. */
  users?: Array<{ userId: string; channelId: string }>
  /** Currently active tool call to display as a mini embed. */
  activeToolCall?: { tool: string; params?: Record<string, unknown> } | null
  /** Callback when "Watch live" is clicked (passes sessionId). */
  onWatchLive?: (sessionId: string) => void
  compact?: boolean
}

/** Animated dots component used for both agent and user typing. */
function AnimatedDots() {
  return (
    <span className="ml-0.5 inline-flex gap-[2px] align-baseline">
      <span
        className="animate-bounce-dot inline-block size-[3px] rounded-full bg-muted-foreground/50"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="animate-bounce-dot inline-block size-[3px] rounded-full bg-muted-foreground/50"
        style={{ animationDelay: "150ms" }}
      />
      <span
        className="animate-bounce-dot inline-block size-[3px] rounded-full bg-muted-foreground/50"
        style={{ animationDelay: "300ms" }}
      />
    </span>
  )
}

/**
 * Builds a combined label from agents working and users typing.
 *
 * Examples:
 *  - "developer is working..."
 *  - "John is typing..."
 *  - "developer is working, John is typing..."
 *  - "developer, John, and 2 others..."
 */
function buildLabel(
  agentNames: string[],
  userNames: string[],
): string {
  const totalCount = agentNames.length + userNames.length

  // Simple cases: only agents or only users
  if (userNames.length === 0) {
    if (agentNames.length === 1) return `${agentNames[0]} is working`
    if (agentNames.length === 2) return `${agentNames[0]} and ${agentNames[1]} are working`
    return `${agentNames[0]} and ${agentNames.length - 1} others are working`
  }

  if (agentNames.length === 0) {
    if (userNames.length === 1) return `${userNames[0]} is typing`
    if (userNames.length === 2) return `${userNames[0]} and ${userNames[1]} are typing`
    return `${userNames[0]} and ${userNames.length - 1} others are typing`
  }

  // Mixed: both agents and users
  if (totalCount === 2) {
    return `${agentNames[0]} is working, ${userNames[0]} is typing`
  }

  // 3+: combine all names
  const allNames = [...agentNames, ...userNames]
  const othersCount = allNames.length - 1
  return `${allNames[0]}, ${allNames[1]}, and ${othersCount > 1 ? `${othersCount - 1} others` : allNames[2]}`
}

/**
 * D17: Shows typing indicator in channel view for both agents working
 * and human users typing, with avatar, animated dots, optional active
 * tool embed, and "Watch live" link for agents.
 */
export const TypingIndicator = memo(function TypingIndicator({
  agents,
  users = [],
  activeToolCall,
  onWatchLive,
  compact = false,
}: TypingIndicatorProps) {
  const sessionId = agents[0]?.sessionId
  const handleWatchLive = useCallback(() => {
    if (sessionId) onWatchLive?.(sessionId)
  }, [onWatchLive, sessionId])

  if (agents.length === 0 && users.length === 0) return null

  const agentNames = agents.map((a) => a.agentId)
  const userNames = users.map((u) => u.userId)
  const label = buildLabel(agentNames, userNames)

  // Primary entity for avatar (prefer agent, fall back to user)
  const primaryId = agents[0]?.agentId ?? users[0]?.userId ?? "?"
  const avatarColor = stringToColor(primaryId)
  const initial = primaryId.charAt(0).toUpperCase()

  const showWatchLive = agents.length === 1 && users.length === 0 && !!onWatchLive

  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-1.5",
        compact && "gap-2 px-3 py-1",
      )}
    >
      {/* Mini avatar */}
      <div className={cn("w-10 shrink-0 pt-0.5", compact && "w-7")}>
        <div
          className={cn(
            "flex items-center justify-center rounded-full font-heading text-[9px] font-bold",
            compact ? "size-5" : "size-6",
            avatarColor,
          )}
          title={primaryId}
        >
          {initial}
        </div>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 space-y-1">
        {/* Label with animated dots and watch live */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">
            {label}
            <AnimatedDots />
          </span>

          {/* Watch live link (only for single agent) */}
          {showWatchLive && (
            <button
              type="button"
              onClick={handleWatchLive}
              className="flex items-center gap-1 text-[11px] text-primary/70 hover:text-primary"
            >
              <EyeIcon size={12} />
              Watch live
            </button>
          )}
        </div>

        {/* Mini tool embed for currently active tool */}
        {activeToolCall && (
          <MiniToolEmbed tool={activeToolCall.tool} params={activeToolCall.params} />
        )}
      </div>
    </div>
  )
})
