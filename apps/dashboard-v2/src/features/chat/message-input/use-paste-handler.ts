import { useState, useCallback } from "react"
import { useUpload } from "@/hooks/use-upload"

const LARGE_PASTE_THRESHOLD = 500

export function usePasteHandler(
  channelId: string,
  draft: string,
  setDraft: (channelId: string, value: string) => void,
  upload: ReturnType<typeof useUpload>["upload"],
) {
  const [showPastePrompt, setShowPastePrompt] = useState(false)
  const [pendingPaste, setPendingPaste] = useState("")

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
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

  return {
    showPastePrompt,
    pendingPaste,
    handlePaste,
    handlePasteAsText,
    handlePasteAsFile,
  }
}
