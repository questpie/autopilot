import { useState } from "react"
import { Link, useMatches, useNavigate } from "@tanstack/react-router"
import {
  HouseIcon,
  ListChecksIcon,
  ChatCircleIcon,
  UsersIcon,
  DotsThreeIcon,
  ChartBarIcon,
  PlugsIcon,
  FolderOpenIcon,
  PaintBrushIcon,
  GearIcon,
} from "@phosphor-icons/react"
import { motion, LayoutGroup } from "framer-motion"
import { useTranslation } from "@/lib/i18n"
import { BottomSheet } from "@/components/mobile/bottom-sheet"
import { SPRING, useMotionPreference } from "@/lib/motion"
import { cn } from "@/lib/utils"
import type { Icon } from "@phosphor-icons/react"

interface BottomNavItem {
  icon: Icon
  labelKey: string
  to: string
}

const primaryItems: BottomNavItem[] = [
  { icon: HouseIcon, labelKey: "nav.dashboard", to: "/" },
  { icon: ListChecksIcon, labelKey: "nav.tasks", to: "/tasks" },
  { icon: ChatCircleIcon, labelKey: "nav.chat", to: "/chat" },
  { icon: UsersIcon, labelKey: "nav.team", to: "/team" },
]

const moreItems: BottomNavItem[] = [
  { icon: ChartBarIcon, labelKey: "nav.activity", to: "/activity" },
  { icon: PlugsIcon, labelKey: "nav.integrations", to: "/integrations" },
  { icon: FolderOpenIcon, labelKey: "nav.files", to: "/files" },
  { icon: PaintBrushIcon, labelKey: "nav.artifacts", to: "/artifacts" },
  { icon: GearIcon, labelKey: "nav.settings", to: "/settings" },
]

/**
 * Bottom tab bar for mobile (< 768px). 5 items matching spec section 2.3.
 * First 4 are direct nav links, 5th is "More" which opens a bottom sheet
 * with remaining nav items (Activity, Integrations, Files, Artifacts, Settings).
 * All touch targets are minimum 44x44px.
 * Active tab has a sliding indicator via framer-motion layoutId.
 */
export function BottomNav() {
  const { t } = useTranslation()
  const matches = useMatches()
  const navigate = useNavigate()
  const currentPath = matches[matches.length - 1]?.pathname ?? "/"
  const [moreOpen, setMoreOpen] = useState(false)
  const { shouldReduce } = useMotionPreference()

  function isActive(to: string): boolean {
    if (to === "/") return currentPath === "/"
    return currentPath.startsWith(to)
  }

  function handleMoreNav(to: string) {
    setMoreOpen(false)
    void navigate({ to })
  }

  // Check if any "more" item is active
  const moreActive = moreItems.some((item) => isActive(item.to))

  const indicatorClass = "absolute top-0 left-2 right-2 h-0.5 bg-primary"
  const tabClass = "relative flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[10px] transition-colors"

  return (
    <>
      <nav
        className="flex h-14 shrink-0 items-center border-t border-border bg-background pb-[var(--safe-bottom)] font-heading lg:hidden"
        aria-label={t("nav.mobile_navigation")}
      >
        <LayoutGroup>
          {primaryItems.map((item) => {
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
                  <motion.div
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

          {/* More button */}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(tabClass, moreActive ? "text-primary" : "text-muted-foreground")}
            aria-label={t("nav.more")}
          >
            {moreActive && (shouldReduce ? (
              <div className={indicatorClass} />
            ) : (
              <motion.div
                layoutId="bottom-nav-indicator"
                className={indicatorClass}
                transition={SPRING.snappy}
              />
            ))}
            <DotsThreeIcon size={20} weight={moreActive ? "fill" : "regular"} aria-hidden="true" />
            <span>{t("nav.more")}</span>
          </button>
        </LayoutGroup>
      </nav>

      {/* More bottom sheet */}
      <BottomSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        snapPoints={[0.4]}
      >
        <nav className="flex flex-col gap-1" aria-label={t("nav.more")}>
          {moreItems.map((item) => {
            const active = isActive(item.to)
            const IconComp = item.icon
            return (
              <button
                key={item.to}
                type="button"
                onClick={() => handleMoreNav(item.to)}
                className={cn(
                  "flex min-h-[44px] items-center gap-3 px-4 py-3 text-sm transition-colors",
                  active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted",
                )}
                aria-current={active ? "page" : undefined}
              >
                <IconComp size={20} weight={active ? "fill" : "regular"} aria-hidden="true" />
                <span className="font-heading">{t(item.labelKey)}</span>
              </button>
            )
          })}
        </nav>
      </BottomSheet>
    </>
  )
}
