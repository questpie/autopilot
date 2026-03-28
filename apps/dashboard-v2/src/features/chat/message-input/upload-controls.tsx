import { useRef } from "react"
import { PaperclipIcon } from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { UploadPreview } from "../upload-preview"
import type { useUpload } from "@/hooks/use-upload"

interface UploadPreviewBarProps {
  fileProgress: ReturnType<typeof useUpload>["fileProgress"]
  attachedFiles: string[]
  onRemoveAttached: (index: number) => void
}

/** Upload previews shown above the input area */
export function UploadPreviewBar({
  fileProgress,
  attachedFiles,
  onRemoveAttached,
}: UploadPreviewBarProps) {
  return (
    <UploadPreview
      items={[
        ...fileProgress,
        ...attachedFiles.map((path) => ({
          fileName: path.split("/").pop() ?? path,
          progress: 100,
          status: "complete" as const,
          path,
        })),
      ]}
      onRemove={(index) => {
        if (index >= fileProgress.length) {
          onRemoveAttached(index - fileProgress.length)
        }
      }}
    />
  )
}

interface FileAttachButtonProps {
  isUploading: boolean
  upload: ReturnType<typeof useUpload>["upload"]
}

/** Paperclip button + hidden file input for attachments */
export function FileAttachButton({ isUploading, upload }: FileAttachButtonProps) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="mb-1 shrink-0 p-1 text-muted-foreground transition-colors hover:text-foreground"
        title={t("files.upload")}
        aria-label={t("files.upload")}
      >
        <PaperclipIcon size={16} />
      </button>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        onChange={(e) => {
          if (e.target.files) {
            void upload(Array.from(e.target.files))
          }
          e.target.value = ""
        }}
      />
    </>
  )
}
