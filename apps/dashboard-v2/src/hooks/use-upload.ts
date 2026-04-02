import { useState, useCallback } from "react"
import { api } from "@/lib/api"

interface UploadProgress {
  fileName: string
  size: number
  progress: number
  status: "uploading" | "extracting" | "complete" | "error"
  error?: string
}

interface UploadResult {
  path: string
  fileName: string
}

interface UseUploadOptions {
  /** Target directory path for uploads */
  targetPath?: string
  /** Maximum single file size in MB */
  maxFileSizeMB?: number
  /** Maximum total batch size in MB */
  maxBatchSizeMB?: number
  /** Called when all uploads complete */
  onComplete?: (results: UploadResult[]) => void
  /** Called on error */
  onError?: (error: string) => void
}

export function useUpload(options: UseUploadOptions = {}) {
  const {
    targetPath = "/",
    maxFileSizeMB = 50,
    maxBatchSizeMB = 200,
    onComplete,
    onError,
  } = options

  const [fileProgress, setFileProgress] = useState<UploadProgress[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const validateFiles = useCallback(
    (files: File[]): string | null => {
      const maxSingle = maxFileSizeMB * 1024 * 1024
      const maxBatch = maxBatchSizeMB * 1024 * 1024

      let totalSize = 0
      for (const file of files) {
        if (file.size > maxSingle) {
          return `File "${file.name}" exceeds maximum size of ${maxFileSizeMB}MB`
        }
        totalSize += file.size
      }

      if (totalSize > maxBatch) {
        return `Total upload size exceeds ${maxBatchSizeMB}MB`
      }

      return null
    },
    [maxFileSizeMB, maxBatchSizeMB]
  )

  const upload = useCallback(
    async (files: File[], targetPathOverride?: string) => {
      const validationError = validateFiles(files)
      if (validationError) {
        onError?.(validationError)
        return []
      }

      setIsUploading(true)
      const results: UploadResult[] = []

      const initialProgress: UploadProgress[] = files.map((f) => ({
        fileName: f.name,
        size: f.size,
        progress: 0,
        status: f.name.endsWith(".zip") ? "extracting" : "uploading",
      }))
      setFileProgress(initialProgress)

      for (let i = 0; i < files.length; i++) {
        const file = files[i]

        try {
          const formData = new FormData()
          formData.append("file", file)
          formData.append("path", targetPathOverride ?? targetPath)

          // Upload endpoint reads formData directly (no zValidator),
          // so we use the Hono client's $url() for the typed path
          // and pass the FormData body via init override.
          const response = await api.api.upload.$post(
            {} as never,
            { init: { body: formData } },
          )

          if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`)
          }

          const data = await response.json()

          setFileProgress((prev) =>
            prev.map((p, j) =>
              j === i ? { ...p, progress: 100, status: "complete" as const } : p
            )
          )

          results.push({ path: data.path, fileName: file.name })
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Upload failed"
          setFileProgress((prev) =>
            prev.map((p, j) =>
              j === i
                ? { ...p, status: "error" as const, error: errorMsg }
                : p
            )
          )
        }
      }

      setIsUploading(false)
      onComplete?.(results)
      return results
    },
    [validateFiles, targetPath, onComplete, onError]
  )

  const reset = useCallback(() => {
    setFileProgress([])
    setIsUploading(false)
  }, [])

  return {
    upload,
    fileProgress,
    isUploading,
    reset,
  }
}
