import { useMatches } from "@tanstack/react-router"
import { useTranslation } from "@/lib/i18n"
import { useAppStore } from "@/stores/app.store"
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet"
import { SquareBuildLogo } from "@/components/brand"
import { NavContent } from "./nav-content"

/**
 * Mobile sidebar overlay (<768px): opens as a sheet from the left.
 * Triggered by hamburger button in TopBar.
 */
export function MobileSideNav() {
  const { t } = useTranslation()
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen)
  const matches = useMatches()
  const currentPath = matches[matches.length - 1]?.pathname ?? "/"

  return (
    <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <SheetContent
        side="left"
        className="w-[260px] p-0 font-heading sm:max-w-[260px]"
        showCloseButton={false}
      >
        <SheetTitle className="sr-only">{t("nav.toggle_sidebar")}</SheetTitle>
        {/* Header */}
        <div className="flex h-12 items-center gap-2 border-b border-border px-3">
          <SquareBuildLogo size={18} />
        </div>

        <nav
          className="flex flex-1 flex-col overflow-y-auto"
          aria-label={t("a11y.main_navigation")}
        >
          <NavContent
            collapsed={false}
            currentPath={currentPath}
            onNavigate={() => setSidebarOpen(false)}
          />
        </nav>
      </SheetContent>
    </Sheet>
  )
}
