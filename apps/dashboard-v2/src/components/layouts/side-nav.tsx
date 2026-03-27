import { Link, useMatches } from "@tanstack/react-router"
import {
  HouseIcon,
  ListChecksIcon,
  UsersIcon,
  FolderOpenIcon,
  PaintBrushIcon,
  ChatCircleIcon,
  ChartBarIcon,
  TrayIcon,
  Link as LinkIcon,
  GearIcon,
  BookOpenIcon,
  CaretDownIcon,
} from "@phosphor-icons/react"
import { useState } from "react"
import { useTranslation } from "@/lib/i18n"
import { useAppStore } from "@/stores/app.store"
import type { Icon } from "@phosphor-icons/react"

interface NavItem {
  icon: Icon
  labelKey: string
  to: string
  badge?: number
  external?: boolean
}

const primaryItems: NavItem[] = [
  { icon: HouseIcon, labelKey: "nav.dashboard", to: "/" },
  { icon: ListChecksIcon, labelKey: "nav.tasks", to: "/tasks" },
  { icon: UsersIcon, labelKey: "nav.team", to: "/team" },
  { icon: FolderOpenIcon, labelKey: "nav.files", to: "/files" },
  { icon: PaintBrushIcon, labelKey: "nav.artifacts", to: "/artifacts" },
  { icon: ChatCircleIcon, labelKey: "nav.chat", to: "/chat" },
]

const secondaryItems: NavItem[] = [
  { icon: TrayIcon, labelKey: "nav.inbox", to: "/inbox" },
  { icon: ChartBarIcon, labelKey: "nav.activity", to: "/activity" },
  { icon: LinkIcon, labelKey: "nav.integrations", to: "/integrations" },
]

const bottomItems: NavItem[] = [
  { icon: GearIcon, labelKey: "nav.settings", to: "/settings" },
  { icon: BookOpenIcon, labelKey: "Docs", to: "https://docs.questpie.com", external: true },
]

function NavItemButton({
  item,
  isActive,
  collapsed,
}: {
  item: NavItem
  isActive: boolean
  collapsed: boolean
}) {
  const { t } = useTranslation()
  const Icon = item.icon
  const label = t(item.labelKey)

  const className = [
    "group relative flex items-center gap-3 px-3 py-2 text-sm font-heading transition-colors",
    isActive
      ? "border-l-2 border-primary text-foreground bg-primary/5"
      : "border-l-2 border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50",
    collapsed ? "justify-center px-0" : "",
  ].join(" ")

  if (item.external) {
    return (
      <a
        href={item.to}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        title={collapsed ? label : undefined}
      >
        <Icon size={20} weight={isActive ? "fill" : "regular"} />
        {!collapsed && <span className="truncate">{label}</span>}
      </a>
    )
  }

  return (
    <Link to={item.to} className={className} title={collapsed ? label : undefined}>
      <Icon size={20} weight={isActive ? "fill" : "regular"} />
      {!collapsed && <span className="truncate">{label}</span>}
      {item.badge != null && item.badge > 0 && (
        <span className="ml-auto rounded-none bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
          {item.badge}
        </span>
      )}
    </Link>
  )
}

export function SideNav() {
  const { t } = useTranslation()
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const matches = useMatches()
  const [secondaryOpen, setSecondaryOpen] = useState(true)

  const currentPath = matches[matches.length - 1]?.pathname ?? "/"

  // Auto-collapse to icon rail when on routes with secondary sidebars
  const hasSecondarySidebar = currentPath.startsWith("/files") || currentPath.startsWith("/settings")
  const collapsed = !sidebarOpen || hasSecondarySidebar

  function isActive(to: string): boolean {
    if (to === "/") return currentPath === "/"
    return currentPath.startsWith(to)
  }

  return (
    <nav
      className={[
        "hidden flex-col border-r border-border bg-sidebar font-heading lg:flex",
        collapsed ? "w-[56px]" : "w-[220px]",
        "shrink-0 transition-[width] duration-200",
      ].join(" ")}
      aria-label={t("a11y.main_navigation")}
    >
      {/* Primary items */}
      <div className="flex flex-1 flex-col gap-0.5 py-2">
        {primaryItems.map((item) => (
          <NavItemButton
            key={item.to}
            item={item}
            isActive={isActive(item.to)}
            collapsed={collapsed}
          />
        ))}

        {/* Secondary section */}
        {!collapsed && (
          <button
            type="button"
            onClick={() => setSecondaryOpen(!secondaryOpen)}
            className="mt-4 flex items-center gap-2 px-3 py-1 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            <CaretDownIcon
              size={10}
              className={`transition-transform ${secondaryOpen ? "" : "-rotate-90"}`}
            />
            {t("nav.more")}
          </button>
        )}
        {(collapsed || secondaryOpen) &&
          secondaryItems.map((item) => (
            <NavItemButton
              key={item.to}
              item={item}
              isActive={isActive(item.to)}
              collapsed={collapsed}
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
          />
        ))}
      </div>
    </nav>
  )
}
