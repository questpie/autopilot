import { cn } from '@/lib/utils'

const ROLE_COLORS: Record<string, string> = {
	meta: 'bg-primary',
	strategist: 'bg-info',
	planner: 'bg-warning',
	developer: 'bg-success',
	reviewer: 'bg-chart-3',
	devops: 'bg-destructive',
	marketing: 'bg-primary',
	design: 'bg-chart-4',
}

interface AgentAvatarProps {
	name: string
	role?: string
	size?: 'sm' | 'md' | 'lg'
	className?: string
}

export function AgentAvatar({ name, role, size = 'md', className }: AgentAvatarProps) {
	const initials = name
		.split(/\s+/)
		.map((w) => w[0])
		.join('')
		.toUpperCase()
		.slice(0, 2)

	const bg = ROLE_COLORS[role ?? ''] ?? 'bg-muted'

	const sizeClasses = {
		sm: 'w-6 h-6 text-[8px]',
		md: 'w-8 h-8 text-[10px]',
		lg: 'w-10 h-10 text-[12px]',
	}

	return (
		<div
			className={cn(
				'flex items-center justify-center shrink-0 font-mono font-bold text-white',
				bg,
				sizeClasses[size],
				className,
			)}
		>
			{initials}
		</div>
	)
}
