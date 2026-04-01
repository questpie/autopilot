import { useState } from "react"
import {
  CaretDownIcon,
  SunIcon,
  MoonIcon,
  DesktopIcon,
} from "@phosphor-icons/react"
import { m, AnimatePresence } from "framer-motion"
import { useTranslation } from "@/lib/i18n"
import { DURATION, useMotionPreference } from "@/lib/motion"
import { useAppStore } from "@/stores/app.store"
import { primaryItems, secondaryItems, bottomItems } from "./nav-items.config"
import { NavItemButton } from "./nav-item-button"

const THEME_CYCLE = ["light", "dark", "system"] as const

function ThemeIcon({ theme }: { theme: "light" | "dark" | "system" }) {
  switch (theme) {
    case "light":
      return <SunIcon size={20} aria-hidden="true" />
    case "dark":
      return <MoonIcon size={20} aria-hidden="true" />
    case "system":
      return <DesktopIcon size={20} aria-hidden="true" />
  }
}

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
  const [secondaryOpen, setSecondaryOpen] = useState(true)
  const { d } = useMotionPreference()
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)

  function cycleTheme() {
    const idx = THEME_CYCLE.indexOf(theme)
    const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]
    setTheme(next)
  }

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
            <m.button
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
            </m.button>
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
        {/* Theme toggle */}
        <button
          type="button"
          onClick={cycleTheme}
          className={[
            "group relative flex items-center gap-3 px-3 py-2 text-sm font-heading transition-colors",
            "border-l-2 border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50",
            collapsed ? "justify-center px-0" : "",
          ].join(" ")}
          title={collapsed ? t("settings.theme") : undefined}
          aria-label={`${t("settings.theme")}: ${theme}`}
        >
          <ThemeIcon theme={theme} />
          <AnimatePresence>
            {!collapsed && (
              <m.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: DURATION.normal }}
                className="truncate overflow-hidden capitalize"
              >
                {theme}
              </m.span>
            )}
          </AnimatePresence>
        </button>

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
