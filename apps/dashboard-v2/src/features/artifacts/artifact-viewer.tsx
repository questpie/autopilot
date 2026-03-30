import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import {
  PlayIcon,
  StopIcon,
  ArrowSquareOutIcon,
  CodeIcon,
  PushPinIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { artifactDetailQuery } from "./artifacts.queries"
import { useStartArtifact, useStopArtifact } from "./artifacts.mutations"
import { ViewportSwitcher, VIEWPORT_SIZES, type ViewportSize } from "./viewport-switcher"
import { API_BASE } from "@/lib/api"

interface ArtifactViewerProps {
  artifactId: string
}

/**
 * Artifact viewer — sandboxed iframe with toolbar.
 */
export function ArtifactViewer({ artifactId }: ArtifactViewerProps) {
  const { t } = useTranslation()
  const [viewport, setViewport] = useState<ViewportSize>("desktop")

  const { data: artifact, isLoading } = useQuery(artifactDetailQuery(artifactId))
  const startArtifact = useStartArtifact()
  const stopArtifact = useStopArtifact()

  const isRunning = artifact?.status === "running"
  const proxyUrl = `${API_BASE}/artifacts/${artifactId}/`

  const handleStart = () => {
    startArtifact.mutate(artifactId, {
      onSuccess: () => toast.success(t("artifacts.started")),
      onError: (err) => toast.error(err.message),
    })
  }

  const handleStop = () => {
    stopArtifact.mutate(artifactId, {
      onSuccess: () => toast.success(t("artifacts.stopped")),
      onError: (err) => toast.error(err.message),
    })
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-10 w-full rounded-none" />
        <Skeleton className="h-[60vh] w-full rounded-none" />
      </div>
    )
  }

  if (!artifact) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-xs text-muted-foreground">{t("artifacts.not_found")}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <div className="flex flex-1 items-center gap-2">
          <span className="font-heading text-sm font-medium text-foreground">
            {artifact.name || artifact.id}
          </span>
          <Badge
            variant={isRunning ? "default" : "secondary"}
            className={`rounded-none text-[9px] ${isRunning ? "bg-success/10 text-success" : ""}`}
          >
            {isRunning ? t("artifacts.status_running") : t("artifacts.status_stopped")}
          </Badge>
        </div>

        <ViewportSwitcher value={viewport} onChange={setViewport} />

        <div className="flex items-center gap-1">
          {isRunning ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleStop}
              disabled={stopArtifact.isPending}
              className="gap-1 rounded-none font-heading text-[10px]"
            >
              <StopIcon size={12} />
              {t("artifacts.stop")}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleStart}
              disabled={startArtifact.isPending}
              className="gap-1 rounded-none font-heading text-[10px]"
            >
              <PlayIcon size={12} />
              {t("artifacts.start")}
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 rounded-none p-0"
            title={t("artifacts.pin_to_dashboard")}
            onClick={() => {
              toast.info(t("artifacts.pin_to_dashboard"))
            }}
          >
            <PushPinIcon size={14} />
          </Button>

          <Link
            to="/files/$"
            params={{ _splat: `artifacts/${artifact.id}` }}
          >
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 rounded-none p-0"
              title={t("artifacts.view_source")}
            >
              <CodeIcon size={14} />
            </Button>
          </Link>

          {isRunning && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(proxyUrl, "_blank")}
              className="h-7 w-7 rounded-none p-0"
              title={t("artifacts.open_new_tab")}
            >
              <ArrowSquareOutIcon size={14} />
            </Button>
          )}
        </div>
      </div>

      {/* Iframe or start prompt */}
      {isRunning ? (
        <div className="flex justify-center bg-muted/20 p-4">
          <iframe
            src={proxyUrl}
            title={artifact.name || artifact.id}
            sandbox="allow-scripts allow-same-origin"
            referrerPolicy="no-referrer"
            className="border border-border bg-white"
            style={{
              width: VIEWPORT_SIZES[viewport].width,
              height: "80vh",
              maxWidth: "100%",
            }}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <div className="flex size-16 items-center justify-center bg-muted">
            <PlayIcon size={24} className="text-muted-foreground" />
          </div>
          <p className="font-heading text-sm text-muted-foreground">
            {t("artifacts.not_running_message")}
          </p>
          <Button
            size="sm"
            onClick={handleStart}
            disabled={startArtifact.isPending}
            className="gap-1 rounded-none font-heading text-xs"
          >
            <PlayIcon size={14} />
            {t("artifacts.start_preview")}
          </Button>
        </div>
      )}
    </div>
  )
}
