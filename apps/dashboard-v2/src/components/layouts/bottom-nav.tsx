import { ChatCircleIcon, FolderSimpleIcon, LightningIcon } from "@phosphor-icons/react"
import { m, LayoutGroup } from "framer-motion"
import { useTranslation } from "@/lib/i18n"
import { SPRING, useMotionPreference } from "@/lib/motion"
import { getActiveSection, getSectionRoot, type AppSection } from "@/lib/navigation"
import { cn } from "@/lib/utils"
import type { Icon } from "@phosphor-icons/react"
import { useRouter, useRouterState } from "@tanstack/react-router"

interface BottomNavItem {
  id: AppSection
  icon: Icon
  labelKey: string
}

const items: BottomNavItem[] = [
  { id: "channels", icon: ChatCircleIcon, labelKey: "nav.channels" },
  { id: "workflow", icon: LightningIcon, labelKey: "nav.workflow" },
  { id: "fs", icon: FolderSimpleIcon, labelKey: "nav.fs" },
]

export function BottomNav(): React.JSX.Element {
  const { t } = useTranslation()
  const router = useRouter()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const { shouldReduce } = useMotionPreference()
  const activeSection = getActiveSection(pathname)

  function handleNavigate(section: AppSection): void {
    if (section === activeSection) {
      return
    }

    void router.navigate({ to: getSectionRoot(section) })
  }

  const indicatorClass = "absolute top-0 left-2 right-2 h-0.5 bg-primary"
  const tabClass =
    "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-2 py-1 text-[10px] transition-colors"

  return (
    <nav
      className="flex h-14 shrink-0 items-center border-t border-border bg-background pb-[var(--safe-bottom)] font-heading md:hidden"
      aria-label={t("nav.mobile_navigation")}
    >
      <LayoutGroup>
        {items.map((item) => {
          const active = item.id === activeSection
          const IconComp = item.icon
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavigate(item.id)}
              className={cn(tabClass, active ? "text-primary" : "text-muted-foreground")}
              aria-current={active ? "page" : undefined}
              aria-label={t(item.labelKey)}
            >
              {active
                ? shouldReduce
                  ? <div className={indicatorClass} />
                  : (
                      <m.div
                        layoutId="bottom-nav-indicator"
                        className={indicatorClass}
                        transition={SPRING.snappy}
                      />
                    )
                : null}
              <IconComp size={20} weight={active ? "fill" : "regular"} aria-hidden="true" />
              <span>{t(item.labelKey)}</span>
            </button>
          )
        })}
      </LayoutGroup>
    </nav>
  )
}
