import { Link } from "@tanstack/react-router"
import {
  ListIcon,
  MagnifyingGlassIcon,
  BellIcon,
  TrayIcon,
  GearIcon,
  UserIcon,
} from "@phosphor-icons/react"
import { motion, AnimatePresence } from "framer-motion"
import { useTranslation } from "@/lib/i18n"
import { useAppStore } from "@/stores/app.store"
import { useHapticPattern } from "@/hooks/use-haptic"
import { SPRING, useMotionPreference } from "@/lib/motion"
import { ConnectionIndicatorDot } from "./connection-indicator"

/** Hover/tap scale for icon buttons */
const iconMotion = {
  whileHover: { scale: 1.08 },
  whileTap: { scale: 0.92 },
  transition: { type: "spring" as const, stiffness: 400, damping: 25 },
}

/** Animated count badge — bounces on count change */
function NotificationBadge({ count }: { count: number }) {
  const { shouldReduce } = useMotionPreference()

  if (count <= 0) return null

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={count}
        initial={shouldReduce ? false : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={shouldReduce ? { opacity: 0 } : { scale: 0.6, opacity: 0 }}
        transition={shouldReduce ? { duration: 0 } : SPRING.bouncy}
        className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center bg-destructive px-0.5 text-[9px] font-bold text-white"
      >
        {count > 99 ? "99+" : count}
      </motion.span>
    </AnimatePresence>
  )
}

export function TopBar() {
  const { t } = useTranslation()
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen)
  const { trigger } = useHapticPattern()

  // TODO: wire to real notification count from SSE/query
  const notificationCount = 0

  return (
    <header className="flex h-12 shrink-0 items-center border-b border-border bg-background px-4 font-heading">
      {/* Hamburger — visible on mobile only */}
      <motion.button
        type="button"
        onClick={toggleSidebar}
        {...iconMotion}
        className="mr-3 flex min-h-[44px] min-w-[44px] items-center justify-center lg:hidden"
        aria-label={t("nav.toggle_sidebar")}
      >
        <ListIcon size={20} weight="bold" aria-hidden="true" />
      </motion.button>

      {/* Company name */}
      <Link
        to="/settings/general"
        className="mr-4 truncate text-sm font-semibold tracking-tight hover:text-primary"
      >
        <span className="hidden sm:inline">{t("app.name")}</span>
        <span className="sm:hidden">QP</span>
      </Link>

      {/* Connection indicator dot */}
      <ConnectionIndicatorDot />

      <div className="flex-1" />

      {/* Search trigger */}
      <motion.button
        type="button"
        onClick={() => setCommandPaletteOpen(true)}
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="mr-2 flex min-h-[44px] items-center gap-2 rounded-none border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
        aria-label={t("common.search")}
      >
        <MagnifyingGlassIcon size={14} aria-hidden="true" />
        <span className="hidden sm:inline">{t("common.search")}</span>
        <kbd className="hidden rounded-none border border-border px-1.5 py-0.5 text-[10px] sm:inline">
          {"\u2318"}K
        </kbd>
      </motion.button>

      {/* Notifications */}
      <motion.button
        type="button"
        {...iconMotion}
        onClick={() => trigger("tap")}
        className="relative mr-1 flex min-h-[44px] min-w-[44px] items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
        aria-label={t("nav.notifications")}
      >
        <BellIcon size={18} aria-hidden="true" />
        <NotificationBadge count={notificationCount} />
      </motion.button>

      {/* Inbox */}
      <motion.div {...iconMotion} className="relative mr-1">
        <Link
          to="/inbox"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          aria-label={t("inbox.title")}
        >
          <TrayIcon size={18} aria-hidden="true" />
        </Link>
      </motion.div>

      {/* Settings — hidden on mobile */}
      <motion.div {...iconMotion} className="mr-1 hidden sm:block">
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
