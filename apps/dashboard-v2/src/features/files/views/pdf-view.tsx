import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { DownloadSimpleIcon, ArrowSquareOutIcon } from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { fileBlobQuery } from "../files.queries"
import type { FileViewProps } from "@/lib/view-registry"

/**
 * PDF viewer — embedded viewer with download and open-in-new-tab options.
 */
function PdfView({ path }: FileViewProps) {
  const { t } = useTranslation()
  const { data, isLoading } = useQuery(fileBlobQuery(path))

  const pdfUrl = useMemo(() => {
    if (!data) return null
    return URL.createObjectURL(data.blob)
  }, [data])

  const handleDownload = () => {
    if (!pdfUrl) return
    const a = document.createElement("a")
    a.href = pdfUrl
    a.download = path.split("/").pop() ?? "document.pdf"
    a.click()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Skeleton className="h-96 w-full rounded-none" />
      </div>
    )
  }

  if (!pdfUrl) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-xs text-muted-foreground">{t("files.pdf_load_error")}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          className="gap-1 rounded-none font-heading text-[10px]"
        >
          <DownloadSimpleIcon size={12} />
          {t("files.download")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(pdfUrl, "_blank")}
          className="gap-1 rounded-none font-heading text-[10px]"
        >
          <ArrowSquareOutIcon size={12} />
          {t("files.open_new_tab")}
        </Button>
      </div>

      {/* Embedded PDF */}
      <iframe
        src={pdfUrl}
        title={path.split("/").pop() ?? "PDF"}
        className="h-[80vh] w-full border-0"
      />
    </div>
  )
}

export default PdfView
