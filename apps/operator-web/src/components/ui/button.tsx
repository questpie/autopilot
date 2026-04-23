import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'

const buttonVariants = cva(
	"group/button inline-flex shrink-0 items-center justify-center rounded-md bg-clip-padding text-sm font-medium whitespace-nowrap text-foreground transition-[background-color,color,border-color,box-shadow,transform] duration-150 ease-out outline-none select-none touch-target active:scale-[0.96] focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-[3px] aria-invalid:ring-destructive/15 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
	{
		variants: {
			variant: {
				default:
					'bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover [a]:hover:bg-primary-hover',
				outline:
					'border border-input bg-card text-foreground shadow-xs hover:bg-muted aria-expanded:bg-muted',
				secondary:
					'bg-secondary text-secondary-foreground hover:bg-accent aria-expanded:bg-accent aria-expanded:text-secondary-foreground',
				ghost:
					'text-muted-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground',
				destructive:
					'bg-destructive text-destructive-foreground shadow-xs hover:opacity-95 focus-visible:ring-destructive/20',
				link: 'relative h-auto px-0 text-primary no-underline hover:text-primary-hover',
				success: 'bg-success text-success-foreground shadow-xs hover:opacity-95',
				warning: 'bg-warning text-warning-foreground shadow-xs hover:opacity-95',
			},
			size: {
				default:
					'h-9 gap-1.5 px-3.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3',
				xs: "h-7 gap-1 px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
				sm: "h-8 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3.5",
				lg: 'h-10 gap-2 px-4 text-base has-data-[icon=inline-end]:pr-3.5 has-data-[icon=inline-start]:pl-3.5',
				icon: 'size-9',
				'icon-xs': "size-7 [&_svg:not([class*='size-'])]:size-3.5",
				'icon-sm': 'size-8',
				'icon-lg': 'size-10',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	},
)

function Button({
	className,
	variant = 'default',
	size = 'default',
	loading,
	children,
	disabled,
	...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants> & { loading?: boolean }) {
	return (
		<ButtonPrimitive
			data-slot="button"
			className={cn(buttonVariants({ variant, size, className }))}
			disabled={disabled || loading}
			{...props}
		>
			{loading ? <Spinner className="text-current" /> : null}
			{children}
		</ButtonPrimitive>
	)
}

export { Button, buttonVariants }
