import { useQuery } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import {
  WarningIcon,
  XCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/feedback/empty-state"
import { useTranslation } from "@/lib/i18n"
import { pinsQuery, inboxQuery } from "@/features/dashboard/dashboard.queries"
import { useApproveTask, useRejectTask } from "@/features/inbox/inbox.mutations"
import { AlertsSkeleton } from "./dashboard-skeleton"
import { cn } from "@/lib/utils"

interface AlertItem {
  id: string
  type: "warning" | "error" | "task"
  title: string
  agent: string
  time: string
  taskId?: string
  actions?: Array<{ label: string; action: string }>
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

function AlertIcon({ type }: { type: AlertItem["type"] }) {
  switch (type) {
    case "error":
      return <XCircleIcon size={18} weight="fill" className="text-destructive" />
    case "warning":
      return <WarningIcon size={18} weight="fill" className="text-amber-500" />
    case "task":
      return <ShieldCheckIcon size={18} className="text-primary" />
  }
}

function AlertItemCard({ item }: { item: AlertItem }) {
  const { t } = useTranslation()
  const approveMutation = useApproveTask()
  const rejectMutation = useRejectTask()

  const isLoading = approveMutation.isPending || rejectMutation.isPending

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, height: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-start gap-3 border-b border-border p-3 last:border-b-0"
    >
      <div className="mt-0.5 shrink-0">
        <AlertIcon type={item.type} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-heading text-sm font-medium text-foreground">
          {item.title}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-heading">{item.agent}</span>
          <span className="flex items-center gap-1">
            <ClockIcon size={12} />
            {formatTimeAgo(item.time)}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {item.taskId && (
          <>
            <Button
              variant="default"
              size="sm"
              disabled={isLoading}
              onClick={() => approveMutation.mutate(item.taskId!)}
              className="h-7 px-2.5 text-xs"
            >
              <CheckCircleIcon size={14} />
              {t("inbox.approve")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={() =>
                rejectMutation.mutate({ taskId: item.taskId! })
              }
              className="h-7 px-2.5 text-xs"
            >
              {t("inbox.reject")}
            </Button>
          </>
        )}
        {item.actions?.map((action) => (
          <Button
            key={action.action}
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-xs"
          >
            {action.label}
          </Button>
        ))}
      </div>
    </motion.div>
  )
}

export function AlertsSection() {
  const { t } = useTranslation()
  const pinsResult = useQuery(pinsQuery)
  const inboxResult = useQuery(inboxQuery)

  const isLoading = pinsResult.isLoading || inboxResult.isLoading

  if (isLoading) {
    return <AlertsSkeleton />
  }

  const pins = pinsResult.data ?? []
  const inbox = inboxResult.data ?? { tasks: [], pins: [] }

  // Build alert items from warning/error pins with actions
  const pinAlerts: AlertItem[] = pins
    .filter(
      (pin) =>
        (pin.type === "warning" || pin.type === "error") &&
        pin.metadata?.actions &&
        pin.metadata.actions.length > 0,
    )
    .map((pin) => ({
      id: pin.id,
      type: pin.type as "warning" | "error",
      title: pin.title,
      agent: pin.created_by,
      time: pin.created_at,
      actions: pin.metadata?.actions,
    }))

  // Build alert items from inbox tasks (human gates)
  const taskAlerts: AlertItem[] = inbox.tasks.map((task) => ({
    id: task.id,
    type: "task" as const,
    title: task.title,
    agent: task.assigned_to ?? task.created_by,
    time: task.updated_at,
    taskId: task.id,
  }))

  // Combine and sort: errors first, then warnings, then tasks, then by time
  const alerts = [...pinAlerts, ...taskAlerts].sort((a, b) => {
    const typeOrder = { error: 0, warning: 1, task: 2 }
    const aOrder = typeOrder[a.type]
    const bOrder = typeOrder[b.type]
    if (aOrder !== bOrder) return aOrder - bOrder
    return new Date(b.time).getTime() - new Date(a.time).getTime()
  })

  return (
    <section className="flex flex-col">
      <div className="flex items-center justify-between px-1 pb-3">
        <h2 className="font-heading text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {t("dashboard.needs_attention")}
        </h2>
        {alerts.length > 0 && (
          <span className="font-heading text-xs text-muted-foreground">
            {alerts.length}
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <EmptyState
          icon={<CheckCircleIcon size={28} />}
          message={t("dashboard.all_clear")}
          description={t("dashboard.all_clear_description")}
          className="border border-border py-8"
        />
      ) : (
        <div className={cn("border border-border")}>
          <AnimatePresence mode="popLayout">
            {alerts.map((item) => (
              <AlertItemCard key={item.id} item={item} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  )
}
