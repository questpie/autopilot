import {
  ChatCircleIcon,
  FolderSimpleIcon,
  LightningIcon,
} from "@phosphor-icons/react"
import type { Icon } from "@phosphor-icons/react"
import { MotionConfig, m } from "framer-motion"
import { useRouter, useRouterState } from "@tanstack/react-router"
import { SquareBuildLogo } from "@/components/brand"
import { AccountMenu } from "./account-menu"
import { useTranslation } from "@/lib/i18n"
import { getActiveSection, getSectionRoot, type AppSection } from "@/lib/navigation"
import { useMotionPreference } from "@/lib/motion"
import { cn } from "@/lib/utils"

interface SidebarItem {
  id: AppSection
  icon: Icon
  labelKey: string
}

const sections: SidebarItem[] = [
  { id: "channels", icon: ChatCircleIcon, labelKey: "nav.channels" },
  { id: "workflow", icon: LightningIcon, labelKey: "nav.workflow" },
  { id: "fs", icon: FolderSimpleIcon, labelKey: "nav.fs" },
]

export function CompactSidebar(): React.JSX.Element {
  const { t } = useTranslation()
  const router = useRouter()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const { shouldReduce } = useMotionPreference()

  const activeSection = getActiveSection(pathname)

  function navigateToSection(section: AppSection): void {
    if (section === activeSection) {
      return
    }

    void router.navigate({ to: getSectionRoot(section) })
  }

  return (
    <aside className="hidden w-14 shrink-0 flex-col border-r border-border bg-background md:flex">
      <div className="flex h-10 items-center justify-center">
        <MotionConfig reducedMotion="always">
          <SquareBuildLogo size={20} />
        </MotionConfig>
      </div>

      <nav aria-label={t("a11y.main_navigation")} className="flex flex-col gap-1 py-2">
        {sections.map((section) => {
          const Icon = section.icon
          const active = section.id === activeSection

          return (
            <m.button
              key={section.id}
              type="button"
              title={t(section.labelKey)}
              aria-label={t(section.labelKey)}
              aria-current={active ? "page" : undefined}
              onClick={() => navigateToSection(section.id)}
              whileHover={shouldReduce ? undefined : { scale: 1.08 }}
              whileTap={shouldReduce ? undefined : { scale: 0.92 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className={cn(
                "relative flex h-10 w-full items-center justify-center border-l-2 border-transparent text-muted-foreground transition-colors duration-150 ease-out hover:border-primary/50 hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                active && "border-primary bg-primary/5 text-foreground",
              )}
            >
              <Icon size={20} weight={active ? "fill" : "regular"} aria-hidden="true" />
            </m.button>
          )
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-1 border-t border-border py-2">
        <AccountMenu
          side="right"
          sideOffset={8}
          triggerClassName="flex h-10 w-full items-center justify-center border-l-2 border-transparent text-muted-foreground transition-colors duration-150 ease-out hover:bg-muted/50 hover:text-foreground"
        />
      </div>
    </aside>
  )
}
