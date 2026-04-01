import { useState, useRef, useEffect } from "react"
import { Link } from "@tanstack/react-router"
import {
  BellIcon,
  GearIcon,
  SignOutIcon,
  SunIcon,
  MoonIcon,
  MonitorIcon,
  ArrowRightIcon,
} from "@phosphor-icons/react"
import { m, AnimatePresence } from "framer-motion"
import { useRouter } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "@/lib/i18n"
import { EASING, DURATION } from "@/lib/motion"
import { primaryItems } from "./nav-items.config"
import { NavItemButton } from "./nav-item-button"
import { useAppStore } from "@/stores/app.store"
import { authClient } from "@/lib/auth"
import { unreadNotificationsQuery } from "@/features/notifications/notification.queries"
import { NotificationDropdown } from "@/features/notifications/notification-dropdown"
import { stringToColor } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu"
import type { Notification } from "@/features/notifications/notification-item"

interface NavContentProps {
  collapsed: boolean
  currentPath: string
  onNavigate?: () => void
}

/** Shared nav content used by both desktop sidebar and mobile overlay */
export function NavContent({
  collapsed,
  currentPath,
  onNavigate,
}: NavContentProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)

  const { data: session } = authClient.useSession()
  const userName = session?.user?.name ?? session?.user?.email ?? "User"
  const userInitial = userName.charAt(0).toUpperCase()
  const avatarColor = stringToColor(userName)

  const { data: unreadNotifications = [] } = useQuery(unreadNotificationsQuery())
  const unreadCount = (unreadNotifications as Notification[]).length

  function isActive(to: string): boolean {
    if (to === "/") return currentPath === "/"
    return currentPath.startsWith(to)
  }

  async function handleSignOut() {
    await authClient.signOut()
    await router.invalidate()
    await router.navigate({ to: "/login" })
  }

  const ThemeIcon = theme === "dark" ? MoonIcon : theme === "light" ? SunIcon : MonitorIcon

  const itemBase = [
    "group relative flex items-center gap-3 px-3 py-2 text-sm font-heading transition-all duration-150 ease-out",
    "border-l-2 border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50",
  ].join(" ")

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
      </div>

      {/* Bottom: notification bell popover + profile dropdown */}
      <div className="flex flex-col gap-0.5 border-t border-border py-2">
        {/* Notification bell — opens popover with top notifications */}
        <NotificationBellNav
          collapsed={collapsed}
          itemBase={itemBase}
          unreadCount={unreadCount}
          onNavigate={onNavigate}
        />

        {/* Profile dropdown — avatar + name → Settings, Theme, Sign Out */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className={[
                  itemBase,
                  collapsed ? "justify-center px-0" : "",
                ].join(" ")}
                title={collapsed ? userName : undefined}
              />
            }
          >
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center text-[10px] font-bold text-white"
              style={{ backgroundColor: avatarColor }}
            >
              {userInitial}
            </span>
            <AnimatePresence>
              {!collapsed && (
                <m.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: DURATION.normal, ease: EASING.enter }}
                  className="truncate overflow-hidden"
                >
                  {userName}
                </m.span>
              )}
            </AnimatePresence>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side={collapsed ? "right" : "top"}
            sideOffset={8}
          >
            <DropdownMenuItem
              onClick={() => {
                onNavigate?.()
                void router.navigate({ to: "/settings" })
              }}
            >
              <GearIcon size={14} />
              {t("nav.settings")}
            </DropdownMenuItem>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <ThemeIcon size={14} />
                Theme
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => setTheme("light")}>
                  <SunIcon size={14} />
                  Light
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                  <MoonIcon size={14} />
                  Dark
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>
                  <MonitorIcon size={14} />
                  System
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={handleSignOut}>
              <SignOutIcon size={14} />
              {t("auth.sign_out")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  )
}

/** Notification bell with inline popover — shows top notifications, link to /inbox */
function NotificationBellNav({
  collapsed,
  itemBase,
  unreadCount,
  onNavigate,
}: {
  collapsed: boolean
  itemBase: string
  unreadCount: number
  onNavigate?: () => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click
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

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={[
          itemBase,
          open ? "!border-primary !text-foreground !bg-primary/5" : "",
          collapsed ? "justify-center px-0" : "",
        ].join(" ")}
        title={collapsed ? t("nav.notifications") : undefined}
      >
        <span className="relative">
          <BellIcon size={20} className="transition-colors duration-150 ease-out group-hover:text-primary" />
          {unreadCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center bg-destructive px-0.5 text-[8px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </span>
        <AnimatePresence>
          {!collapsed && (
            <m.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: DURATION.normal, ease: EASING.enter }}
              className="truncate overflow-hidden"
            >
              {t("nav.notifications")}
            </m.span>
          )}
        </AnimatePresence>
      </button>

      {/* Popover — positioned to the right of sidebar */}
      <AnimatePresence>
        {open && (
          <m.div
            initial={{ opacity: 0, x: -4, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            className="absolute bottom-0 left-full z-50 ml-2"
          >
            <div className="flex flex-col">
              <NotificationDropdown onClose={() => setOpen(false)} />
              {/* View all link at the bottom */}
              <Link
                to="/inbox"
                onClick={() => {
                  setOpen(false)
                  onNavigate?.()
                }}
                className="flex items-center justify-center gap-1.5 border border-t-0 border-border bg-background px-3 py-2 font-heading text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                {t("notifications.view_all")}
                <ArrowRightIcon size={12} />
              </Link>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}
