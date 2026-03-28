import { useEffect } from "react"
import { useMatches } from "@tanstack/react-router"
import { SidebarIcon } from "@phosphor-icons/react"
import { useQuery } from "@tanstack/react-query"
import { m, AnimatePresence } from "framer-motion"
import { useTranslation } from "@/lib/i18n"
import { useAppStore } from "@/stores/app.store"
import { EASING, DURATION, useMotionPreference } from "@/lib/motion"
import { statusQuery } from "@/features/dashboard/dashboard.queries"
import { SquareBuildLogo } from "@/components/brand"
import { NavContent } from "./nav-content"

/**
 * Desktop sidebar (>=1024px): always visible, collapsible to 56px icon rail.
 * Tablet (768-1023px): auto-collapsed to icon rail.
 * Mobile (<768px): hidden — uses MobileSideNav sheet overlay instead.
 */
export function DesktopSideNav() {
  const { t } = useTranslation()
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed)
  const toggleSidebarCollapsed = useAppStore((s) => s.toggleSidebarCollapsed)
  const matches = useMatches()
  const { d } = useMotionPreference()
  const { data: status } = useQuery(statusQuery)
  const companyName = (status as { company?: string })?.company

  const currentPath = matches[matches.length - 1]?.pathname ?? "/"

  // Auto-collapse to icon rail when on routes with secondary sidebars
  const hasSecondarySidebar =
    currentPath.startsWith("/files") || currentPath.startsWith("/settings")
  const collapsed = sidebarCollapsed || hasSecondarySidebar

  // Keyboard shortcut: Cmd+B to toggle sidebar
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault()
        toggleSidebarCollapsed()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [toggleSidebarCollapsed])

  return (
    <m.nav
      animate={{ width: collapsed ? 56 : 220 }}
      transition={{
        duration: d(DURATION.normal),
        ease: EASING.move,
      }}
      className="hidden shrink-0 flex-col border-r border-border bg-sidebar font-heading md:flex"
      aria-label={t("a11y.main_navigation")}
    >
      {/* Header: logo + company name + collapse toggle */}
      <div className="flex h-12 items-center border-b border-border px-2">
        <AnimatePresence>
          {!collapsed && (
            <m.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: d(DURATION.normal), ease: EASING.enter }}
              className="flex flex-1 items-center gap-2 overflow-hidden px-1"
            >
              <SquareBuildLogo size={18} />
              <span className="truncate text-xs font-semibold text-foreground">
                {companyName ?? t("app.name")}
              </span>
            </m.div>
          )}
          {collapsed && (
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-1 items-center justify-center"
            >
              <SquareBuildLogo size={18} />
            </m.div>
          )}
        </AnimatePresence>
        <m.button
          type="button"
          onClick={toggleSidebarCollapsed}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="flex h-7 w-7 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          aria-label={
            collapsed
              ? t("nav.expand_sidebar")
              : t("nav.collapse_sidebar")
          }
          title={`${collapsed ? t("nav.expand_sidebar") : t("nav.collapse_sidebar")} (${navigator.platform?.includes("Mac") ? "\u2318" : "Ctrl+"}B)`}
        >
          <m.div
            animate={{ rotate: collapsed ? 180 : 0 }}
            transition={{ duration: d(DURATION.normal), ease: EASING.move }}
          >
            <SidebarIcon size={16} weight="bold" aria-hidden="true" />
          </m.div>
        </m.button>
      </div>

      <NavContent collapsed={collapsed} currentPath={currentPath} />
    </m.nav>
  )
}
