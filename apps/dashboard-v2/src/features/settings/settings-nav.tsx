import { Link, useMatches } from "@tanstack/react-router"
import {
  GearIcon,
  UserCircleIcon,
  ShieldIcon,
  WarningIcon,
  LockKeyIcon,
  BellIcon,
} from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type { Icon } from "@phosphor-icons/react"

interface SettingsNavItem {
  icon: Icon
  labelKey: string
  to: string
  indent?: boolean
}

const settingsItems: SettingsNavItem[] = [
  { icon: GearIcon, labelKey: "settings.general", to: "/settings/general" },
  { icon: UserCircleIcon, labelKey: "settings.profile", to: "/settings/profile" },
  { icon: ShieldIcon, labelKey: "settings.security", to: "/settings/security" },
  { icon: LockKeyIcon, labelKey: "settings.two_factor", to: "/settings/security/2fa", indent: true },
  { icon: BellIcon, labelKey: "settings.notifications", to: "/settings/notifications" },
  { icon: WarningIcon, labelKey: "settings.danger", to: "/settings/danger" },
]

/**
 * Settings navigation sidebar.
 * Secondary left panel listing all settings sub-pages.
 */
export function SettingsNav() {
  const { t } = useTranslation()
  const matches = useMatches()
  const currentPath = matches[matches.length - 1]?.pathname ?? ""

  function isActive(to: string): boolean {
    // Exact match for security to avoid matching security/2fa and security/secrets
    if (to === "/settings/security") {
      return currentPath === "/settings/security"
    }
    return currentPath === to || currentPath.startsWith(to + "/")
  }

  return (
    <div className="flex h-full w-[240px] shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-heading text-sm font-semibold text-foreground">
          {t("settings.title")}
        </h2>
      </div>

      <ScrollArea className="flex-1">
        <nav className="flex flex-col gap-0.5 p-2" aria-label={t("a11y.settings_navigation")}>
          {settingsItems.map((item) => {
            const active = isActive(item.to)
            const ItemIcon = item.icon

            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-1.5 font-heading text-xs transition-colors",
                  item.indent && "ml-4",
                  active
                    ? "bg-primary/5 text-foreground border-l-2 border-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border-l-2 border-transparent",
                )}
              >
                <ItemIcon size={16} weight={active ? "fill" : "regular"} />
                <span className="truncate">{t(item.labelKey)}</span>
              </Link>
            )
          })}
        </nav>
      </ScrollArea>
    </div>
  )
}
