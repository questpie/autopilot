import { cn } from '@/lib/utils'

interface ScreenHeaderProps extends Omit<React.ComponentProps<'div'>, 'title'> {
	eyebrow?: React.ReactNode
	title: React.ReactNode
	support?: React.ReactNode
	actions?: React.ReactNode
	controls?: React.ReactNode
	controlsClassName?: string
}

export function ScreenHeader({
	eyebrow,
	title,
	support,
	actions,
	controls,
	controlsClassName,
	className,
	...props
}: ScreenHeaderProps) {
	return (
		<div className={cn('space-y-3', className)} {...props}>
			<div className="flex items-start justify-between gap-4">
				<div className="min-w-0 flex-1 space-y-1.5">
					{eyebrow ? (
						<p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-foreground-subtle">
							{eyebrow}
						</p>
					) : null}
					<div className="min-w-0">{title}</div>
					{support ? <div className="text-sm text-muted-foreground text-pretty">{support}</div> : null}
				</div>
				{actions ? <div className="shrink-0">{actions}</div> : null}
			</div>
			{controls ? <div className={cn('pt-1', controlsClassName)}>{controls}</div> : null}
		</div>
	)
}

export type { ScreenHeaderProps }
