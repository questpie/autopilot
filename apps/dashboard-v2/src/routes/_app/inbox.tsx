import { createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useState } from "react"
import { AnimatePresence, m } from "framer-motion"
import {
  TrayIcon,
  FunnelIcon,
  CaretDownIcon,
  CheckCircleIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/feedback/empty-state"
import { useTranslation } from "@/lib/i18n"
import { inboxQuery } from "@/features/inbox/inbox.queries"
import { TaskInboxCard, PinInboxCard } from "@/features/inbox/inbox-card"
import { PageTransition } from "@/components/layouts/page-transition"
import type { Task, Pin } from "@/features/inbox/inbox-card"

export const Route = createFileRoute("/_app/inbox")({
  component: InboxPage,
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(inboxQuery)
  },
})

type FilterType = "all" | "merge" | "approve" | "deploy" | "review"

function InboxPage() {
  const { t } = useTranslation()
  const { data } = useSuspenseQuery(inboxQuery)
  const [filter, setFilter] = useState<FilterType>("all")
  const [resolvedOpen, setResolvedOpen] = useState(false)

  const inbox = data ?? { tasks: [], pins: [] }
  const tasks = inbox.tasks as Task[]
  const pins = inbox.pins as Pin[]

  // Filter tasks by type
  const filteredTasks = filter === "all"
    ? tasks
    : tasks.filter((task) => {
        if (filter === "review") return task.status === "review"
        if (filter === "approve") return task.status === "review"
        return task.type === filter || task.workflow_step === filter
      })

  const totalCount = tasks.length + pins.length
  const filterOptions: FilterType[] = ["all", "merge", "approve", "deploy", "review"]

  return (
    <PageTransition className="flex flex-1 flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-2xl font-semibold">
            {t("inbox.title")}
          </h1>
          {totalCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {totalCount}
            </Badge>
          )}
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-1.5">
          <FunnelIcon size={14} className="text-muted-foreground" />
          {filterOptions.map((opt) => (
            <Button
              key={opt}
              variant={filter === opt ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter(opt)}
              className="h-7 px-2 text-xs capitalize"
            >
              {opt === "all" ? t("inbox.filter_all") : opt}
            </Button>
          ))}
        </div>
      </div>

      {/* Active items */}
      {totalCount === 0 ? (
        <EmptyState
          icon={<TrayIcon size={32} />}
          message={t("inbox.no_items")}
          description={t("inbox.no_items_description")}
        />
      ) : (
        <div className="flex flex-col gap-2">
          <AnimatePresence mode="popLayout">
            {filteredTasks.map((task) => (
              <TaskInboxCard key={task.id} task={task} />
            ))}
            {filter === "all" &&
              pins.map((pin) => (
                <PinInboxCard key={pin.id} pin={pin} />
              ))}
          </AnimatePresence>
        </div>
      )}

      {/* Resolved section (collapsed) */}
      <div className="flex flex-col">
        <button
          type="button"
          onClick={() => setResolvedOpen(!resolvedOpen)}
          className="flex items-center gap-2 py-2 font-heading text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <CaretDownIcon
            size={12}
            className={`transition-transform ${resolvedOpen ? "" : "-rotate-90"}`}
          />
          {t("inbox.resolved")}
        </button>
        {resolvedOpen && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <EmptyState
              icon={<CheckCircleIcon size={24} />}
              message={t("inbox.no_resolved")}
              className="py-6"
            />
          </m.div>
        )}
      </div>
    </PageTransition>
  )
}
