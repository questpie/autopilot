import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ArrowLeftIcon } from '@phosphor-icons/react'

interface InspectorLayoutProps {
	header: React.ReactNode
	toolbar?: React.ReactNode
	content: React.ReactNode
	sidebar?: React.ReactNode
	className?: string
	contentClassName?: string
	sidebarClassName?: string
}

export function InspectorLayout({
	header,
	toolbar,
	content,
	sidebar,
	className,
	contentClassName,
	sidebarClassName,
}: InspectorLayoutProps) {
	const sidebarProps = useSidebar()

	return (
		<div className={cn('flex h-full min-h-0 flex-col overflow-hidden', className)}>
			<div className="shrink-0 px-4 py-2.5">
				<div className="flex items-start justify-between gap-4">
					{sidebarProps.state === 'collapsed' && <SidebarTrigger />}
					<div className="min-w-0 flex-1">{header}</div>
					{toolbar ? <div className="shrink-0">{toolbar}</div> : null}
				</div>
			</div>

			<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:flex-row">
				<div className={cn('min-w-0 flex-1 overflow-hidden', contentClassName)}>{content}</div>
				{sidebar ? (
					<aside
						className={cn(
							'max-h-[40vh] overflow-y-auto px-3 py-2 lg:max-h-none lg:w-[300px] lg:shrink-0',
							sidebarClassName,
						)}
					>
						{sidebar}
					</aside>
				) : null}
			</div>
		</div>
	)
}

export type InspectorHeaderAction =
	| {
			type: 'button'
			id: string
			label: string
			onClick: () => void
			variant?: React.ComponentProps<typeof Button>['variant']
	  }
	| {
			type: 'custom'
			id: string
			render: React.ReactNode
	  }

export type InspectorHeaderProps = {
	onBack?: () => void
	title: string
	actions: InspectorHeaderAction[]
}

export function InspectorHeader(props: InspectorHeaderProps) {
	return (
		<div className="flex items-center gap-3">
			{props.onBack ? (
				<Button size="icon-xs" variant="ghost" onClick={props.onBack} title="Back to tasks">
					<ArrowLeftIcon />
				</Button>
			) : null}
			<span className="text-xs text-muted-foreground tabular-nums truncate line-clamp-1">
				{props.title}
			</span>
			<div className="flex-1" />
			{props.actions.map((action) => {
				if (action.type === 'button') {
					return (
						<Button
							key={action.id}
							size="xs"
							variant={action.variant ?? 'outline'}
							onClick={action.onClick}
						>
							{action.label}
						</Button>
					)
				}

				return <div key={action.id}>{action.render}</div>
			})}
		</div>
	)
}
