import { Link, useMatches } from "@tanstack/react-router"
import {
  HouseIcon,
  ListChecksIcon,
  UsersIcon,
  FolderOpenIcon,
  PaintBrushIcon,
  ChatCircleIcon,
  ChartBarIcon,
  TrayIcon,
  Link as LinkIcon,
  GearIcon,
  BookOpenIcon,
  CaretDownIcon,
  SidebarIcon,
} from "@phosphor-icons/react"
import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { useTranslation } from "@/lib/i18n"
import { useAppStore } from "@/stores/app.store"
import { EASING, DURATION, useMotionPreference } from "@/lib/motion"
import { statusQuery } from "@/features/dashboard/dashboard.queries"
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet"
import { SquareBuildLogo } from "@/components/brand"
import type { Icon } from "@phosphor-icons/react"

interface NavItem {
  icon: Icon
  labelKey: string
  to: string
  badge?: number
  external?: boolean
}

const primaryItems: NavItem[] = [
  { icon: HouseIcon, labelKey: "nav.dashboard", to: "/" },
  { icon: ListChecksIcon, labelKey: "nav.tasks", to: "/tasks" },
  { icon: UsersIcon, labelKey: "nav.team", to: "/team" },
  { icon: FolderOpenIcon, labelKey: "nav.files", to: "/files" },
  { icon: PaintBrushIcon, labelKey: "nav.artifacts", to: "/artifacts" },
  { icon: ChatCircleIcon, labelKey: "nav.chat", to: "/chat" },
]

const secondaryItems: NavItem[] = [
  { icon: TrayIcon, labelKey: "nav.inbox", to: "/inbox" },
  { icon: ChartBarIcon, labelKey: "nav.activity", to: "/activity" },
  { icon: LinkIcon, labelKey: "nav.integrations", to: "/integrations" },
]

const bottomItems: NavItem[] = [
  { icon: GearIcon, labelKey: "nav.settings", to: "/settings" },
  {
    icon: BookOpenIcon,
    labelKey: "Docs",
    to: "https://autopilot.questpie.com/docs",
    external: true,
  },
]

function NavItemButton({
  item,
  isActive,
  collapsed,
  onNavigate,
}: {
  item: NavItem
  isActive: boolean
  collapsed: boolean
  onNavigate?: () => void
}) {
  const { t } = useTranslation()
  const Icon = item.icon
  const label = t(item.labelKey)

  const className = [
    "group relative flex items-center gap-3 px-3 py-2 text-sm font-heading transition-colors",
    isActive
      ? "border-l-2 border-primary text-foreground bg-primary/5"
      : "border-l-2 border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50",
    collapsed ? "justify-center px-0" : "",
  ].join(" ")

  if (item.external) {
    return (
      <a
        href={item.to}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        title={collapsed ? label : undefined}
        onClick={onNavigate}
      >
        <Icon size={20} weight={isActive ? "fill" : "regular"} />
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: DURATION.normal, ease: EASING.enter }}
              className="truncate overflow-hidden"
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </a>
    )
  }

  return (
    <Link
      to={item.to}
      className={className}
      title={collapsed ? label : undefined}
      onClick={onNavigate}
    >
      <Icon size={20} weight={isActive ? "fill" : "regular"} />
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: DURATION.normal, ease: EASING.enter }}
            className="truncate overflow-hidden"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
      {!collapsed && item.badge != null && item.badge > 0 && (
        <span className="ml-auto rounded-none bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
          {item.badge}
        </span>
      )}
    </Link>
  )
}

/** Shared nav content used by both desktop sidebar and mobile overlay */
function NavContent({
  collapsed,
  currentPath,
  onNavigate,
}: {
  collapsed: boolean
  currentPath: string
  onNavigate?: () => void
}) {
  const { t } = useTranslation()
  const [secondaryOpen, setSecondaryOpen] = useState(true)
  const { d } = useMotionPreference()

  function isActive(to: string): boolean {
    if (to === "/") return currentPath === "/"
    return currentPath.startsWith(to)
  }

  return (
    <>
      {/* Primary items */}
      <div className="flex flex-1 flex-col gap-0.5 py-2">
        {primaryItems.map((item) => (
          <NavItemButton
            key={item.to}
            item={item}
            isActive={isActive(item.to)}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}

        {/* Secondary section */}
        <AnimatePresence>
          {!collapsed && (
            <motion.button
              type="button"
              onClick={() => setSecondaryOpen(!secondaryOpen)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: d(DURATION.fast) }}
              className="mt-4 flex items-center gap-2 px-3 py-1 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              <CaretDownIcon
                size={10}
                className={`transition-transform ${secondaryOpen ? "" : "-rotate-90"}`}
              />
              {t("nav.more")}
            </motion.button>
          )}
        </AnimatePresence>
        {(collapsed || secondaryOpen) &&
          secondaryItems.map((item) => (
            <NavItemButton
              key={item.to}
              item={item}
              isActive={isActive(item.to)}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ))}
      </div>

      {/* Bottom items */}
      <div className="flex flex-col gap-0.5 border-t border-border py-2">
        {bottomItems.map((item) => (
          <NavItemButton
            key={item.to}
            item={item}
            isActive={isActive(item.to)}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </>
  )
}

/**
 * Desktop sidebar (>=1024px): always visible, collapsible to 56px icon rail.
 * Tablet (768-1023px): auto-collapsed to icon rail.
 * Mobile (<768px): hidden — uses MobileSideNav sheet overlay instead.
 */
function DesktopSideNav() {
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
    <motion.nav
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
            <motion.div
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
            </motion.div>
          )}
          {collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-1 items-center justify-center"
            >
              <SquareBuildLogo size={18} />
            </motion.div>
          )}
        </AnimatePresence>
        <motion.button
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
          <motion.div
            animate={{ rotate: collapsed ? 180 : 0 }}
            transition={{ duration: d(DURATION.normal), ease: EASING.move }}
          >
            <SidebarIcon size={16} weight="bold" aria-hidden="true" />
          </motion.div>
        </motion.button>
      </div>

      <NavContent collapsed={collapsed} currentPath={currentPath} />
    </motion.nav>
  )
}

/**
 * Mobile sidebar overlay (<768px): opens as a sheet from the left.
 * Triggered by hamburger button in TopBar.
 */
function MobileSideNav() {
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

/**
 * SideNav composite: renders both desktop sidebar and mobile sheet overlay.
 * Only one is visible at a time based on viewport.
 */
export function SideNav() {
  return (
    <>
      <DesktopSideNav />
      <MobileSideNav />
    </>
  )
}
