interface QueuedMessageIndicatorProps {
  message: string
}

export function QueuedMessageIndicator({ message: _message }: QueuedMessageIndicatorProps) {
  return (
    <div className="flex items-center gap-1.5 border-t border-border px-3 py-1 text-[10px] text-muted-foreground animate-in fade-in slide-in-from-top-1 duration-200">
      <span className="inline-block size-1.5 animate-pulse rounded-full bg-amber-500/70" />
      Message queued — agent is working...
    </div>
  )
}
