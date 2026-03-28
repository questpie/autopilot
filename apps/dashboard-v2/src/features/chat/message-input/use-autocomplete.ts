import { useState, useCallback, type RefObject } from "react"

export type AutocompleteMode = "none" | "mention" | "slash"

export function useAutocomplete(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  channelId: string,
  setDraft: (channelId: string, value: string) => void,
  draft: string,
) {
  const [autocompleteMode, setAutocompleteMode] =
    useState<AutocompleteMode>("none")
  const [autocompleteFilter, setAutocompleteFilter] = useState("")
  const [autocompleteIndex, setAutocompleteIndex] = useState(0)

  const detectAutocomplete = useCallback(
    (value: string) => {
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
        const lineStart = textBeforeCursor.lastIndexOf("\n") + 1
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
    [textareaRef],
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
    [draft, channelId, setDraft, textareaRef],
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
    [draft, channelId, setDraft, textareaRef],
  )

  const dismissAutocomplete = useCallback(() => {
    setAutocompleteMode("none")
  }, [])

  return {
    autocompleteMode,
    autocompleteFilter,
    autocompleteIndex,
    setAutocompleteIndex,
    detectAutocomplete,
    handleMentionSelect,
    handleSlashSelect,
    dismissAutocomplete,
  }
}
