import { ArrowClockwiseIcon, HouseIcon, WarningIcon } from "@phosphor-icons/react"
import { Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/lib/i18n"

interface PageErrorProps {
  title?: string
  description?: string
  onRetry?: () => void
}

/**
 * Full-page error component for 500/connection errors.
 * Shows warning icon, error message, retry button, and go-to-dashboard link.
 */
export function PageError({ title, description, onRetry }: PageErrorProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <WarningIcon size={48} className="text-destructive" />
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-semibold">
          {title ?? t("common.server_error")}
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {description ?? t("common.server_error_description")}
        </p>
      </div>
      <div className="flex gap-2">
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            <ArrowClockwiseIcon size={16} />
            {t("common.retry")}
          </Button>
        )}
        <Button variant="ghost" render={<Link to="/" />}>
            <HouseIcon size={16} />
            {t("common.go_to_dashboard")}
        </Button>
      </div>
    </div>
  )
}
