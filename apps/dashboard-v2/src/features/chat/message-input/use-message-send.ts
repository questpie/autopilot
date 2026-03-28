import { useState, useCallback, type RefObject } from "react"
import { useUpload } from "@/hooks/use-upload"
import { useHapticPattern } from "@/hooks/use-haptic"
import { useSendMessage } from "../chat.mutations"

export function useMessageSend(
  channelId: string,
  draft: string,
  clearDraft: (channelId: string) => void,
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  dismissAutocomplete: () => void,
) {
  const sendMessage = useSendMessage(channelId)
  const { trigger: haptic } = useHapticPattern()
  const [attachedFiles, setAttachedFiles] = useState<string[]>([])

  const { upload, fileProgress, isUploading } = useUpload({
    targetPath: `/uploads/chat/${new Date().toISOString().slice(0, 10)}/`,
    onComplete: (results) => {
      const paths = results.map((r) => r.path)
      setAttachedFiles((prev) => [...prev, ...paths])
    },
  })

  const handleSend = useCallback(() => {
    const content = draft.trim()
    if (!content && attachedFiles.length === 0) return
    haptic("tap")

    const fileRefs = attachedFiles.join("\n")
    const fullContent = fileRefs ? `${content}\n${fileRefs}` : content

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
    dismissAutocomplete()

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }, [
    draft,
    attachedFiles,
    channelId,
    clearDraft,
    sendMessage,
    haptic,
    textareaRef,
    dismissAutocomplete,
  ])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLTextAreaElement>) => {
      e.preventDefault()
      if (e.dataTransfer.files.length > 0) {
        void upload(Array.from(e.dataTransfer.files))
      }
    },
    [upload],
  )

  const removeAttachedFile = useCallback(
    (index: number) => {
      setAttachedFiles((prev) => prev.filter((_, i) => i !== index))
    },
    [],
  )

  return {
    attachedFiles,
    upload,
    fileProgress,
    isUploading,
    sendMessage,
    handleSend,
    handleDrop,
    removeAttachedFile,
  }
}
