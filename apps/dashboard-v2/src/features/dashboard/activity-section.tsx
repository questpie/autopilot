import { useSuspenseQuery } from "@tanstack/react-query"
import { AnimatePresence, m } from "framer-motion"
import { ArrowRightIcon } from "@phosphor-icons/react"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "@/lib/i18n"
import { activityQuery } from "@/features/dashboard/dashboard.queries"

interface ActivityEntry {
  at: string
  agent: string
  type: string
  summary: string
  details?: Record<string, unknown>
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

function ActivityItem({ entry }: { entry: ActivityEntry }) {
  return (
    <m.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-b-0 hover:bg-muted/20"
    >
      <span className="shrink-0 font-heading text-[10px] text-muted-foreground tabular-nums">
        {formatTime(entry.at)}
      </span>
      <span className="shrink-0 font-heading text-xs font-medium text-foreground">
        {entry.agent}
      </span>
      <span className="font-heading text-xs text-muted-foreground">
        {entry.type}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
        {entry.summary}
      </span>
    </m.div>
  )
}

export function ActivitySection() {
  const { t } = useTranslation()
  const { data } = useSuspenseQuery(activityQuery({ limit: 10 }))

  const entries = (data ?? []) as ActivityEntry[]

  // Hide section when no activity — no empty state on dashboard
  if (entries.length === 0) return null

  return (
    <section className="flex flex-col">
      <div className="flex items-center justify-between px-1 pb-3">
        <h2 className="font-heading text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {t("dashboard.recent_activity")}
        </h2>
        <Link
          to="/activity"
          className="flex items-center gap-1 font-heading text-[10px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {t("dashboard.view_all")}
          <ArrowRightIcon size={10} />
        </Link>
      </div>

      {(
        <div className="border border-border">
          <AnimatePresence mode="popLayout">
            {entries.map((entry, i) => (
              <ActivityItem key={`${entry.at}-${entry.agent}-${i}`} entry={entry} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  )
}
