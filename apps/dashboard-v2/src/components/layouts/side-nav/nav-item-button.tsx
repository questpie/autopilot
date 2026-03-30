import { Link } from "@tanstack/react-router"
import { m, AnimatePresence } from "framer-motion"
import { useTranslation } from "@/lib/i18n"
import { EASING, DURATION, SPRING } from "@/lib/motion"
import type { NavItem } from "./nav-items.config"

interface NavItemButtonProps {
  item: NavItem
  isActive: boolean
  collapsed: boolean
  onNavigate?: () => void
}

export function NavItemButton({
  item,
  isActive,
  collapsed,
  onNavigate,
}: NavItemButtonProps) {
  const { t } = useTranslation()
  const Icon = item.icon
  const label = t(item.labelKey)

  const className = [
    "group relative flex items-center gap-3 px-3 py-2 text-sm font-heading transition-all duration-150 ease-out",
    isActive
      ? "border-l-2 border-primary text-foreground bg-primary/5"
      : "border-l-2 border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:border-primary",
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
        onClick={onNavigate}
      >
        <Icon size={20} weight={isActive ? "fill" : "regular"} className="transition-colors duration-150 ease-out group-hover:text-primary" />
        <AnimatePresence>
          {!collapsed && (
            <m.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: DURATION.normal, ease: EASING.enter }}
              className="truncate overflow-hidden"
            >
              {label}
            </m.span>
          )}
        </AnimatePresence>
      </a>
    )
  }

  return (
    <Link
      to={item.to}
      className={className}
      title={collapsed ? label : undefined}
      onClick={onNavigate}
    >
      <Icon size={20} weight={isActive ? "fill" : "regular"} className="transition-colors duration-150 ease-out group-hover:text-primary" />
      <AnimatePresence>
        {!collapsed && (
          <m.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: DURATION.normal, ease: EASING.enter }}
            className="truncate overflow-hidden"
          >
            {label}
          </m.span>
        )}
      </AnimatePresence>
      {!collapsed && item.badge != null && item.badge > 0 && (
        <m.span
          key={item.badge}
          initial={{ scale: 1.3 }}
          animate={{ scale: 1 }}
          transition={SPRING.snappy}
          className="ml-auto rounded-none bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
        >
          {item.badge}
        </m.span>
      )}
    </Link>
  )
}
