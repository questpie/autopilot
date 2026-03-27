import { useEffect, useCallback } from "react"
import { tinykeys } from "tinykeys"

type KeyBindings = Record<string, (event: KeyboardEvent) => void>

/**
 * Returns true when focus is inside a text input, textarea, or contenteditable.
 * Used to suppress shortcuts while typing.
 */
function isTyping(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  if (tag === "input" || tag === "textarea" || tag === "select") return true
  if ((el as HTMLElement).isContentEditable) return true
  return false
}

/**
 * Wraps a handler to skip execution when user is typing in an input field.
 */
export function whenNotTyping(handler: (e: KeyboardEvent) => void) {
  return (e: KeyboardEvent) => {
    if (isTyping()) return
    handler(e)
  }
}

/**
 * Hook wrapping tinykeys for declarative keyboard shortcuts.
 * Bindings are cleaned up on unmount.
 */
export function useKeyboardShortcuts(bindings: KeyBindings) {
  useEffect(() => {
    const unsubscribe = tinykeys(window, bindings)
    return () => {
      unsubscribe()
    }
    // Re-bind when bindings object identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bindings])
}

/**
 * Hook that registers all global application keyboard shortcuts.
 * Should be called once in the app shell.
 */
export function useGlobalShortcuts({
  onCommandPalette,
  onToggleChat,
  onOpenInbox,
  onShowHelp,
  onCreateNew,
  onNavigate,
}: {
  onCommandPalette: () => void
  onToggleChat: () => void
  onOpenInbox: () => void
  onShowHelp: () => void
  onCreateNew: () => void
  onNavigate: (path: string) => void
}) {
  const bindings = useCallback(
    (): KeyBindings => ({
      // Global shortcuts (work even while typing for mod keys)
      "$mod+KeyK": (e: KeyboardEvent) => {
        e.preventDefault()
        onCommandPalette()
      },
      "$mod+Shift+KeyC": (e: KeyboardEvent) => {
        e.preventDefault()
        onToggleChat()
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

      // Chord navigation shortcuts (g then letter)
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
      "g c": whenNotTyping((e) => {
        e.preventDefault()
        onNavigate("/chat")
      }),

      // Help overlay
      "?": whenNotTyping((e) => {
        e.preventDefault()
        onShowHelp()
      }),
    }),
    [onCommandPalette, onToggleChat, onOpenInbox, onShowHelp, onCreateNew, onNavigate],
  )

  useKeyboardShortcuts(bindings())
}
