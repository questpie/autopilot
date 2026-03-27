import { ClockIcon } from "@phosphor-icons/react"
import { useTranslation, t } from "@/lib/i18n"

interface HistoryEntry {
  at: string
  by: string
  action: string
  note?: string
  from?: string
  to?: string
  step?: string
  from_step?: string
  to_step?: string
}

interface TaskActivityTimelineProps {
  history: HistoryEntry[]
}

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffDays === 0) return t("time.today")
  if (diffDays === 1) return t("time.yesterday")
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

function describeAction(entry: HistoryEntry): string {
  if (entry.action === "created") return "created this task"
  if (entry.action === "assigned")
    return `assigned to ${entry.to ?? "someone"}`
  if (entry.action === "updated") return entry.note ?? "updated"
  if (entry.action === "status_changed")
    return `moved from ${entry.from ?? "?"} to ${entry.to ?? "?"}`
  if (entry.action === "workflow_advanced")
    return `workflow advanced to ${entry.to_step ?? entry.step ?? "?"}`
  if (entry.action === "approved") return "approved"
  if (entry.action === "rejected")
    return `rejected${entry.note ? `: ${entry.note}` : ""}`
  if (entry.action === "commented") return entry.note ?? "commented"
  return entry.note ?? entry.action
}

export function TaskActivityTimeline({ history }: TaskActivityTimelineProps) {
  const { t } = useTranslation()

  if (history.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-muted-foreground">
        {t("tasks.no_activity")}
      </p>
    )
  }

  // Group by date
  const grouped = new Map<string, HistoryEntry[]>()
  for (const entry of [...history].reverse()) {
    const dateKey = formatDate(entry.at)
    const group = grouped.get(dateKey) ?? []
    group.push(entry)
    grouped.set(dateKey, group)
  }

  return (
    <div className="flex flex-col gap-4">
      {Array.from(grouped.entries()).map(([dateLabel, entries]) => (
        <div key={dateLabel} className="flex flex-col gap-1">
          <span className="font-heading text-[10px] text-muted-foreground/60 uppercase">
            {dateLabel}
          </span>
          {entries.map((entry, idx) => (
            <div
              key={`${entry.at}-${idx}`}
              className="flex items-start gap-2.5 py-1"
            >
              <span className="flex shrink-0 items-center gap-1 pt-0.5 font-heading text-[11px] text-muted-foreground/60">
                <ClockIcon size={10} />
                {formatTimestamp(entry.at)}
              </span>
              <span className="font-heading text-xs text-primary/80">
                {entry.by}
              </span>
              <span className="min-w-0 flex-1 text-xs text-muted-foreground">
                {describeAction(entry)}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
