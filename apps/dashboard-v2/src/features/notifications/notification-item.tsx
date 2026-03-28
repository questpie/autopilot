import { m } from "framer-motion"
import {
  CheckCircleIcon,
  WarningIcon,
  ChatDotsIcon,
  BellSimpleIcon,
  ShieldCheckIcon,
  ClockIcon,
  XIcon,
} from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { useNavigate } from "@tanstack/react-router"
import { cn } from "@/lib/utils"
import { SPRING, DURATION, EASING, useMotionPreference } from "@/lib/motion"
import { useMarkRead, useDismissNotification } from "./notification.queries"
import type { Icon } from "@phosphor-icons/react"

interface Notification {
  id: string
  type: string
  priority: string
  title: string
  message: string | null
  url: string | null
  task_id: string | null
  agent_id: string | null
  read_at: number | null
  created_at: number
}

const TYPE_ICONS: Record<string, Icon> = {
  approval_needed: ShieldCheckIcon,
  blocker: WarningIcon,
  task_completed: CheckCircleIcon,
  alert: WarningIcon,
  mention: ChatDotsIcon,
  direct_message: ChatDotsIcon,
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "border-l-destructive",
  high: "border-l-amber-500",
  normal: "border-l-transparent",
  low: "border-l-transparent",
}

function formatTimeAgo(ts: number): string {
  const diffMs = Date.now() - ts
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin}m`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d`
}

export function NotificationItem({
  notification,
  onClose,
}: {
  notification: Notification
  onClose?: () => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { shouldReduce } = useMotionPreference()
  const markRead = useMarkRead()
  const dismiss = useDismissNotification()

  const isUnread = !notification.read_at
  const TypeIcon = TYPE_ICONS[notification.type] ?? BellSimpleIcon

  function handleClick() {
    if (isUnread) {
      markRead.mutate(notification.id)
    }
    if (notification.url) {
      void navigate({ to: notification.url })
    }
    onClose?.()
  }

  function handleDismiss(e: React.MouseEvent) {
    e.stopPropagation()
    dismiss.mutate(notification.id)
  }

  return (
    <m.button
      type="button"
      layout
      initial={shouldReduce ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={shouldReduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
      transition={{ duration: DURATION.fast, ease: EASING.enter, layout: SPRING.snappy }}
      onClick={handleClick}
      className={cn(
        "flex w-full items-start gap-2.5 border-l-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/50",
        PRIORITY_COLORS[notification.priority] ?? "border-l-transparent",
        isUnread ? "bg-primary/5" : "bg-transparent",
      )}
    >
      <div className={cn(
        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center",
        isUnread ? "text-primary" : "text-muted-foreground",
      )}>
        <TypeIcon size={14} aria-hidden="true" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          {isUnread && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          )}
          <span className="truncate font-heading text-xs font-medium text-foreground">
            {notification.title}
          </span>
        </div>
        {notification.message && (
          <p className="truncate text-[11px] text-muted-foreground">
            {notification.message}
          </p>
        )}
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <ClockIcon size={10} />
          {formatTimeAgo(notification.created_at)}
        </span>
      </div>

      <button
        type="button"
        onClick={handleDismiss}
        className="mt-0.5 shrink-0 p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 [.group:hover_&]:opacity-100"
        style={{ opacity: undefined }}
        aria-label={t("notifications.dismiss")}
      >
        <XIcon size={12} />
      </button>
    </m.button>
  )
}

export type { Notification }
