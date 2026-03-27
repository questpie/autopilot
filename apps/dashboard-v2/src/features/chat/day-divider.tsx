import { useTranslation } from "@/lib/i18n"

interface DayDividerProps {
  date: Date
}

function formatDayLabel(date: Date, t: (key: string) => string): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diff = today.getTime() - target.getTime()
  const dayMs = 86400000

  if (diff < dayMs) return t("chat.today")
  if (diff < dayMs * 2) return t("chat.yesterday")

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  })
}

export function DayDivider({ date }: DayDividerProps) {
  const { t } = useTranslation()
  const label = formatDayLabel(date, t)

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="h-px flex-1 bg-border" />
      <span className="shrink-0 font-heading text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
}
