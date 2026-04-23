import { useWorkers } from '@/hooks/use-workers'

export function Statusbar() {
	const { data: workers } = useWorkers()

	const onlineWorkers = workers?.filter((w) => w.status === 'online' || w.status === 'busy') ?? []
	const busyCount = workers?.filter((w) => w.status === 'busy').length ?? 0
	const workerName = onlineWorkers[0]?.name ?? null

	const statusLabel =
		onlineWorkers.length === 0 ? 'offline' : busyCount > 0 ? `busy (${busyCount})` : 'online'

	const statusColor =
		onlineWorkers.length === 0 ? 'bg-destructive' : busyCount > 0 ? 'bg-warning' : 'bg-success'

	return (
		<footer className="flex h-9 shrink-0 items-center border-t border-border/70 bg-background/80 px-4 backdrop-blur-sm">
			{/* Left: worker connection status */}
			<div className="flex items-center gap-1.5">
				<div className={`size-1.5 rounded-full ${statusColor}`} />
				<span className="text-xs text-muted-foreground tabular-nums">
					{statusLabel}
					{workerName && ` \u00b7 ${workerName}`}
				</span>
			</div>

			<div className="flex-1" />

			{/* Right: worker count */}
			<span className="text-xs text-muted-foreground tabular-nums">
				{onlineWorkers.length} worker{onlineWorkers.length !== 1 ? 's' : ''}
			</span>
		</footer>
	)
}
