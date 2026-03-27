import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import {
  ListIcon,
  MagnifyingGlassIcon,
  TrayIcon,
  GearIcon,
  UserIcon,
} from "@phosphor-icons/react"
import { motion } from "framer-motion"
import { useTranslation } from "@/lib/i18n"
import { useAppStore } from "@/stores/app.store"
import { useHapticPattern } from "@/hooks/use-haptic"
import { SquareBuildLogo } from "@/components/brand"
import { NotificationBell } from "@/features/notifications/notification-bell"
import { statusQuery } from "@/features/dashboard/dashboard.queries"

/** Hover/tap scale for icon buttons */
const iconMotion = {
  whileHover: { scale: 1.08 },
  whileTap: { scale: 0.92 },
  transition: { type: "spring" as const, stiffness: 400, damping: 25 },
}

export function TopBar() {
  const { t } = useTranslation()
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen)
  const { trigger } = useHapticPattern()
  const { data: status } = useQuery(statusQuery)
  const companyName = (status as { company?: string })?.company

  return (
    <header className="flex h-12 shrink-0 items-center border-b border-border bg-background px-4 font-heading">
      {/* Hamburger — visible on mobile only */}
      <motion.button
        type="button"
        onClick={toggleSidebar}
        {...iconMotion}
        className="mr-3 flex min-h-[44px] min-w-[44px] items-center justify-center md:hidden"
        aria-label={t("nav.toggle_sidebar")}
      >
        <ListIcon size={20} weight="bold" aria-hidden="true" />
      </motion.button>

      {/* Company name from API */}
      <Link
        to="/settings/general"
        className="mr-4 flex items-center gap-2 truncate text-sm font-semibold tracking-tight hover:text-primary"
      >
        <SquareBuildLogo size={20} />
        <span className="hidden sm:inline">{companyName ?? t("app.name")}</span>
      </Link>

      {/* Connection indicator dot, TODO: this is redundant */}
      {/* <ConnectionIndicatorDot /> */}

      <div className="flex-1" />

      {/* Search trigger */}
      <motion.button
        type="button"
        onClick={() => setCommandPaletteOpen(true)}
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="hidden mr-2 sm:flex min-w-[196px] h-8 items-center gap-2 rounded-none border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
        aria-label={t("common.search")}
      >
        <MagnifyingGlassIcon size={14} aria-hidden="true" />
        <span className="hidden flex-1 text-left sm:inline">{t("common.search")}</span>
        <kbd className="hidden  rounded-none border border-border px-1.5 py-0.5 text-[10px] sm:inline">
          {"\u2318"}K
        </kbd>
      </motion.button>

      <motion.button
        type="button"
        {...iconMotion}
        onClick={() => trigger("tap")}
        className="sm:hidden relative flex min-h-[44px] min-w-[44px] items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
        aria-label={t("common.search")}
      >
      <MagnifyingGlassIcon size={18} aria-hidden="true" />
      </motion.button>

      {/* Notifications */}
      <NotificationBell />

      {/* Inbox */}
      <motion.div {...iconMotion} className="relative">
        <Link
          to="/inbox"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          aria-label={t("inbox.title")}
        >
          <TrayIcon size={18} aria-hidden="true" />
        </Link>
      </motion.div>

      {/* Settings — hidden on mobile */}
      <motion.div {...iconMotion} className="hidden sm:block">
        <Link
          to="/settings"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          aria-label={t("settings.title")}
        >
          <GearIcon size={18} aria-hidden="true" />
        </Link>
      </motion.div>

      {/* UserIcon avatar dropdown */}
      <motion.button
        type="button"
        {...iconMotion}
        className="relative flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
        aria-label={t("nav.user_menu")}
      >
        <UserIcon size={18} aria-hidden="true" />
      </motion.button>
    </header>
  )
}
