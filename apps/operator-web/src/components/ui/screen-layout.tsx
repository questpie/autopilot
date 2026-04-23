import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

interface ScreenLayoutProps {
	header: React.ReactNode
	content: React.ReactNode
	rail?: React.ReactNode
	className?: string
	headerClassName?: string
	contentClassName?: string
	railClassName?: string
}

export function ScreenLayout({
	header,
	content,
	rail,
	className,
	headerClassName,
	contentClassName,
	railClassName,
}: ScreenLayoutProps) {
	const sidebar = useSidebar()

	return (
		<div className={cn('flex h-full min-h-0 flex-col overflow-hidden', className)}>
			<div className={cn('shrink-0 border-b border-border/70 px-4 py-4 md:px-5', headerClassName)}>
				<div className="flex items-start gap-4">
					{sidebar.state === 'collapsed' ? <SidebarTrigger className="mt-0.5" /> : null}
					<div className="min-w-0 flex-1">{header}</div>
				</div>
			</div>

			<div className="flex min-h-0 flex-1 flex-col lg:flex-row">
				<div className={cn('min-h-0 min-w-0 flex-1 overflow-hidden', contentClassName)}>{content}</div>
				{rail ? (
					<aside
						className={cn(
							'min-h-0 shrink-0 overflow-y-auto border-t border-border/70 bg-surface-1/35 lg:w-[280px] lg:border-t-0 lg:border-l',
							railClassName,
						)}
					>
						{rail}
					</aside>
				) : null}
			</div>
		</div>
	)
}

export type { ScreenLayoutProps }
