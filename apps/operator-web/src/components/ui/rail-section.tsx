import { cn } from '@/lib/utils'

interface RailSectionProps extends Omit<React.ComponentProps<'section'>, 'title'> {
	title?: React.ReactNode
	action?: React.ReactNode
	tone?: 'default' | 'sidebar' | 'support'
	children: React.ReactNode
	contentClassName?: string
}

export function RailSection({
	title,
	action,
	tone = 'default',
	children,
	className,
	contentClassName,
	...props
}: RailSectionProps) {
	return (
		<section className={cn('space-y-3', className)} {...props}>
			{title || action ? (
				<div className="flex items-center justify-between gap-3 px-1">
					{title ? (
						<div
							className={cn(
								'text-xs font-medium',
								tone === 'sidebar' && 'text-sidebar-foreground/55',
								tone === 'support' && 'text-foreground-subtle',
								tone === 'default' && 'text-muted-foreground',
							)}
						>
							{title}
						</div>
					) : (
						<div />
					)}
					{action ? <div className="shrink-0">{action}</div> : null}
				</div>
			) : null}
			<div
				className={cn(
					'p-1.5 rounded-lg',
					tone === 'sidebar'
						? 'bg-sidebar-accent/28 ring-1 ring-sidebar-border/45'
						: tone === 'support'
							? 'border border-border/60 bg-surface-1/50'
							: 'rounded-md border border-border/50 bg-muted/12',
					contentClassName,
				)}
			>
				{children}
			</div>
		</section>
	)
}
