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
  /** D16: Whether an active streaming session is in progress. */
  isStreaming?: boolean
  /** D16: Session ID of the active streaming session (for steering). */
  activeSessionId?: string | null
  /** D16: Callback to send a chat message via streaming (instead of channel message). */
  onStreamingSend?: (message: string) => void
}

export function MessageInput({
  channelId,
  compact = false,
  isStreaming,
  activeSessionId,
  onStreamingSend,
}: MessageInputProps) {
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

  // D16: Handle send or steer depending on streaming state
  const handleSendOrSteer = useCallback(() => {
    if (!draft.trim()) return
    if (isStreaming && activeSessionId) {
      // Steer the active session via the agent-sessions steer endpoint
      fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:7778"}/api/agent-sessions/${encodeURIComponent(activeSessionId)}/steer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: draft.trim() }),
      }).catch(() => {})
      clearDraft(channelId)
    } else if (onStreamingSend) {
      onStreamingSend(draft.trim())
      clearDraft(channelId)
    } else {
      handleSend()
    }
  }, [draft, isStreaming, activeSessionId, onStreamingSend, clearDraft, channelId, handleSend])

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
        handleSendOrSteer()
      }
    },
    [autocompleteMode, handleSend, setAutocompleteIndex, dismissAutocomplete],
  )

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
  }

  return (
    <div className="border-t border-border">
      {/* D16: Steering indicator */}
      {isStreaming && activeSessionId && (
        <div className="flex items-center gap-1.5 border-b border-border bg-primary/5 px-3 py-1 text-[10px] text-primary/70">
          <span className="inline-block size-1.5 animate-pulse rounded-full bg-primary/60" />
          Steering active session...
        </div>
      )}

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
          placeholder={isStreaming && activeSessionId ? "Steer the conversation..." : t("chat.type_message")}
          rows={1}
          className={cn(
            "flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/50",
            compact ? "max-h-[100px]" : "max-h-[200px]",
          )}
        />

        {/* Send button */}
        <Button
          size="icon-sm"
          onClick={handleSendOrSteer}
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
