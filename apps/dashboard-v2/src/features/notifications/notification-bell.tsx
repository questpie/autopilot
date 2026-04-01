import { useState, useRef, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { m, AnimatePresence } from "framer-motion"
import { BellIcon } from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { SPRING, useMotionPreference } from "@/lib/motion"
import { BottomSheet } from "@/components/mobile/bottom-sheet"
import { unreadNotificationsQuery } from "./notification.queries"
import { NotificationDropdown } from "./notification-dropdown"
import type { Notification } from "./notification-item"

export function NotificationBell() {
  const { t } = useTranslation()
  const { shouldReduce } = useMotionPreference()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: unreadNotifications = [] } = useQuery(unreadNotificationsQuery())
  const unreadCount = (unreadNotifications as Notification[]).length

  // Close on outside click (desktop only)
  useEffect(() => {
    if (!open) return

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open])

  const handleClose = () => setOpen(false)

  return (
    <div ref={containerRef} className="relative">
      <m.button
        type="button"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        onClick={() => setOpen((prev) => !prev)}
        className="relative mr-1 flex min-h-[44px] min-w-[44px] items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
        aria-label={t("nav.notifications")}
        aria-expanded={open}
      >
        <BellIcon size={18} aria-hidden="true" />
        {/* Unread badge */}
        <AnimatePresence mode="wait">
          {unreadCount > 0 && (
            <m.span
              key={unreadCount}
              initial={shouldReduce ? false : { scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={shouldReduce ? { opacity: 0 } : { scale: 0.6, opacity: 0 }}
              transition={shouldReduce ? { duration: 0 } : SPRING.bouncy}
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center bg-destructive px-0.5 text-[9px] font-bold text-white"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </m.span>
          )}
        </AnimatePresence>
      </m.button>

      {/* Desktop dropdown (hidden on mobile) */}
      <AnimatePresence>
        {open && (
          <m.div
            initial={shouldReduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            className="absolute right-0 top-full z-50 mt-1 hidden lg:block"
          >
            <NotificationDropdown onClose={handleClose} />
          </m.div>
        )}
      </AnimatePresence>

      {/* Mobile bottom sheet (visible only on mobile via BottomSheet's lg:hidden) */}
      <BottomSheet open={open} onClose={handleClose} snapPoints={[0.6, 0.92]}>
        <NotificationDropdown onClose={handleClose} />
      </BottomSheet>
    </div>
  )
}
