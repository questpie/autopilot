import { useState } from "react"
import { CaretDownIcon } from "@phosphor-icons/react"
import { m, AnimatePresence } from "framer-motion"
import { useTranslation } from "@/lib/i18n"
import { DURATION, useMotionPreference } from "@/lib/motion"
import { primaryItems, secondaryItems, bottomItems } from "./nav-items.config"
import { NavItemButton } from "./nav-item-button"

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
