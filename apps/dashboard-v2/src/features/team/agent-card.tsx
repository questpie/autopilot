import { CircleIcon } from "@phosphor-icons/react"
import { m } from "framer-motion"
import { Link } from "@tanstack/react-router"
import { Badge } from "@/components/ui/badge"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { EASING, DURATION, clampedDelay, useMotionPreference } from "@/lib/motion"

/**
 * Deterministic color from any string (role, agent ID, etc.).
 * Uses a simple hash to pick from a palette — no hardcoded role→color mapping.
 */
const AVATAR_PALETTE = [
  "bg-purple-600",
  "bg-blue-600",
  "bg-cyan-600",
  "bg-emerald-600",
  "bg-amber-600",
  "bg-red-600",
  "bg-pink-600",
  "bg-violet-600",
  "bg-teal-600",
  "bg-orange-600",
  "bg-indigo-600",
  "bg-rose-600",
]

function hashStringToIndex(str: string, length: number): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % length
}

function getAvatarColor(identifier: string): string {
  return AVATAR_PALETTE[hashStringToIndex(identifier, AVATAR_PALETTE.length)]
}

interface AgentCardProps {
  agent: {
    id: string
    name: string
    role: string
    description: string
  }
  isWorking?: boolean
  taskCount?: number
  index?: number
}

export function AgentCard({ agent, isWorking = false, taskCount = 0, index = 0 }: AgentCardProps) {
  const { t } = useTranslation()
  const { shouldReduce } = useMotionPreference()
  const bgColor = getAvatarColor(agent.id)
  const initial = agent.name.charAt(0).toUpperCase()

  return (
    <m.div
      initial={shouldReduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: DURATION.normal,
        ease: EASING.enter,
        delay: shouldReduce ? 0 : clampedDelay(index, 50, 300),
      }}
    >
      <Link
        to="/team/$id"
        params={{ id: agent.id }}
        className="group flex flex-col items-center gap-2 border border-border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:bg-muted/30 hover:shadow-sm"
      >
        {/* Square avatar */}
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center text-lg font-bold text-white",
            bgColor,
          )}
        >
          {initial}
        </div>

        {/* Name */}
        <span className="font-heading text-sm font-medium text-foreground group-hover:text-primary">
          {agent.name}
        </span>

        {/* Role badge */}
        <Badge variant="secondary" className="text-[10px]">
          {agent.role}
        </Badge>

        {/* Status */}
        <div className="flex items-center gap-1.5">
          <CircleIcon
            size={8}
            weight={isWorking ? "fill" : "regular"}
            className={cn(
              isWorking ? "text-green-500" : "text-muted-foreground",
              isWorking && "animate-status-pulse motion-reduce:animate-none",
            )}
            aria-hidden="true"
          />
          <span className="text-[10px] text-muted-foreground">
            {isWorking ? t("team.status_working") : t("team.status_idle")}
          </span>
        </div>

        {/* Task count */}
        <span className="font-heading text-[10px] text-muted-foreground">
          {t("team.tasks_count", { count: taskCount })}
        </span>
      </Link>
    </m.div>
  )
}

export { AVATAR_PALETTE, getAvatarColor, hashStringToIndex }
