import { mergeProps } from '@base-ui/react/merge-props'
import { useRender } from '@base-ui/react/use-render'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
	'group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-[4px] px-2 py-0.5 text-[11px] font-medium whitespace-nowrap transition-[background-color,color,border-color] focus-visible:ring-[3px] focus-visible:ring-ring/20 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:ring-destructive/15 [&>svg]:pointer-events-none [&>svg]:size-3!',
	{
		variants: {
			variant: {
				default: 'bg-primary text-primary-foreground [a]:hover:bg-primary-hover',
				secondary: 'bg-secondary text-secondary-foreground [a]:hover:bg-accent',
				destructive:
					'bg-destructive-surface text-destructive focus-visible:ring-destructive/15 [a]:hover:bg-destructive/20',
				outline: 'bg-card text-foreground shadow-xs [a]:hover:bg-muted [a]:hover:text-foreground',
				ghost: 'hover:bg-muted hover:text-foreground',
				link: 'text-primary underline-offset-4 hover:underline',
				success: 'bg-success-surface text-success',
				warning: 'bg-warning-surface text-warning',
				info: 'bg-info-surface text-info',
			},
		},
		defaultVariants: {
			variant: 'default',
		},
	},
)

function Badge({
	className,
	variant = 'default',
	render,
	...props
}: useRender.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
	return useRender({
		defaultTagName: 'span',
		props: mergeProps<'span'>(
			{
				className: cn(badgeVariants({ variant }), className),
			},
			props,
		),
		render,
		state: {
			slot: 'badge',
			variant,
		},
	})
}

export { Badge, badgeVariants }
