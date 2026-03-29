import { memo, useCallback, useEffect, useRef, useState } from "react"

interface MessageEditorProps {
  initialContent: string
  onSave: (content: string) => void
  onCancel: () => void
  isSaving?: boolean
}

export const MessageEditor = memo(function MessageEditor({
  initialContent,
  onSave,
  onCancel,
  isSaving = false,
}: MessageEditorProps) {
  const [content, setContent] = useState(initialContent)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])

  // Auto-resize
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [content])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onCancel()
        return
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        const trimmed = content.trim()
        if (trimmed && trimmed !== initialContent) {
          onSave(trimmed)
        } else {
          onCancel()
        }
      }
    },
    [content, initialContent, onSave, onCancel],
  )

  const handleSave = useCallback(() => {
    const trimmed = content.trim()
    if (trimmed && trimmed !== initialContent) {
      onSave(trimmed)
    } else {
      onCancel()
    }
  }, [content, initialContent, onSave, onCancel])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value),
    [],
  )

  return (
    <div className="flex flex-col gap-1">
      <div className="rounded border border-primary/30 bg-background">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          aria-label="Edit message"
          className="w-full resize-none bg-transparent px-2 py-1.5 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50"
          rows={1}
        />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground">
          escape to{" "}
          <button
            type="button"
            onClick={onCancel}
            className="text-primary hover:underline"
          >
            cancel
          </button>
          {" "}&middot; enter to{" "}
          <button
            type="button"
            onClick={handleSave}
            className="text-primary hover:underline"
          >
            save
          </button>
        </span>
      </div>
    </div>
  )
})
