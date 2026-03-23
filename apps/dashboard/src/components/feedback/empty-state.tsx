import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Link } from '@tanstack/react-router'

interface EmptyStateProps {
	icon?: ReactNode
	title: string
	description?: string
	action?: {
		label: string
		to?: string
		onClick?: () => void
	}
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
	return (
		<div className="flex flex-col items-center justify-center py-16 px-4 text-center">
			{icon && <div className="text-muted-foreground mb-4 text-3xl">{icon}</div>}
			<div className="font-mono text-[13px] font-semibold text-foreground mb-1">
				{title}
			</div>
			{description && (
				<div className="text-sm text-muted-foreground max-w-[280px] mb-4">
					{description}
				</div>
			)}
			{action && (
				action.to ? (
					<Link to={action.to}>
						<Button size="sm">{action.label}</Button>
					</Link>
				) : (
					<Button size="sm" onClick={action.onClick}>{action.label}</Button>
				)
			)}
		</div>
	)
}
