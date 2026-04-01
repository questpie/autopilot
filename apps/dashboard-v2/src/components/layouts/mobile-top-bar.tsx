import { ListIcon } from "@phosphor-icons/react"
import { useRouterState } from "@tanstack/react-router"
import { AccountMenu } from "./account-menu"
import { useTranslation } from "@/lib/i18n"
import { getActiveSection, getSectionLabelKey } from "@/lib/navigation"
import { useAppStore } from "@/stores/app.store"

export function MobileTopBar(): React.JSX.Element {
  const { t } = useTranslation()
  const toggleSidebar = useAppStore((state) => state.toggleSidebar)
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const activeSection = getActiveSection(pathname)
  const sectionTitle = t(getSectionLabelKey(activeSection))

  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border bg-background px-4 md:hidden">
      <button
        type="button"
        onClick={toggleSidebar}
        className="flex min-h-11 min-w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
        aria-label={t("nav.toggle_sidebar")}
      >
        <ListIcon size={20} weight="bold" aria-hidden="true" />
      </button>
      <span className="min-w-0 flex-1 truncate font-heading text-sm text-foreground">
        {sectionTitle}
      </span>
      <AccountMenu
        side="bottom"
        align="end"
        triggerClassName="flex min-h-11 min-w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
      />
    </header>
  )
}
