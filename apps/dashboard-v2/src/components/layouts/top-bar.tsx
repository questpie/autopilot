import {
  ListIcon,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react"
import { m } from "framer-motion"
import { useTranslation } from "@/lib/i18n"
import { useAppStore } from "@/stores/app.store"

/** Hover/tap scale for icon buttons */
const iconMotion = {
  whileHover: { scale: 1.08 },
  whileTap: { scale: 0.92 },
  transition: { type: "spring" as const, stiffness: 400, damping: 25 },
}

/**
 * TopBar — sits to the right of SideNav.
 * Contains only: hamburger (mobile) + search (Cmd+K).
 * All other actions moved to sidebar bottom.
 */
export function TopBar() {
  const { t } = useTranslation()
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen)

  return (
    <header className="flex h-12 shrink-0 items-center border-b border-border bg-background px-4 font-heading">
      {/* Hamburger — mobile only (opens SideNav sheet) */}
      <m.button
        type="button"
        onClick={toggleSidebar}
        {...iconMotion}
        className="mr-3 flex min-h-[44px] min-w-[44px] items-center justify-center md:hidden"
        aria-label={t("nav.toggle_sidebar")}
      >
        <ListIcon size={20} weight="bold" aria-hidden="true" />
      </m.button>

      <div className="flex-1" />

      {/* Search trigger — right-aligned. Desktop: bar, mobile: icon only */}
      <m.button
        type="button"
        onClick={() => setCommandPaletteOpen(true)}
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="hidden sm:flex min-w-[196px] h-8 items-center gap-2 rounded-none border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
        aria-label={t("common.search")}
      >
        <MagnifyingGlassIcon size={14} aria-hidden="true" />
        <span className="flex-1 text-left">{t("common.search")}</span>
        <kbd className="rounded-none border border-border px-1.5 py-0.5 text-[10px]">
          {"\u2318"}K
        </kbd>
      </m.button>
      <m.button
        type="button"
        onClick={() => setCommandPaletteOpen(true)}
        {...iconMotion}
        className="sm:hidden flex min-h-[44px] min-w-[44px] items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
        aria-label={t("common.search")}
      >
        <MagnifyingGlassIcon size={18} aria-hidden="true" />
      </m.button>
    </header>
  )
}
