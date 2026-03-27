import { useCallback, useMemo, useState } from "react"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"

interface UseTaskKeyboardNavOptions {
  taskIds: string[]
  onOpenTask: (id: string) => void
  onToggleSelection: (id: string) => void
  onClearSelection: () => void
  enabled?: boolean
}

export function useTaskKeyboardNav({
  taskIds,
  onOpenTask,
  onToggleSelection,
  onClearSelection,
  enabled = true,
}: UseTaskKeyboardNavOptions) {
  const [focusedIndex, setFocusedIndex] = useState(-1)

  const moveDown = useCallback(() => {
    if (!enabled || taskIds.length === 0) return
    setFocusedIndex((prev) => Math.min(prev + 1, taskIds.length - 1))
  }, [enabled, taskIds.length])

  const moveUp = useCallback(() => {
    if (!enabled || taskIds.length === 0) return
    setFocusedIndex((prev) => Math.max(prev - 1, 0))
  }, [enabled, taskIds.length])

  const openFocused = useCallback(() => {
    if (!enabled || focusedIndex < 0 || focusedIndex >= taskIds.length) return
    const id = taskIds[focusedIndex]
    if (id) onOpenTask(id)
  }, [enabled, focusedIndex, taskIds, onOpenTask])

  const selectFocused = useCallback(() => {
    if (!enabled || focusedIndex < 0 || focusedIndex >= taskIds.length) return
    const id = taskIds[focusedIndex]
    if (id) onToggleSelection(id)
  }, [enabled, focusedIndex, taskIds, onToggleSelection])

  const clearSelection = useCallback(() => {
    if (!enabled) return
    onClearSelection()
    setFocusedIndex(-1)
  }, [enabled, onClearSelection])

  const bindings = useMemo(
    () =>
      enabled
        ? {
            j: (e: KeyboardEvent) => {
              // Only handle if not in an input
              if (
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement
              )
                return
              e.preventDefault()
              moveDown()
            },
            k: (e: KeyboardEvent) => {
              if (
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement
              )
                return
              e.preventDefault()
              moveUp()
            },
            Enter: (e: KeyboardEvent) => {
              if (
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement
              )
                return
              e.preventDefault()
              openFocused()
            },
            x: (e: KeyboardEvent) => {
              if (
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement
              )
                return
              e.preventDefault()
              selectFocused()
            },
            Escape: (e: KeyboardEvent) => {
              e.preventDefault()
              clearSelection()
            },
          }
        : {},
    [enabled, moveDown, moveUp, openFocused, selectFocused, clearSelection],
  )

  useKeyboardShortcuts(bindings)

  return { focusedIndex, setFocusedIndex }
}
