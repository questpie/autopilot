import type { Icon } from "@phosphor-icons/react"
import { CaretDownIcon } from "@phosphor-icons/react"
import { AnimatePresence, m } from "framer-motion"
import { Children, useId, useState } from "react"
import { DURATION, EASING, useMotionPreference } from "@/lib/motion"
import { cn } from "@/lib/utils"

export interface SidebarSectionProps {
  title: string
  icon?: Icon
  children?: React.ReactNode
  defaultOpen?: boolean
  action?: React.ReactNode
  count?: number
  emptyText?: string
}

function renderCount(count: number | undefined): React.ReactNode {
  if (typeof count !== "number" || !Number.isFinite(count) || count <= 0) {
    return null
  }

  return <span className="bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">{count}</span>
}

export function SidebarSection({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
  action,
  count,
  emptyText,
}: SidebarSectionProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const { d } = useMotionPreference()
  const headerId = useId()
  const contentId = useId()
  const hasChildren = Children.count(children) > 0

  return (
    <section className="border-b border-border last:border-b-0">
      <div className="flex items-center gap-1 px-3">
        <button
          id={headerId}
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="flex h-8 min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={isOpen}
          aria-controls={contentId}
        >
          <CaretDownIcon
            size={10}
            aria-hidden="true"
            className={cn(
              "shrink-0 text-muted-foreground/60 transition-transform duration-150 ease-out",
              isOpen ? "rotate-0" : "-rotate-90",
            )}
          />
          {Icon ? <Icon size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
          <span className="flex-1 font-heading text-[10px] uppercase tracking-widest text-muted-foreground">
            {title}
          </span>
          {renderCount(count)}
        </button>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      <AnimatePresence initial={false}>
        {isOpen ? (
          <m.div
            id={contentId}
            role="region"
            aria-labelledby={headerId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: d(DURATION.normal), ease: EASING.move }}
            className="overflow-hidden"
          >
            <div className="flex flex-col">
              {hasChildren ? (
                children
              ) : emptyText ? (
                <p className="px-4 py-3 text-center text-xs text-muted-foreground/60">{emptyText}</p>
              ) : null}
            </div>
          </m.div>
        ) : null}
      </AnimatePresence>
    </section>
  )
}
