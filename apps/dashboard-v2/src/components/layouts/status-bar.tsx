import { useTranslation } from "@/lib/i18n"
import { ConnectionStatus } from "./connection-indicator"

/**
 * Status bar (24px) — desktop only.
 * Shows SSE connection status, agent count, SQLite size, git commits, version.
 */
export function StatusBar() {
  const { t } = useTranslation()

  return (
    <footer
      className="hidden h-6 shrink-0 items-center gap-4 border-t border-border bg-background px-4 font-heading text-[10px] text-muted-foreground lg:flex"
      role="status"
      aria-live="polite"
    >
      <ConnectionStatus />
      <span className="h-3 w-px bg-border" aria-hidden="true" />
      <span>{t("status_bar.agents")}: --</span>
      <span className="h-3 w-px bg-border" aria-hidden="true" />
      <span>{t("status_bar.sqlite_size")}: --</span>
      <span className="h-3 w-px bg-border" aria-hidden="true" />
      <span>{t("status_bar.git_commits")}: --</span>
      <span className="flex-1" />
      <span>{t("status_bar.version")}: {t("app.version")}</span>
    </footer>
  )
}
