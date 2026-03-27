import { WarningIcon, ArrowClockwiseIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/lib/i18n"

interface WidgetErrorCardProps {
  name: string
  error?: string
  onRetry: () => void
}

export function WidgetErrorCard({ name, error, onRetry }: WidgetErrorCardProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center justify-center gap-3 border border-destructive/20 bg-destructive/5 p-6 text-center">
      <WarningIcon size={24} className="text-destructive" />
      <div className="flex flex-col gap-1">
        <p className="font-heading text-sm font-medium text-foreground">
          {t("dashboard.widget_error", { name })}
        </p>
        {error && (
          <p className="max-w-xs text-xs text-muted-foreground">{error}</p>
        )}
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <ArrowClockwiseIcon size={14} />
        {t("common.retry")}
      </Button>
    </div>
  )
}
