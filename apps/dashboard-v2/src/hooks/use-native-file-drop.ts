import { useState, useCallback, useRef } from "react"

interface UseNativeFileDropOptions {
  onDrop: (files: File[]) => void
}

/**
 * Hook for handling native HTML5 file drag-and-drop.
 * Uses a drag counter to correctly track nested dragenter/dragleave events.
 */
export function useNativeFileDrop({ onDrop }: UseNativeFileDropOptions) {
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounter = useRef(0)

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current++
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOver(true)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setIsDragOver(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      dragCounter.current = 0
      setIsDragOver(false)
      if (e.dataTransfer.files.length > 0) {
        onDrop(Array.from(e.dataTransfer.files))
      }
    },
    [onDrop],
  )

  return {
    isDragOver,
    dragHandlers: {
      onDragEnter: handleDragEnter,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    },
  }
}
