import { cn } from '@/lib/utils'
import { GenerativeAvatar } from '@/lib/generate-avatar'

interface AgentAvatarProps {
	/** Seed for deterministic face generation — typically agent name or ID */
	name: string
	size?: 'sm' | 'md' | 'lg'
	className?: string
}

const SIZE_PX = { sm: 24, md: 32, lg: 40 } as const
const SIZE_CLASSES = {
	sm: 'w-6 h-6',
	md: 'w-8 h-8',
	lg: 'w-10 h-10',
} as const

export function AgentAvatar({ name, size = 'md', className }: AgentAvatarProps) {
	return (
		<div className={cn('shrink-0 overflow-hidden bg-muted', SIZE_CLASSES[size], className)}>
			<GenerativeAvatar seed={name} size={SIZE_PX[size]} />
		</div>
	)
}
