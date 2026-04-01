import { Button } from "@/components/ui/button"
import { SquareBuildLogo } from "@/components/brand"
import { cn } from "@/lib/utils"
import { MotionConfig } from "framer-motion"
import type { Icon } from "@phosphor-icons/react"
import { isValidElement } from "react"

interface EmptyStateProps {
  icon?: Icon | React.ReactNode
  logo?: boolean
  title?: string
  message?: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

function renderVisual(icon: EmptyStateProps["icon"], logo: boolean): React.ReactNode {
  if (logo) {
    return (
      <>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute size-[200px]"
          style={{
            background: "radial-gradient(circle, rgba(183,0,255,0.05) 0%, transparent 60%)",
          }}
        />
        <MotionConfig reducedMotion="always">
          <div className="relative z-10 flex flex-col items-center gap-2">
            <SquareBuildLogo size={48} />
            <span className="font-heading text-[10px] uppercase tracking-[0.3em] text-muted-foreground/40">
              QUESTPIE
            </span>
          </div>
        </MotionConfig>
      </>
    )
  }

  if (typeof icon === "function") {
    const Icon = icon
    return <Icon size={48} className="text-muted-foreground/30" aria-hidden="true" />
  }

  if (isValidElement(icon)) {
    return icon
  }

  return null
}

/**
 * Minimal empty state component for Phase 0+1.
 */
export function EmptyState({
  icon,
  logo = false,
  title,
  message,
  description,
  action,
  className,
}: EmptyStateProps): React.JSX.Element {
  const resolvedTitle = title ?? message ?? ""

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 text-center",
        className,
      )}
    >
      <div className="relative flex items-center justify-center">{renderVisual(icon, logo)}</div>

      <h2 className="mt-6 font-heading text-lg text-foreground">{resolvedTitle}</h2>
      {description ? (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action && (
        <Button className="mt-6" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
