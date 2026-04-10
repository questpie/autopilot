import { type VariantProps, cva } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const statusBadgeVariants = cva('inline-flex items-center gap-1.5 text-xs font-medium', {
	variants: {
		status: {
			active: 'text-success',
			blocked: 'text-warning',
			done: 'text-info',
			failed: 'text-destructive',
			pending: 'text-muted-foreground',
		},
	},
	defaultVariants: {
		status: 'pending',
	},
})

const dotVariants = cva('size-2 rounded-full', {
	variants: {
		status: {
			active: 'bg-success',
			blocked: 'bg-warning',
			done: 'bg-info',
			failed: 'bg-destructive',
			pending: 'bg-muted-foreground',
		},
	},
	defaultVariants: {
		status: 'pending',
	},
})

const statusLabels: Record<NonNullable<StatusBadgeProps['status']>, string> = {
	active: 'Active',
	blocked: 'Blocked',
	done: 'Done',
	failed: 'Failed',
	pending: 'Pending',
}

interface StatusBadgeProps
	extends Omit<React.ComponentProps<'span'>, 'children'>,
		VariantProps<typeof statusBadgeVariants> {
	status: NonNullable<VariantProps<typeof statusBadgeVariants>['status']>
}

function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
	return (
		<span
			data-slot="status-badge"
			className={cn(statusBadgeVariants({ status, className }))}
			{...props}
		>
			<span className={dotVariants({ status })} aria-hidden="true" />
			{statusLabels[status]}
		</span>
	)
}

export { StatusBadge, statusBadgeVariants }
export type { StatusBadgeProps }
