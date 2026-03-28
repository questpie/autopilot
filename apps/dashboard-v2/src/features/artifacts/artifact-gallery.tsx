import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { RowsIcon, SquaresFourIcon, PaintBrushIcon } from "@phosphor-icons/react"
import { m } from "framer-motion"
import { useTranslation } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/feedback/empty-state"
import { artifactsListQuery } from "./artifacts.queries"
import { ArtifactCard } from "./artifact-card"
import { EASING, DURATION, clampedDelay, useMotionPreference } from "@/lib/motion"

type ViewMode = "grid" | "list"

/**
 * Artifact gallery — grid/list views with filtering.
 */
export function ArtifactGallery() {
  const { t } = useTranslation()
  const [view, setView] = useState<ViewMode>("grid")
  const { data: artifacts, isLoading } = useQuery(artifactsListQuery())
  const { shouldReduce } = useMotionPreference()

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32 rounded-none" />
          <Skeleton className="h-8 w-20 rounded-none" />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[16/10] rounded-none" />
          ))}
        </div>
      </div>
    )
  }

  if (!artifacts || artifacts.length === 0) {
    return (
      <EmptyState
        icon={<PaintBrushIcon size={32} />}
        message={t("artifacts.no_artifacts")}
        description={t("artifacts.no_artifacts_description")}
        className="py-20"
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 pt-4">
        <span className="font-heading text-xs text-muted-foreground">
          {t("artifacts.artifact_count", { count: artifacts.length })}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant={view === "grid" ? "default" : "ghost"}
            size="sm"
            onClick={() => setView("grid")}
            className="h-7 w-7 rounded-none p-0"
          >
            <SquaresFourIcon size={14} />
          </Button>
          <Button
            variant={view === "list" ? "default" : "ghost"}
            size="sm"
            onClick={() => setView("list")}
            className="h-7 w-7 rounded-none p-0"
          >
            <RowsIcon size={14} />
          </Button>
        </div>
      </div>

      {/* Content */}
      {view === "grid" ? (
        <div className="grid grid-cols-1 gap-3 px-6 pb-6 md:grid-cols-2 lg:grid-cols-3">
          {artifacts.map((artifact, i) => (
            <m.div
              key={artifact.id}
              initial={shouldReduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: DURATION.normal,
                ease: EASING.enter,
                delay: shouldReduce ? 0 : clampedDelay(i, 40, 300),
              }}
            >
              <ArtifactCard artifact={artifact} view="grid" />
            </m.div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col">
          {artifacts.map((artifact, i) => (
            <m.div
              key={artifact.id}
              initial={shouldReduce ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: DURATION.fast,
                ease: EASING.enter,
                delay: shouldReduce ? 0 : clampedDelay(i, 20, 300),
              }}
            >
              <ArtifactCard artifact={artifact} view="list" />
            </m.div>
          ))}
        </div>
      )}
    </div>
  )
}
