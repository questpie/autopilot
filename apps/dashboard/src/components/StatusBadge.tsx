const statusColors: Record<string, string> = {
	running: 'bg-accent-green/15 text-accent-green',
	active: 'bg-accent-green/15 text-accent-green',
	done: 'bg-accent-green/15 text-accent-green',
	completed: 'bg-accent-green/15 text-accent-green',
	idle: 'bg-accent-cyan/15 text-accent-cyan',
	pending: 'bg-accent-cyan/15 text-accent-cyan',
	scheduled: 'bg-accent-orange/15 text-accent-orange',
	in_progress: 'bg-accent-orange/15 text-accent-orange',
	blocked: 'bg-accent-red/15 text-accent-red',
	error: 'bg-accent-red/15 text-accent-red',
	failed: 'bg-accent-red/15 text-accent-red',
}

export function StatusBadge({ status }: { status: string }) {
	const color = statusColors[status.toLowerCase()] ?? 'bg-surface text-muted'
	return (
		<span className={`inline-block px-2 py-0.5 text-xs font-mono uppercase ${color}`}>
			{status}
		</span>
	)
}
