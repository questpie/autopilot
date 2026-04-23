import type * as React from 'react'

import { cn } from '@/lib/utils'

interface EmptyStateProps extends React.ComponentProps<'div'> {
	title: string
	description?: string
	icon?: React.ComponentType<{ className?: string }>
	action?: React.ReactNode
	height?: string
}

export function EmptyState({
	title,
	description,
	icon: Icon,
	action,
	height = 'h-48',
	className,
	...props
}: EmptyStateProps): React.ReactElement {
	return (
		<div
			data-slot="empty-state"
			className={cn(
				'relative flex flex-col items-center justify-center rounded-lg flex-1 px-6',
				height,
				className,
			)}
			{...props}
		>
			<div className="text-center">
				{Icon ? (
					<Icon className="text-muted-foreground/60 mx-auto mb-4 size-8" />
				) : (
					<div className="bg-primary mx-auto mb-4 size-1.5 rounded-full" />
				)}

				<p className="text-sm font-semibold text-foreground">{title}</p>

				{description && (
					<p className="text-muted-foreground mt-2 max-w-sm text-center text-sm text-pretty">
						{description}
					</p>
				)}

				{action && <div className="mt-4">{action}</div>}
			</div>
		</div>
	)
}
