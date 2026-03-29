import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { PlusIcon } from "@phosphor-icons/react"
import { memo, useCallback, useState } from "react"

const EMOJI_SET = [
  { emoji: "\ud83d\udc4d", label: "Thumbs up" },
  { emoji: "\ud83d\udc4e", label: "Thumbs down" },
  { emoji: "\u2764\ufe0f", label: "Heart" },
  { emoji: "\ud83d\udd25", label: "Fire" },
  { emoji: "\ud83d\udc40", label: "Eyes" },
  { emoji: "\ud83d\ude80", label: "Rocket" },
  { emoji: "\u2705", label: "Check" },
  { emoji: "\u274c", label: "X" },
  { emoji: "\ud83e\udd14", label: "Thinking" },
  { emoji: "\ud83c\udf89", label: "Party" },
] as const

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  /** Custom trigger element. Defaults to a [+] button. */
  trigger?: React.ReactNode
}

export const EmojiPicker = memo(function EmojiPicker({ onSelect, trigger }: EmojiPickerProps) {
  const [open, setOpen] = useState(false)

  const handleSelect = useCallback(
    (emoji: string) => {
      onSelect(emoji)
      setOpen(false)
    },
    [onSelect],
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          trigger ? (
            <button type="button">{trigger}</button>
          ) : (
            <button
              type="button"
              className="flex size-6 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              <PlusIcon size={12} />
            </button>
          )
        }
      />
      <PopoverContent side="top" sideOffset={4} className="w-auto p-1.5">
        <div className="grid grid-cols-5 gap-0.5">
          {EMOJI_SET.map(({ emoji, label }) => (
            <button
              key={emoji}
              type="button"
              title={label}
              onClick={() => handleSelect(emoji)}
              className="flex size-8 items-center justify-center rounded text-base transition-colors hover:bg-muted/60"
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
})

export { EMOJI_SET }
