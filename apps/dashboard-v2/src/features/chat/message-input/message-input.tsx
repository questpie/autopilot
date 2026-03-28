import { useRef, useCallback, useEffect, type KeyboardEvent } from "react"
import { PaperPlaneTiltIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/lib/i18n"
import { useChatUIStore } from "../chat-ui.store"
import { cn } from "@/lib/utils"
import { useAutocomplete } from "./use-autocomplete"
import { usePasteHandler } from "./use-paste-handler"
import { useMessageSend } from "./use-message-send"
import { AutocompletePopup } from "./autocomplete-popup"
import { UploadPreviewBar, FileAttachButton } from "./upload-controls"

interface MessageInputProps {
  channelId: string
  compact?: boolean
}

export function MessageInput({ channelId, compact = false }: MessageInputProps) {
  const { t } = useTranslation()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const draft = useChatUIStore((s) => s.drafts[channelId] ?? "")
  const setDraft = useChatUIStore((s) => s.setDraft)
  const clearDraft = useChatUIStore((s) => s.clearDraft)

  const {
    autocompleteMode,
    autocompleteFilter,
    autocompleteIndex,
    setAutocompleteIndex,
    detectAutocomplete,
    handleMentionSelect,
    handleSlashSelect,
    dismissAutocomplete,
  } = useAutocomplete(textareaRef, channelId, setDraft, draft)

  const {
    attachedFiles,
    upload,
    fileProgress,
    isUploading,
    sendMessage,
    handleSend,
    handleDrop,
    removeAttachedFile,
  } = useMessageSend(channelId, draft, clearDraft, textareaRef, dismissAutocomplete)

  const { showPastePrompt, handlePaste, handlePasteAsText, handlePasteAsFile } =
    usePasteHandler(channelId, draft, setDraft, upload)

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
      detectAutocomplete(value)
    },
    [channelId, setDraft, detectAutocomplete],
  )

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
        handleSend()
      }
    },
    [autocompleteMode, handleSend, setAutocompleteIndex, dismissAutocomplete],
  )

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
  }

  return (
    <div className="border-t border-border">
      {/* Upload previews */}
      <UploadPreviewBar
        fileProgress={fileProgress}
        attachedFiles={attachedFiles}
        onRemoveAttached={removeAttachedFile}
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
        <AutocompletePopup
          mode={autocompleteMode}
          filter={autocompleteFilter}
          selectedIndex={autocompleteIndex}
          onMentionSelect={handleMentionSelect}
          onSlashSelect={handleSlashSelect}
        />

        {/* PaperclipIcon for file attachment */}
        <FileAttachButton isUploading={isUploading} upload={upload} />

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
          disabled={
            (!draft.trim() && attachedFiles.length === 0) ||
            sendMessage.isPending
          }
          className="mb-0.5 shrink-0"
          title={t("chat.send")}
          aria-label={t("chat.send")}
        >
          <PaperPlaneTiltIcon size={14} />
        </Button>
      </div>
    </div>
  )
}
