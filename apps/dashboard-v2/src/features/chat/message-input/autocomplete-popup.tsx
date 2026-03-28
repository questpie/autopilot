import { MentionAutocomplete } from "../mention-autocomplete"
import { SlashCommandsDropdown } from "../slash-commands"
import type { AutocompleteMode } from "./use-autocomplete"

interface AutocompletePopupProps {
  mode: AutocompleteMode
  filter: string
  selectedIndex: number
  onMentionSelect: (mention: string) => void
  onSlashSelect: (command: string) => void
}

export function AutocompletePopup({
  mode,
  filter,
  selectedIndex,
  onMentionSelect,
  onSlashSelect,
}: AutocompletePopupProps) {
  if (mode === "mention") {
    return (
      <MentionAutocomplete
        filter={filter}
        selectedIndex={selectedIndex}
        onSelect={onMentionSelect}
      />
    )
  }

  if (mode === "slash") {
    return (
      <SlashCommandsDropdown
        filter={filter}
        selectedIndex={selectedIndex}
        onSelect={onSlashSelect}
      />
    )
  }

  return null
}
