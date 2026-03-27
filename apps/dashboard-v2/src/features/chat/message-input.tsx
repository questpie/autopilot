import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type KeyboardEvent,
} from "react"
import { PaperPlaneTiltIcon, PaperclipIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/lib/i18n"
import { useUpload } from "@/hooks/use-upload"
import { useChatUIStore } from "./chat-ui.store"
import { useSendMessage } from "./chat.mutations"
import { MentionAutocomplete } from "./mention-autocomplete"
import { SlashCommandsDropdown } from "./slash-commands"
import { UploadPreview } from "./upload-preview"
import { cn } from "@/lib/utils"

const LARGE_PASTE_THRESHOLD = 500

interface MessageInputProps {
  channelId: string
  compact?: boolean
}

type AutocompleteMode = "none" | "mention" | "slash"

export function MessageInput({ channelId, compact = false }: MessageInputProps) {
  const { t } = useTranslation()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const draft = useChatUIStore((s) => s.drafts[channelId] ?? "")
  const setDraft = useChatUIStore((s) => s.setDraft)
  const clearDraft = useChatUIStore((s) => s.clearDraft)

  const sendMessage = useSendMessage(channelId)

  const [autocompleteMode, setAutocompleteMode] = useState<AutocompleteMode>("none")
  const [autocompleteFilter, setAutocompleteFilter] = useState("")
  const [autocompleteIndex, setAutocompleteIndex] = useState(0)
  const [showPastePrompt, setShowPastePrompt] = useState(false)
  const [pendingPaste, setPendingPaste] = useState("")
  const [attachedFiles, setAttachedFiles] = useState<string[]>([])

  const { upload, fileProgress, isUploading } = useUpload({
    targetPath: `/uploads/chat/${new Date().toISOString().slice(0, 10)}/`,
    onComplete: (results) => {
      const paths = results.map((r) => r.path)
      setAttachedFiles((prev) => [...prev, ...paths])
    },
  })

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, compact ? 100 : 200)}px`
  }, [compact])

  useEffect(() => {
    adjustHeight()
  }, [draft, adjustHeight])

  const handleChange = useCallback(
    (value: string) => {
      setDraft(channelId, value)

      // Detect autocomplete triggers
      const cursorPos = textareaRef.current?.selectionStart ?? value.length
      const textBeforeCursor = value.slice(0, cursorPos)
      const lastAtPos = textBeforeCursor.lastIndexOf("@")
      const lastSlashPos = textBeforeCursor.lastIndexOf("/")
      const lastSpacePos = Math.max(
        textBeforeCursor.lastIndexOf(" "),
        textBeforeCursor.lastIndexOf("\n"),
      )

      if (lastAtPos > lastSpacePos && lastAtPos >= 0) {
        setAutocompleteMode("mention")
        setAutocompleteFilter(textBeforeCursor.slice(lastAtPos + 1))
        setAutocompleteIndex(0)
      } else if (
        lastSlashPos === 0 ||
        (lastSlashPos > lastSpacePos && lastSlashPos >= 0)
      ) {
        // Only slash commands at start of line or after space
        const lineStart =
          textBeforeCursor.lastIndexOf("\n") + 1
        const lineText = textBeforeCursor.slice(lineStart)
        if (lineText.startsWith("/")) {
          setAutocompleteMode("slash")
          setAutocompleteFilter(lineText.slice(1))
          setAutocompleteIndex(0)
        } else {
          setAutocompleteMode("none")
        }
      } else {
        setAutocompleteMode("none")
      }
    },
    [channelId, setDraft],
  )

  const handleSend = useCallback(() => {
    const content = draft.trim()
    if (!content && attachedFiles.length === 0) return

    // Append file references to content
    const fileRefs = attachedFiles.join("\n")
    const fullContent = fileRefs ? `${content}\n${fileRefs}` : content

    // Extract mentions from content
    const mentionRegex = /@(\w+)/g
    const mentions: string[] = []
    let match: RegExpExecArray | null = null
    while ((match = mentionRegex.exec(fullContent)) !== null) {
      mentions.push(match[1])
    }

    sendMessage.mutate({
      content: fullContent,
      mentions,
      references: attachedFiles,
    })

    clearDraft(channelId)
    setAttachedFiles([])
    setAutocompleteMode("none")

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }, [draft, attachedFiles, channelId, clearDraft, sendMessage])

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
          setAutocompleteMode("none")
          return
        }
        if (e.key === "Tab" || e.key === "Enter") {
          // Let the autocomplete handle selection
          // This is handled by the select callbacks
          if (autocompleteMode !== "none") {
            e.preventDefault()
            // Trigger selection of current index
            return
          }
        }
      }

      // Enter sends, Shift+Enter newline
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [autocompleteMode, handleSend],
  )

  const handleMentionSelect = useCallback(
    (mention: string) => {
      const cursorPos = textareaRef.current?.selectionStart ?? draft.length
      const textBeforeCursor = draft.slice(0, cursorPos)
      const lastAtPos = textBeforeCursor.lastIndexOf("@")

      if (lastAtPos >= 0) {
        const newText =
          draft.slice(0, lastAtPos) + `@${mention} ` + draft.slice(cursorPos)
        setDraft(channelId, newText)
      }
      setAutocompleteMode("none")
      textareaRef.current?.focus()
    },
    [draft, channelId, setDraft],
  )

  const handleSlashSelect = useCallback(
    (command: string) => {
      const cursorPos = textareaRef.current?.selectionStart ?? draft.length
      const textBeforeCursor = draft.slice(0, cursorPos)
      const lineStart = textBeforeCursor.lastIndexOf("\n") + 1
      const newText =
        draft.slice(0, lineStart) + `${command} ` + draft.slice(cursorPos)
      setDraft(channelId, newText)
      setAutocompleteMode("none")
      textareaRef.current?.focus()
    },
    [draft, channelId, setDraft],
  )

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      // Handle image paste
      const items = e.clipboardData.items
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          e.preventDefault()
          const file = items[i].getAsFile()
          if (file) {
            void upload([file])
          }
          return
        }
      }

      // Handle large text paste
      const text = e.clipboardData.getData("text")
      if (text.length > LARGE_PASTE_THRESHOLD) {
        e.preventDefault()
        setPendingPaste(text)
        setShowPastePrompt(true)
      }
    },
    [upload],
  )

  const handlePasteAsText = useCallback(() => {
    setDraft(channelId, draft + pendingPaste)
    setShowPastePrompt(false)
    setPendingPaste("")
  }, [channelId, draft, pendingPaste, setDraft])

  const handlePasteAsFile = useCallback(() => {
    const blob = new Blob([pendingPaste], { type: "text/plain" })
    const file = new File([blob], `paste-${Date.now()}.txt`, {
      type: "text/plain",
    })
    void upload([file])
    setShowPastePrompt(false)
    setPendingPaste("")
  }, [pendingPaste, upload])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLTextAreaElement>) => {
      e.preventDefault()
      if (e.dataTransfer.files.length > 0) {
        void upload(Array.from(e.dataTransfer.files))
      }
    },
    [upload],
  )

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
  }

  return (
    <div className="border-t border-border">
      {/* Upload previews */}
      <UploadPreview
        items={[
          ...fileProgress,
          ...attachedFiles.map((path) => ({
            fileName: path.split("/").pop() ?? path,
            progress: 100,
            status: "complete" as const,
            path,
          })),
        ]}
        onRemove={(index) => {
          if (index >= fileProgress.length) {
            setAttachedFiles((prev) =>
              prev.filter((_, i) => i !== index - fileProgress.length),
            )
          }
        }}
      />

      {/* Large paste prompt */}
      {showPastePrompt && (
        <div className="flex items-center gap-2 border-t border-border bg-muted/30 px-3 py-2 text-xs">
          <span className="flex-1 text-muted-foreground">
            {t("chat.paste_large_prompt")}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={handlePasteAsText}
            className="h-6 text-[10px]"
          >
            {t("chat.paste_as_text")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handlePasteAsFile}
            className="h-6 text-[10px]"
          >
            {t("chat.paste_as_file")}
          </Button>
        </div>
      )}

      {/* Input area */}
      <div className="relative flex items-end gap-2 px-3 py-2">
        {/* Autocomplete dropdowns */}
        {autocompleteMode === "mention" && (
          <MentionAutocomplete
            filter={autocompleteFilter}
            selectedIndex={autocompleteIndex}
            onSelect={handleMentionSelect}
          />
        )}
        {autocompleteMode === "slash" && (
          <SlashCommandsDropdown
            filter={autocompleteFilter}
            selectedIndex={autocompleteIndex}
            onSelect={handleSlashSelect}
          />
        )}

        {/* PaperclipIcon for file attachment */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="mb-1 shrink-0 p-1 text-muted-foreground transition-colors hover:text-foreground"
          title={t("files.upload")}
        >
          <PaperclipIcon size={16} />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          onChange={(e) => {
            if (e.target.files) {
              void upload(Array.from(e.target.files))
            }
            e.target.value = ""
          }}
        />

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          placeholder={t("chat.type_message")}
          rows={1}
          className={cn(
            "flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/50",
            compact ? "max-h-[100px]" : "max-h-[200px]",
          )}
        />

        {/* Send button */}
        <Button
          size="icon-sm"
          onClick={handleSend}
          disabled={(!draft.trim() && attachedFiles.length === 0) || sendMessage.isPending}
          className="mb-0.5 shrink-0"
          title={t("chat.send")}
        >
          <PaperPlaneTiltIcon size={14} />
        </Button>
      </div>
    </div>
  )
}
