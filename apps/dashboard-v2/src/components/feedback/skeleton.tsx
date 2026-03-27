import { cn } from "@/lib/utils"
import { t } from "@/lib/i18n"

interface SkeletonProps {
  className?: string
}

/**
 * Skeleton loading placeholder with shimmer animation.
 * Uses a moving linear-gradient for the shimmer effect.
 * Respects prefers-reduced-motion (disables animation).
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-none bg-muted",
        "motion-reduce:animate-none",
        className,
      )}
      aria-hidden="true"
    />
  )
}

/**
 * Common skeleton patterns for reuse.
 */
export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label={t("a11y.loading_content")}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3", i === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="flex flex-col gap-3 border border-border p-4" aria-busy="true" aria-label={t("a11y.loading_card")}>
      <Skeleton className="h-4 w-1/3" />
      <SkeletonText lines={2} />
      <Skeleton className="h-6 w-20" />
    </div>
  )
}
