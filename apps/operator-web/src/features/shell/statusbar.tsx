import { useWorkers } from '@/hooks/use-workers'

export function Statusbar() {
  const { data: workers } = useWorkers()

  const onlineWorkers = workers?.filter((w) => w.status === 'online' || w.status === 'busy') ?? []
  const busyCount = workers?.filter((w) => w.status === 'busy').length ?? 0
  const workerName = onlineWorkers[0]?.name ?? null

  const statusLabel = onlineWorkers.length === 0
    ? 'offline'
    : busyCount > 0
      ? `busy (${busyCount})`
      : 'online'

  const statusColor = onlineWorkers.length === 0
    ? 'bg-destructive'
    : busyCount > 0
      ? 'bg-warning'
      : 'bg-success'

  return (
    <footer className="flex h-7 shrink-0 items-center border-t border-border bg-background px-4">
      {/* Left: worker connection status */}
      <div className="flex items-center gap-1.5">
        <div className={`size-1.5 ${statusColor}`} />
        <span className="font-mono text-[11px] text-muted-foreground">
          {statusLabel}
          {workerName && ` \u00b7 ${workerName}`}
        </span>
      </div>

      <div className="flex-1" />

      {/* Right: worker count */}
      <span className="font-mono text-[11px] text-muted-foreground">
        {onlineWorkers.length} worker{onlineWorkers.length !== 1 ? 's' : ''}
      </span>
    </footer>
  )
}
