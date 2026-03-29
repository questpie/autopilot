import { useCallback, type KeyboardEvent } from "react"

interface UseInputKeyboardOptions {
  autocompleteMode: string
  setAutocompleteIndex: (fn: (prev: number) => number) => void
  dismissAutocomplete: () => void
  onSend: () => void
}

export function useInputKeyboard({
  autocompleteMode,
  setAutocompleteIndex,
  dismissAutocomplete,
  onSend,
}: UseInputKeyboardOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (autocompleteMode !== "none") {
        if (e.key === "ArrowUp") {
          e.preventDefault()
          setAutocompleteIndex((prev) => Math.max(0, prev - 1))
          return
        }
        if (e.key === "ArrowDown") {
          e.preventDefault()
          setAutocompleteIndex((prev) => prev + 1)
          return
        }
        if (e.key === "Escape") {
          e.preventDefault()
          dismissAutocomplete()
          return
        }
        if (e.key === "Tab" || e.key === "Enter") {
          e.preventDefault()
          return
        }
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        onSend()
      }
    },
    [autocompleteMode, onSend, setAutocompleteIndex, dismissAutocomplete],
  )

  return { handleKeyDown }
}
