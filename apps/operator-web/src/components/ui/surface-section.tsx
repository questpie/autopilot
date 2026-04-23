import { cn } from '@/lib/utils'

interface SurfaceSectionProps extends Omit<React.ComponentProps<'section'>, 'title'> {
	title?: React.ReactNode
	description?: React.ReactNode
	action?: React.ReactNode
	contentClassName?: string
	headerClassName?: string
}

function SurfaceSection({
	title,
	description,
	action,
	className,
	contentClassName,
	headerClassName,
	children,
	...props
}: SurfaceSectionProps) {
	const hasHeader = title != null || description != null || action != null

	return (
		<section
			data-slot="surface-section"
			className={cn('overflow-hidden rounded-xl border border-border/70 bg-card/80 shadow-xs', className)}
			{...props}
		>
			{hasHeader && (
				<div
					data-slot="surface-section-header"
					className={cn('flex items-start justify-between gap-4 border-b border-border/60 bg-muted/20 px-4 py-3', headerClassName)}
				>
					<div className="min-w-0">
						{title != null && <h3 className="text-sm font-medium text-foreground">{title}</h3>}
						{description != null && (
							<p className="mt-1 text-sm text-muted-foreground text-pretty">{description}</p>
						)}
					</div>
					{action != null && <div className="shrink-0">{action}</div>}
				</div>
			)}
			<div data-slot="surface-section-content" className={cn('px-4 py-4', contentClassName)}>
				{children}
			</div>
		</section>
	)
}

export { SurfaceSection }
export type { SurfaceSectionProps }
