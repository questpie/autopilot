import { motion } from "framer-motion"
import {
  CheckCircleIcon,
  XCircleIcon,
  GitMergeIcon,
  RocketIcon,
  ShieldCheckIcon,
  MegaphoneIcon,
  ClockIcon,
  WarningIcon,
  GearSixIcon,
  EyeIcon,
  FirstAidIcon,
} from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/lib/i18n"
import { useApproveTask, useRejectTask } from "./inbox.mutations"
import { useHaptic } from "@/hooks/use-haptic"
import type { Icon } from "@phosphor-icons/react"

interface Task {
  id: string
  title: string
  description: string
  type: string
  status: string
  assigned_to?: string
  created_by: string
  created_at: string
  updated_at: string
  workflow_step?: string
}

interface Pin {
  id: string
  title: string
  content: string
  type: string
  created_by: string
  created_at: string
  metadata: {
    actions?: Array<{ label: string; action: string }>
  }
}

type InboxItem =
  | { kind: "task"; data: Task }
  | { kind: "pin"; data: Pin }

const GATE_ICONS: Record<string, Icon> = {
  merge: GitMergeIcon,
  deploy: RocketIcon,
  publish: MegaphoneIcon,
  review: EyeIcon,
  setup: GearSixIcon,
  incident: FirstAidIcon,
  spend: WarningIcon,
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

function TaskInboxCard({ task }: { task: Task }) {
  const { t } = useTranslation()
  const { triggerHaptic } = useHaptic()
  const approveMutation = useApproveTask()
  const rejectMutation = useRejectTask()

  const isLoading = approveMutation.isPending || rejectMutation.isPending
  const gateType = task.type === "review" ? "review" : task.workflow_step ?? "review"
  const GateIcon = GATE_ICONS[gateType] ?? ShieldCheckIcon

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -40, height: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-start gap-3 border border-border p-4"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-primary/10">
        <GateIcon size={18} className="text-primary" aria-hidden="true" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            {gateType}
          </Badge>
          <Badge
            variant={task.status === "review" ? "default" : "destructive"}
            className="text-[10px]"
          >
            {task.status}
          </Badge>
        </div>
        <p className="font-heading text-sm font-medium text-foreground">
          {task.title}
        </p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="font-heading">
            {task.assigned_to ?? task.created_by}
          </span>
          <span className="flex items-center gap-1">
            <ClockIcon size={12} />
            {formatTimeAgo(task.updated_at)}
          </span>
        </div>
        {task.description && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
            {task.description}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          variant="default"
          size="sm"
          disabled={isLoading}
          onClick={() => {
            triggerHaptic()
            approveMutation.mutate(task.id)
          }}
        >
          <CheckCircleIcon size={14} aria-hidden="true" />
          {t("inbox.approve")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={isLoading}
          onClick={() => {
            triggerHaptic()
            rejectMutation.mutate({ taskId: task.id })
          }}
        >
          <XCircleIcon size={14} aria-hidden="true" />
          {t("inbox.reject")}
        </Button>
      </div>
    </motion.div>
  )
}

function PinInboxCard({ pin }: { pin: Pin }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -40, height: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-start gap-3 border border-border p-4"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-amber-500/10">
        <WarningIcon size={18} className="text-amber-500" aria-hidden="true" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="font-heading text-sm font-medium text-foreground">
          {pin.title}
        </p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="font-heading">{pin.created_by}</span>
          <span className="flex items-center gap-1">
            <ClockIcon size={12} />
            {formatTimeAgo(pin.created_at)}
          </span>
        </div>
        {pin.content && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
            {pin.content}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {pin.metadata?.actions?.map((action) => (
          <Button key={action.action} variant="outline" size="sm">
            {action.label}
          </Button>
        ))}
      </div>
    </motion.div>
  )
}

export { TaskInboxCard, PinInboxCard }
export type { Task, Pin, InboxItem }
