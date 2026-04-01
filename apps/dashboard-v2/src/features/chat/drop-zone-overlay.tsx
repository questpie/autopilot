import { memo, type ReactNode } from "react"
import { useNativeFileDrop } from "@/hooks/use-native-file-drop"
import { FileDropOverlay } from "@/components/file-drop-overlay"

interface DropZoneOverlayProps {
  onDrop: (files: File[]) => void
  children: ReactNode
}

/**
 * Wraps a chat area and shows a "Drop files here" overlay on drag-enter.
 * Fires `onDrop` with the dropped files.
 */
export const DropZoneOverlay = memo(function DropZoneOverlay({ onDrop, children }: DropZoneOverlayProps) {
  const { isDragOver, dragHandlers } = useNativeFileDrop({ onDrop })

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      {...dragHandlers}
    >
      {children}
      <FileDropOverlay visible={isDragOver} />
    </div>
  )
})
