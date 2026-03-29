import { ArrowDownIcon } from "@phosphor-icons/react"

interface ScrollToBottomButtonProps {
  onClick: () => void
}

export function ScrollToBottomButton({ onClick }: ScrollToBottomButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Scroll to bottom"
      className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5 border border-border bg-card px-3 py-1.5 font-heading text-[10px] text-muted-foreground shadow-sm transition-colors hover:text-foreground"
    >
      <ArrowDownIcon size={12} />
    </button>
  )
}
