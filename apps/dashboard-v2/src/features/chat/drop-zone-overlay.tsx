import { memo, useState, useCallback, useRef, type ReactNode } from "react"
import { UploadSimpleIcon } from "@phosphor-icons/react"

interface DropZoneOverlayProps {
  onDrop: (files: File[]) => void
  children: ReactNode
}

/**
 * Wraps a chat area and shows a "Drop files here" overlay on drag-enter.
 * Fires `onDrop` with the dropped files.
 */
export const DropZoneOverlay = memo(function DropZoneOverlay({ onDrop, children }: DropZoneOverlayProps) {
  const [dragging, setDragging] = useState(false)
  const dragCounter = useRef(0)

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current++
    if (e.dataTransfer.types.includes("Files")) {
      setDragging(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      dragCounter.current = 0
      setDragging(false)
      if (e.dataTransfer.files.length > 0) {
        onDrop(Array.from(e.dataTransfer.files))
      }
    },
    [onDrop],
  )

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}

      {/* Overlay */}
      {dragging && (
        <div
          className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center rounded border-2 border-dashed border-primary/40 bg-primary/5"
          role="status"
          aria-label="Drop files here to upload"
        >
          <div className="flex flex-col items-center gap-2 text-primary/70">
            <UploadSimpleIcon size={32} />
            <span className="font-heading text-sm">Drop files here</span>
          </div>
        </div>
      )}
    </div>
  )
})
