import { useState, useRef, useCallback } from "react"
import { useTranslation } from "@/lib/i18n"
import { useUpload } from "@/hooks/use-upload"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  UploadSimpleIcon,
  File as FileIcon,
  FolderIcon,
  CheckCircleIcon,
  XCircleIcon,
  FileZipIcon,
} from "@phosphor-icons/react"

const ACCEPTED_EXTENSIONS = [
  ".md", ".pdf", ".txt", ".yaml", ".yml", ".json", ".csv",
  ".png", ".jpg", ".jpeg", ".svg", ".zip",
]

const ACCEPTED_MIME_TYPES = [
  "text/markdown", "application/pdf", "text/plain",
  "application/x-yaml", "text/yaml", "application/json", "text/csv",
  "image/png", "image/jpeg", "image/svg+xml",
  "application/zip", "application/x-zip-compressed",
]

interface FileUploadProps {
  /** Target upload path */
  targetPath?: string
  /** Called with uploaded file paths on completion */
  onUpload?: (paths: string[]) => void
  /** Whether to show the folder upload option */
  showFolderUpload?: boolean
  /** Max single file size in MB */
  maxFileSizeMB?: number
  /** Max batch size in MB */
  maxBatchSizeMB?: number
  /** Additional class names */
  className?: string
  /** Accepted file extensions override */
  accept?: string[]
  /** Compact mode for inline use */
  compact?: boolean
}

export function FileUpload({
  targetPath = "/",
  onUpload,
  showFolderUpload = true,
  maxFileSizeMB = 50,
  maxBatchSizeMB = 200,
  className,
  accept,
  compact = false,
}: FileUploadProps) {
  const { t } = useTranslation()
  const [isDragActive, setIsDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const { upload, fileProgress, isUploading } = useUpload({
    targetPath,
    maxFileSizeMB,
    maxBatchSizeMB,
    onComplete: (results) => {
      onUpload?.(results.map((r) => r.path))
    },
    onError: setError,
  })

  const acceptedExtensions = accept ?? ACCEPTED_EXTENSIONS

  const isValidFile = useCallback(
    (file: File) => {
      const ext = `.${file.name.split(".").pop()?.toLowerCase()}`
      return acceptedExtensions.includes(ext) || ACCEPTED_MIME_TYPES.includes(file.type)
    },
    [acceptedExtensions]
  )

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      setError(null)
      const files = Array.from(fileList).filter(isValidFile)

      if (files.length === 0) {
        setError(t("upload.unsupported_type", { type: "selected files" }))
        return
      }

      await upload(files)
    },
    [isValidFile, upload, t]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragActive(false)

      if (e.dataTransfer.files.length > 0) {
        void handleFiles(e.dataTransfer.files)
      }
    },
    [handleFiles]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragActive(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragActive(false)
  }, [])

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items
      const files: File[] = []

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.kind === "file") {
          const file = item.getAsFile()
          if (file) files.push(file)
        }
      }

      if (files.length > 0) {
        e.preventDefault()
        void handleFiles(files)
      }
    },
    [handleFiles]
  )

  const acceptString = acceptedExtensions.join(",")

  return (
    <div
      className={cn("flex flex-col gap-3", className)}
      onPaste={handlePaste}
    >
      {/* Drop zone */}
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 border-2 border-dashed p-6 transition-colors",
          compact && "p-3",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-primary/20 hover:border-primary/40",
          isUploading && "pointer-events-none opacity-60",
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        role="button"
        tabIndex={0}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            fileInputRef.current?.click()
          }
        }}
      >
        <UploadSimpleIcon className={cn("text-muted-foreground", compact ? "size-5" : "size-8")} />
        <p className="text-center text-xs text-muted-foreground">
          {isDragActive ? t("upload.drag_active") : t("upload.drag_drop")}
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          <FileIcon className="size-3.5" />
          {t("upload.browse_files")}
        </Button>

        {showFolderUpload && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => folderInputRef.current?.click()}
            disabled={isUploading}
          >
            <FolderIcon className="size-3.5" />
            {t("upload.upload_folder")}
          </Button>
        )}
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={acceptString}
        multiple
        onChange={(e) => {
          if (e.target.files) void handleFiles(e.target.files)
          e.target.value = ""
        }}
      />
      <input
        ref={folderInputRef}
        type="file"
        className="hidden"
        // @ts-expect-error -- webkitdirectory is not in the standard types
        webkitdirectory=""
        multiple
        onChange={(e) => {
          if (e.target.files) void handleFiles(e.target.files)
          e.target.value = ""
        }}
      />

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <XCircleIcon className="size-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Progress list */}
      {fileProgress.length > 0 && (
        <div className="flex flex-col gap-1">
          {fileProgress.map((fp, i) => (
            <div key={`${fp.fileName}-${i}`} className="flex items-center gap-2 text-xs">
              {fp.status === "complete" ? (
                <CheckCircleIcon className="size-3.5 text-green-500" />
              ) : fp.status === "error" ? (
                <XCircleIcon className="size-3.5 text-destructive" />
              ) : fp.status === "extracting" ? (
                <FileZipIcon className="size-3.5 text-primary" />
              ) : (
                <Spinner size="sm" />
              )}
              <span className="flex-1 truncate text-muted-foreground">
                {fp.fileName}
              </span>
              {fp.status === "uploading" && (
                <span className="text-muted-foreground">{t("upload.uploading")}</span>
              )}
              {fp.status === "extracting" && (
                <span className="text-primary">{t("upload.extracting")}</span>
              )}
              {fp.status === "complete" && (
                <span className="text-green-500">{t("upload.upload_complete")}</span>
              )}
              {fp.status === "error" && (
                <span className="text-destructive">{fp.error ?? t("upload.upload_failed")}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
