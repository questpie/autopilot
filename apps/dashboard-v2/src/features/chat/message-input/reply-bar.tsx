import { XIcon } from "@phosphor-icons/react"

interface ReplyBarProps {
  replyingTo: {
    senderName: string
    content: string
  }
  onCancel: () => void
}

export function ReplyBar({ replyingTo, onCancel }: ReplyBarProps) {
  return (
    <div className="flex items-center gap-2 border-b border-border bg-muted/20 px-3 py-1.5">
      <div className="min-w-0 flex-1 border-l-2 border-primary/50 pl-2">
        <span className="text-[11px] font-semibold text-foreground/80">
          Replying to {replyingTo.senderName}
        </span>
        <p className="truncate text-[11px] text-muted-foreground/70">
          {replyingTo.content.split("\n")[0].slice(0, 100)}
        </p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        title="Cancel reply"
      >
        <XIcon size={12} />
      </button>
    </div>
  )
}
