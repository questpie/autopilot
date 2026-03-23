import { Badge } from '@/components/ui/badge'
import type { TaskStatus } from '@/lib/types'

const STATUS_CONFIG: Record<
	TaskStatus,
	{ label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
	backlog: { label: 'BACKLOG', variant: 'outline' },
	assigned: { label: 'ACTIVE', variant: 'default' },
	in_progress: { label: 'IN PROGRESS', variant: 'default' },
	review: { label: 'REVIEW', variant: 'secondary' },
	blocked: { label: 'BLOCKED', variant: 'destructive' },
	done: { label: 'DONE', variant: 'outline' },
}

export function StatusBadge({ status }: { status: TaskStatus }) {
	const config = STATUS_CONFIG[status] ?? {
		label: status.toUpperCase(),
		variant: 'outline' as const,
	}
	return (
		<Badge
			variant={config.variant}
			className="font-mono text-[9px] font-bold tracking-[0.12em] uppercase"
		>
			{config.label}
		</Badge>
	)
}
