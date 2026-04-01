import { useEffect, useCallback } from "react"
import { tinykeys } from "tinykeys"

type KeyBindings = Record<string, (event: KeyboardEvent) => void>

function isTyping(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  if (tag === "input" || tag === "textarea" || tag === "select") return true
  if ((el as HTMLElement).isContentEditable) return true
  return false
}

export function whenNotTyping(handler: (e: KeyboardEvent) => void) {
  return (e: KeyboardEvent) => {
    if (isTyping()) return
    handler(e)
  }
}

export function useKeyboardShortcuts(bindings: KeyBindings) {
  useEffect(() => {
    const unsubscribe = tinykeys(window, bindings)
    return () => {
      unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bindings])
}

export function useGlobalShortcuts({
  onCommandPalette,
  onOpenInbox,
  onShowHelp,
  onCreateNew,
  onNavigate,
}: {
  onCommandPalette: () => void
  onOpenInbox: () => void
  onShowHelp: () => void
  onCreateNew: () => void
  onNavigate: (path: string) => void
}) {
  const bindings = useCallback(
    (): KeyBindings => ({
      "$mod+KeyK": (e: KeyboardEvent) => {
        e.preventDefault()
        onCommandPalette()
      },
      "$mod+Shift+KeyI": (e: KeyboardEvent) => {
        e.preventDefault()
        onOpenInbox()
      },
      "$mod+Shift+KeyN": (e: KeyboardEvent) => {
        e.preventDefault()
        onCreateNew()
      },
      "$mod+Enter": (e: KeyboardEvent) => {
        e.preventDefault()
        onCreateNew()
      },

      "g d": whenNotTyping((e) => {
        e.preventDefault()
        onNavigate("/")
      }),
      "g t": whenNotTyping((e) => {
        e.preventDefault()
        onNavigate("/tasks")
      }),
      "g a": whenNotTyping((e) => {
        e.preventDefault()
        onNavigate("/team")
      }),
      "g f": whenNotTyping((e) => {
        e.preventDefault()
        onNavigate("/files")
      }),

      "?": whenNotTyping((e) => {
        e.preventDefault()
        onShowHelp()
      }),
    }),
    [onCommandPalette, onOpenInbox, onShowHelp, onCreateNew, onNavigate],
  )

  useKeyboardShortcuts(bindings())
}
