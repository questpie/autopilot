import { Link, useMatches } from "@tanstack/react-router"
import {
  ChatCircleIcon,
  FolderOpenIcon,
  UsersIcon,
  ListChecksIcon,
} from "@phosphor-icons/react"
import { m, LayoutGroup } from "framer-motion"
import { useTranslation } from "@/lib/i18n"
import { SPRING, useMotionPreference } from "@/lib/motion"
import { cn } from "@/lib/utils"
import type { Icon } from "@phosphor-icons/react"

interface BottomNavItem {
  icon: Icon
  labelKey: string
  to: string
}

const items: BottomNavItem[] = [
  { icon: ChatCircleIcon, labelKey: "nav.chat", to: "/" },
  { icon: FolderOpenIcon, labelKey: "nav.files", to: "/files" },
  { icon: UsersIcon, labelKey: "nav.team", to: "/team" },
  { icon: ListChecksIcon, labelKey: "nav.tasks", to: "/tasks" },
]

/**
 * Bottom tab bar for mobile (< 768px). 4 fixed tabs: Chat, Files, Team, Tasks.
 * All touch targets are minimum 44x44px.
 * Active tab has a sliding indicator via framer-motion layoutId.
 */
export function BottomNav() {
  const { t } = useTranslation()
  const matches = useMatches()
  const currentPath = matches[matches.length - 1]?.pathname ?? "/"
  const { shouldReduce } = useMotionPreference()

  function isActive(to: string): boolean {
    if (to === "/") return currentPath === "/"
    return currentPath.startsWith(to)
  }

  const indicatorClass = "absolute top-0 left-2 right-2 h-0.5 bg-primary"
  const tabClass = "relative flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[10px] transition-colors"

  return (
    <nav
      className="flex h-14 shrink-0 items-center border-t border-border bg-background pb-[var(--safe-bottom)] font-heading md:hidden"
      aria-label={t("nav.mobile_navigation")}
    >
      <LayoutGroup>
        {items.map((item) => {
          const active = isActive(item.to)
          const IconComp = item.icon
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(tabClass, active ? "text-primary" : "text-muted-foreground")}
              aria-current={active ? "page" : undefined}
            >
              {active && (shouldReduce ? (
                <div className={indicatorClass} />
              ) : (
                <m.div
                  layoutId="bottom-nav-indicator"
                  className={indicatorClass}
                  transition={SPRING.snappy}
                />
              ))}
              <IconComp size={20} weight={active ? "fill" : "regular"} aria-hidden="true" />
              <span>{t(item.labelKey)}</span>
            </Link>
          )
        })}
      </LayoutGroup>
    </nav>
  )
}
