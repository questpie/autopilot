import { useMemo } from "react"
import { SquaresFourIcon, ClockIcon, ArrowsOutIcon } from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { Badge } from "@/components/ui/badge"
import type { FileViewProps } from "@/lib/view-registry"

interface WidgetMeta {
  name: string
  title: string
  description: string
  size: string
  refresh: number
  position: string
  created_by: string
}

/**
 * Parse widget.yaml metadata (simple key: value).
 */
function parseWidgetYaml(content: string): WidgetMeta {
  const meta: WidgetMeta = {
    name: "",
    title: "",
    description: "",
    size: "medium",
    refresh: 30000,
    position: "overview",
    created_by: "",
  }

  for (const line of content.split("\n")) {
    const colonIdx = line.indexOf(":")
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, "")
    if (key in meta) {
      ;(meta as unknown as Record<string, unknown>)[key] =
        key === "refresh" ? Number.parseInt(value, 10) || 30000 : value
    }
  }

  return meta
}

/**
 * Widget preview view — renders widget.yaml metadata as a preview card.
 * Shows name, size, refresh interval, position, and creator.
 */
function WidgetPreviewView({ path, content }: FileViewProps) {
  const { t } = useTranslation()
  const meta = useMemo(() => parseWidgetYaml(content), [content])

  const refreshSec = Math.round(meta.refresh / 1000)

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Widget card */}
      <div className="flex flex-col gap-4 border border-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center bg-primary/10">
            <SquaresFourIcon size={20} className="text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="font-heading text-base font-bold text-foreground">
              {meta.title || meta.name || t("files.untitled_widget")}
            </span>
            <span className="text-[10px] text-muted-foreground">{path}</span>
          </div>
        </div>

        {meta.description && (
          <p className="font-sans text-sm text-muted-foreground">{meta.description}</p>
        )}

        {/* Metadata badges */}
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-1.5">
            <ArrowsOutIcon size={12} className="text-muted-foreground" />
            <span className="font-heading text-[10px] text-muted-foreground">
              {t("files.widget_size")}:
            </span>
            <Badge variant="outline" className="rounded-none text-[9px]">
              {meta.size}
            </Badge>
          </div>

          <div className="flex items-center gap-1.5">
            <ClockIcon size={12} className="text-muted-foreground" />
            <span className="font-heading text-[10px] text-muted-foreground">
              {t("files.widget_refresh")}:
            </span>
            <Badge variant="outline" className="rounded-none text-[9px]">
              {refreshSec}s
            </Badge>
          </div>

          {meta.position && (
            <Badge variant="secondary" className="rounded-none text-[9px]">
              {meta.position}
            </Badge>
          )}

          {meta.created_by && (
            <Badge variant="secondary" className="rounded-none text-[9px]">
              {meta.created_by}
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}

export default WidgetPreviewView
