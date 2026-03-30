import { Link } from "@tanstack/react-router"
import { PlayIcon, StopIcon } from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ArtifactConfig } from "./artifacts.queries"

interface ArtifactCardProps {
  artifact: ArtifactConfig
  view: "grid" | "list"
}

/**
 * Artifact card for the gallery.
 * Grid mode: 16:10 thumbnail area, title, badges.
 * List mode: compact single-row.
 */
export function ArtifactCard({ artifact, view }: ArtifactCardProps) {
  const { t } = useTranslation()
  const isRunning = artifact.status === "running"

  if (view === "list") {
    return (
      <Link
        to="/artifacts/$id"
        params={{ id: artifact.id }}
        className="flex items-center gap-4 border-b border-border/50 px-4 py-3 transition-colors hover:bg-muted/50"
      >
        <div className="flex size-8 items-center justify-center bg-muted">
          {isRunning ? (
            <PlayIcon size={14} weight="fill" className="text-success" />
          ) : (
            <StopIcon size={14} className="text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="font-heading text-xs font-medium text-foreground">
            {artifact.name || artifact.id}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {artifact.serve}
          </span>
        </div>
        <Badge
          variant={isRunning ? "default" : "secondary"}
          className={cn(
            "rounded-none text-[9px]",
            isRunning && "bg-success/10 text-success",
          )}
        >
          {isRunning ? t("artifacts.status_running") : t("artifacts.status_stopped")}
        </Badge>
      </Link>
    )
  }

  return (
    <Link
      to="/artifacts/$id"
      params={{ id: artifact.id }}
      className="group flex flex-col border border-border transition-all duration-150 ease-out hover:-translate-y-1 hover:border-primary"
    >
      {/* Thumbnail area (16:10 ratio) */}
      <div className="relative flex aspect-[16/10] items-center justify-center bg-muted/30 transition-transform duration-200 group-hover:scale-[1.02]">
        {isRunning ? (
          <PlayIcon size={24} weight="fill" className="text-success/50" />
        ) : (
          <StopIcon size={24} className="text-muted-foreground/30" />
        )}
        {/* Status badge overlay */}
        <Badge
          variant={isRunning ? "default" : "secondary"}
          className={cn(
            "absolute right-2 top-2 rounded-none text-[9px]",
            isRunning && "bg-success/10 text-success",
          )}
        >
          {isRunning ? t("artifacts.status_running") : t("artifacts.status_stopped")}
        </Badge>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1.5 border-t border-border p-3">
        <span className="font-heading text-xs font-medium text-foreground">
          {artifact.name || artifact.id}
        </span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground">
            {artifact.serve}
          </span>
        </div>
      </div>
    </Link>
  )
}
