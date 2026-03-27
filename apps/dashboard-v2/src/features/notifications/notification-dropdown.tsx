import { useQuery } from "@tanstack/react-query"
import { AnimatePresence } from "framer-motion"
import { CheckIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useTranslation } from "@/lib/i18n"
import { notificationsQuery, useMarkAllRead } from "./notification.queries"
import { NotificationItem } from "./notification-item"
import type { Notification } from "./notification-item"

function groupByDay(items: Notification[]): Map<string, Notification[]> {
  const groups = new Map<string, Notification[]>()
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  for (const item of items) {
    const date = new Date(item.created_at)
    let key: string
    if (date.toDateString() === today.toDateString()) {
      key = "today"
    } else if (date.toDateString() === yesterday.toDateString()) {
      key = "yesterday"
    } else {
      key = date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    }
    const group = groups.get(key) ?? []
    group.push(item)
    groups.set(key, group)
  }
  return groups
}

export function NotificationDropdown({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const { data: notifications = [] } = useQuery(notificationsQuery({ limit: 50 }))
  const markAllRead = useMarkAllRead()

  const grouped = groupByDay(notifications as Notification[])
  const hasUnread = (notifications as Notification[]).some((n) => !n.read_at)

  return (
    <div className="flex w-[360px] flex-col border border-border bg-background shadow-lg sm:w-[420px]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <h3 className="font-heading text-sm font-semibold text-foreground">
          {t("notifications.title")}
        </h3>
        {hasUnread && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-[10px]"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            <CheckIcon size={12} aria-hidden="true" />
            {t("notifications.mark_all_read")}
          </Button>
        )}
      </div>

      {/* List */}
      <ScrollArea className="max-h-[400px]">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 py-8">
            <p className="font-heading text-sm text-muted-foreground">
              {t("notifications.empty")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("notifications.empty_description")}
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            <AnimatePresence mode="popLayout" initial={false}>
              {Array.from(grouped.entries()).map(([label, items]) => (
                <div key={label}>
                  <div className="px-3 py-1.5">
                    <span className="font-heading text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {label === "today"
                        ? t("time.today")
                        : label === "yesterday"
                          ? t("time.yesterday")
                          : label}
                    </span>
                  </div>
                  {items.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onClose={onClose}
                    />
                  ))}
                </div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
