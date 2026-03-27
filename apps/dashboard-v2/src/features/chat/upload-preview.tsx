import { XIcon, FileIcon } from "@phosphor-icons/react"
import { Spinner } from "@/components/ui/spinner"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"

interface UploadItem {
  fileName: string
  progress: number
  status: "uploading" | "extracting" | "complete" | "error"
  path?: string
}

interface UploadPreviewProps {
  items: UploadItem[]
  onRemove?: (index: number) => void
  className?: string
}

export function UploadPreview({ items, onRemove, className }: UploadPreviewProps) {
  const { t } = useTranslation()

  if (items.length === 0) return null

  return (
    <div className={cn("flex flex-wrap gap-1 px-3 py-1.5 border-t border-border", className)}>
      {items.map((item, i) => (
        <div
          key={`${item.fileName}-${i}`}
          className={cn(
            "flex items-center gap-1.5 border px-2 py-1 text-[10px]",
            item.status === "error"
              ? "border-destructive/30 bg-destructive/5 text-destructive"
              : item.status === "complete"
                ? "border-green-500/30 bg-green-500/5 text-green-500"
                : "border-border bg-muted/30 text-muted-foreground",
          )}
        >
          {item.status === "uploading" || item.status === "extracting" ? (
            <Spinner size="sm" />
          ) : (
            <FileIcon size={12} />
          )}
          <span className="max-w-[120px] truncate font-heading">{item.fileName}</span>
          {item.status === "uploading" && (
            <span>{t("chat.upload_progress")}</span>
          )}
          {onRemove && item.status !== "uploading" && (
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="ml-0.5 hover:text-foreground"
            >
              <XIcon size={10} />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
