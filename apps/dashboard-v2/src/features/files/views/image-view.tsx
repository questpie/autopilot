import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { MagnifyingGlassPlusIcon, MagnifyingGlassMinusIcon, DownloadSimpleIcon, XIcon } from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { fileBlobQuery } from "../files.queries"
import type { FileViewProps } from "@/lib/view-registry"

/**
 * Image viewer with lightbox, zoom, and download.
 */
function ImageView({ path }: FileViewProps) {
  const { t } = useTranslation()
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [zoom, setZoom] = useState(1)

  const { data, isLoading } = useQuery(fileBlobQuery(path))

  const imageUrl = useMemo(() => {
    if (!data) return null
    return URL.createObjectURL(data.blob)
  }, [data])

  const handleDownload = () => {
    if (!imageUrl) return
    const a = document.createElement("a")
    a.href = imageUrl
    a.download = path.split("/").pop() ?? "image"
    a.click()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Skeleton className="h-64 w-64 rounded-none" />
      </div>
    )
  }

  if (!imageUrl) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-xs text-muted-foreground">{t("files.image_load_error")}</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col items-center gap-4 p-6">
        {/* Toolbar */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="gap-1 rounded-none font-heading text-[10px]"
          >
            <DownloadSimpleIcon size={12} />
            {t("files.download")}
          </Button>
        </div>

        {/* Image */}
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="max-w-full cursor-zoom-in border border-border transition-transform hover:scale-[1.01]"
        >
          <img
            src={imageUrl}
            alt={path.split("/").pop() ?? ""}
            className="max-h-[60vh] max-w-full object-contain"
            loading="lazy"
          />
        </button>
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => {
            setLightboxOpen(false)
            setZoom(1)
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setLightboxOpen(false)
              setZoom(1)
            }
          }}
          role="dialog"
          tabIndex={-1}
        >
          {/* Toolbar */}
          <div className="absolute right-4 top-4 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                setZoom((z) => Math.min(z + 0.25, 3))
              }}
              className="rounded-none"
            >
              <MagnifyingGlassPlusIcon size={14} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                setZoom((z) => Math.max(z - 0.25, 0.25))
              }}
              className="rounded-none"
            >
              <MagnifyingGlassMinusIcon size={14} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLightboxOpen(false)
                setZoom(1)
              }}
              className="rounded-none"
            >
              <XIcon size={14} />
            </Button>
          </div>

          <img
            src={imageUrl}
            alt={path.split("/").pop() ?? ""}
            className="max-h-[90vh] max-w-[90vw] object-contain transition-transform"
            style={{ transform: `scale(${zoom})` }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}

export default ImageView
