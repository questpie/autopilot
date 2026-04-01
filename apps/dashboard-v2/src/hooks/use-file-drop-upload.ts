import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"
import { useUpload } from "@/hooks/use-upload"
import { useNativeFileDrop } from "@/hooks/use-native-file-drop"

/**
 * Combines native HTML5 file drop handling with file upload, toast
 * notifications, and query invalidation. Used by directory-listing,
 * file-tree, and file-tree-item to avoid repeating the same wiring.
 */
export function useFileDropUpload(targetPath: string) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { upload } = useUpload({
    targetPath: targetPath || "/",
    onComplete: (results) => {
      if (results.length > 0) {
        toast.success(t("upload.files_uploaded", { count: results.length }))
        void queryClient.invalidateQueries({ queryKey: queryKeys.files.root })
      }
    },
    onError: (error) => {
      toast.error(error)
    },
  })

  const handleFileDrop = useCallback(
    (files: File[]) => {
      void upload(files)
    },
    [upload],
  )

  const { isDragOver, dragHandlers } = useNativeFileDrop({ onDrop: handleFileDrop })

  return { isDragOver, dragHandlers, upload }
}
