import {
  ListIcon,
  MagnifyingGlassIcon,
  ChatCircleIcon,
  UserIcon,
} from "@phosphor-icons/react"
import { motion } from "framer-motion"
import { useTranslation } from "@/lib/i18n"
import { useAppStore } from "@/stores/app.store"
import { useHapticPattern } from "@/hooks/use-haptic"
import { NotificationBell } from "@/features/notifications/notification-bell"

/** Hover/tap scale for icon buttons */
const iconMotion = {
  whileHover: { scale: 1.08 },
  whileTap: { scale: 0.92 },
  transition: { type: "spring" as const, stiffness: 400, damping: 25 },
}

/**
 * TopBar — sits to the right of SideNav.
 * Contains: hamburger (mobile), search, notifications, chat toggle, user menu.
 * No logo/company name (that's in SideNav).
 * No inbox/settings icons (those are in SideNav).
 */
export function TopBar() {
  const { t } = useTranslation()
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen)
  const rightPanel = useAppStore((s) => s.rightPanel)
  const setRightPanel = useAppStore((s) => s.setRightPanel)
  const closeRightPanel = useAppStore((s) => s.closeRightPanel)
  const { trigger } = useHapticPattern()

  const chatOpen = rightPanel.open && rightPanel.mode === "chat"

  function handleChatToggle() {
    trigger("tap")
    if (chatOpen) {
      closeRightPanel()
    } else {
      setRightPanel({ mode: "chat" })
    }
  }

  return (
    <header className="flex h-12 shrink-0 items-center border-b border-border bg-background px-4 font-heading">
      {/* Hamburger — mobile only (opens SideNav sheet) */}
      <motion.button
        type="button"
        onClick={toggleSidebar}
        {...iconMotion}
        className="mr-3 flex min-h-[44px] min-w-[44px] items-center justify-center md:hidden"
        aria-label={t("nav.toggle_sidebar")}
      >
        <ListIcon size={20} weight="bold" aria-hidden="true" />
      </motion.button>

      {/* Search trigger — desktop: full bar, mobile: icon only */}
      <motion.button
        type="button"
        onClick={() => setCommandPaletteOpen(true)}
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="hidden sm:flex mr-2 min-w-[196px] h-8 items-center gap-2 rounded-none border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
        aria-label={t("common.search")}
      >
        <MagnifyingGlassIcon size={14} aria-hidden="true" />
        <span className="flex-1 text-left">{t("common.search")}</span>
        <kbd className="rounded-none border border-border px-1.5 py-0.5 text-[10px]">
          {"\u2318"}K
        </kbd>
      </motion.button>
      <motion.button
        type="button"
        onClick={() => setCommandPaletteOpen(true)}
        {...iconMotion}
        className="sm:hidden flex min-h-[44px] min-w-[44px] items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
        aria-label={t("common.search")}
      >
        <MagnifyingGlassIcon size={18} aria-hidden="true" />
      </motion.button>

      <div className="flex-1" />

      {/* Notifications */}
      <NotificationBell />

      {/* Chat panel toggle */}
      <motion.button
        type="button"
        onClick={handleChatToggle}
        {...iconMotion}
        className={[
          "relative flex min-h-[44px] min-w-[44px] items-center justify-center transition-colors",
          chatOpen ? "text-primary" : "text-muted-foreground hover:text-foreground",
        ].join(" ")}
        aria-label={chatOpen ? t("chat.close_panel") : t("chat.open_panel")}
        aria-pressed={chatOpen}
      >
        <ChatCircleIcon size={18} weight={chatOpen ? "fill" : "regular"} aria-hidden="true" />
      </motion.button>

      {/* User menu */}
      <motion.button
        type="button"
        {...iconMotion}
        className="relative flex min-h-[44px] min-w-[44px] items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
        aria-label={t("nav.user_menu")}
      >
        <UserIcon size={18} aria-hidden="true" />
      </motion.button>
    </header>
  )
}
