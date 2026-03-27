import { motion } from "framer-motion"
import {
  PencilSimpleIcon,
  TerminalIcon,
  ChatCircleIcon,
  PushPinIcon,
  GitBranchIcon,
  EyeIcon,
  RocketIcon,
  FileIcon,
  MagnifyingGlassIcon,
  LightningIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowsClockwiseIcon,
} from "@phosphor-icons/react"
import { ResourceLinker } from "@/components/resource-linker"
import type { Icon } from "@phosphor-icons/react"

interface ActivityEntry {
  at: string
  agent: string
  type: string
  summary: string
  details?: Record<string, unknown>
}

const ACTION_ICONS: Record<string, Icon> = {
  write_file: PencilSimpleIcon,
  run_terminal: TerminalIcon,
  send_message: ChatCircleIcon,
  pin_to_board: PushPinIcon,
  create_branch: GitBranchIcon,
  review_code: EyeIcon,
  deploy: RocketIcon,
  read_file: FileIcon,
  search: MagnifyingGlassIcon,
  execute: LightningIcon,
  approve: CheckCircleIcon,
  reject: XCircleIcon,
  update: ArrowsClockwiseIcon,
}

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}

export function ActivityItemRow({
  entry,
  showDate = false,
}: {
  entry: ActivityEntry
  showDate?: boolean
}) {
  const ActionIcon = ACTION_ICONS[entry.type] ?? LightningIcon

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-muted/20"
    >
      {/* Timestamp */}
      <div className="flex shrink-0 flex-col items-end">
        <span className="font-heading text-[10px] text-muted-foreground tabular-nums">
          {formatTimestamp(entry.at)}
        </span>
        {showDate && (
          <span className="font-heading text-[10px] text-muted-foreground/60 tabular-nums">
            {formatDate(entry.at)}
          </span>
        )}
      </div>

      {/* Agent avatar placeholder */}
      <div className="flex h-6 w-6 shrink-0 items-center justify-center bg-muted">
        <span className="font-heading text-[10px] uppercase text-muted-foreground">
          {entry.agent.charAt(0)}
        </span>
      </div>

      {/* Action icon */}
      <ActionIcon size={14} className="mt-0.5 shrink-0 text-muted-foreground" />

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-baseline gap-2">
          <span className="font-heading text-xs font-medium text-foreground">
            {entry.agent}
          </span>
          <span className="font-heading text-xs text-muted-foreground">
            {entry.type.replace(/_/g, " ")}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          <ResourceLinker text={entry.summary} />
        </div>
      </div>
    </motion.div>
  )
}
