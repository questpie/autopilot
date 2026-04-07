import { CircleIcon, WifiHighIcon, WifiSlashIcon, ArrowsClockwiseIcon } from "@phosphor-icons/react"
import { m, AnimatePresence, useReducedMotion } from "framer-motion"
import { useTranslation } from "@/lib/i18n"
import { useAppStore } from "@/stores/app.store"

/**
 * Connection indicator dot shown in the top bar.
 * Green = connected, amber pulse = reconnecting, red = offline.
 */
export function ConnectionIndicatorDot() {
  const sseStatus = useAppStore((s) => s.sseStatus)

  const colorClass =
    sseStatus === "connected"
      ? "text-success"
      : sseStatus === "reconnecting"
        ? "text-warning animate-pulse motion-reduce:animate-none"
        : "text-destructive"

  return (
    <CircleIcon
      size={8}
      weight="fill"
      className={colorClass}
      aria-hidden="true"
    />
  )
}

/**
 * Full SSE connection status bar shown in the status bar.
 * Connected: green flash for 2s after reconnect.
 * Reconnecting: amber with animated dots.
 * Offline: red with retry button.
 */
export function ConnectionStatus({
  onRetry,
  retryCount,
}: {
  onRetry?: () => void
  retryCount?: number
}) {
  const { t } = useTranslation()
  const sseStatus = useAppStore((s) => s.sseStatus)
  const shouldReduce = useReducedMotion()

  return (
    <AnimatePresence mode="wait">
      {sseStatus === "connected" && (
        <m.span
          key="connected"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: shouldReduce ? 0 : 0.2 }}
          className="flex items-center gap-1.5 text-success"
        >
          <WifiHighIcon size={12} aria-hidden="true" />
          {t("status_bar.connected")}
        </m.span>
      )}

      {sseStatus === "reconnecting" && (
        <m.span
          key="reconnecting"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: shouldReduce ? 0 : 0.2 }}
          className="flex items-center gap-1.5 text-warning"
        >
          <ArrowsClockwiseIcon
            size={12}
            className="animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
          {t("status_bar.reconnecting")}
        </m.span>
      )}

      {sseStatus === "offline" && (
        <m.span
          key="offline"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: shouldReduce ? 0 : 0.2 }}
          className="flex items-center gap-1.5 text-destructive"
        >
          <WifiSlashIcon size={12} aria-hidden="true" />
          {t("status_bar.offline")}
          {onRetry && (retryCount ?? 0) >= 5 && (
            <button
              type="button"
              onClick={onRetry}
              className="ml-1 underline underline-offset-2 hover:text-destructive"
            >
              {t("common.retry")}
            </button>
          )}
        </m.span>
      )}
    </AnimatePresence>
  )
}
