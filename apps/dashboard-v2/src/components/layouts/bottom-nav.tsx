import { useState, useCallback } from "react"
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
import { useTranslation } from "@/lib/i18n"
import { BottomSheet } from "@/components/mobile/bottom-sheet"
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
 */
export function BottomNav() {
  const { t } = useTranslation()
  const matches = useMatches()
  const navigate = useNavigate()
  const currentPath = matches[matches.length - 1]?.pathname ?? "/"
  const [moreOpen, setMoreOpen] = useState(false)

  function isActive(to: string): boolean {
    if (to === "/") return currentPath === "/"
    return currentPath.startsWith(to)
  }

  const handleMoreNav = useCallback(
    (to: string) => {
      setMoreOpen(false)
      void navigate({ to })
    },
    [navigate],
  )

  // Check if any "more" item is active
  const moreActive = moreItems.some((item) => isActive(item.to))

  return (
    <>
      <nav
        className="flex h-14 shrink-0 items-center border-t border-border bg-background font-heading lg:hidden"
        aria-label={t("nav.mobile_navigation")}
      >
        {primaryItems.map((item) => {
          const active = isActive(item.to)
          const IconComp = item.icon
          return (
            <Link
              key={item.to}
              to={item.to}
              className={[
                "flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[10px] transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              ].join(" ")}
              aria-current={active ? "page" : undefined}
            >
              <IconComp size={20} weight={active ? "fill" : "regular"} aria-hidden="true" />
              <span>{t(item.labelKey)}</span>
            </Link>
          )
        })}

        {/* More button */}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={[
            "flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[10px] transition-colors",
            moreActive ? "text-primary" : "text-muted-foreground",
          ].join(" ")}
          aria-label={t("nav.more")}
        >
          <DotsThreeIcon size={20} weight={moreActive ? "fill" : "regular"} aria-hidden="true" />
          <span>{t("nav.more")}</span>
        </button>
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
                className={[
                  "flex min-h-[44px] items-center gap-3 px-4 py-3 text-sm transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-muted",
                ].join(" ")}
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
