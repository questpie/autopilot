import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'
import { m, AnimatePresence } from 'framer-motion'

import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'

const buttonVariants = cva(
	"group/button font-heading inline-flex shrink-0 items-center justify-center rounded-none bg-clip-padding text-xs font-medium whitespace-nowrap transition-all duration-150 ease-out outline-none select-none touch-target focus-visible:ring-1 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-1 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
	{
		variants: {
			variant: {
				default: 'bg-primary text-primary-foreground hover:bg-primary/80 [a]:hover:bg-primary/80',
				outline:
					'bg-muted/40 hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:bg-input/30 dark:hover:bg-muted',
				secondary:
					'bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground',
				ghost:
					'hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50',
				destructive:
					'bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40',
				link: 'relative text-primary no-underline hover:text-primary after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 after:bg-primary after:transition-[width] after:duration-150 after:ease-out hover:after:w-full',
				success: 'bg-success text-success-foreground hover:bg-success/90',
				warning: 'bg-warning text-warning-foreground hover:bg-warning/90',
			},
			size: {
				default:
					'h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
				xs: "h-6 gap-1 rounded-none px-2 text-xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
				sm: "h-7 gap-1 rounded-none px-2.5 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
				lg: 'h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3',
				icon: 'size-8',
				'icon-xs': "size-6 rounded-none [&_svg:not([class*='size-'])]:size-3",
				'icon-sm': 'size-7 rounded-none',
				'icon-lg': 'size-9',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	},
)

interface ButtonProps extends ButtonPrimitive.Props, VariantProps<typeof buttonVariants> {
	/** Show a spinner and disable the button */
	loading?: boolean
}

function Button({
	className,
	variant = 'default',
	size = 'default',
	loading = false,
	disabled,
	children,
	...props
}: ButtonProps) {
	return (
		<ButtonPrimitive
			data-slot="button"
			className={cn(buttonVariants({ variant, size, className }))}
			disabled={disabled || loading}
			{...props}
		>
			<AnimatePresence mode="wait" initial={false}>
				{loading ? (
					<m.span
						key="loading"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.15 }}
						className="inline-flex items-center gap-2"
					>
						<Spinner size={size === 'xs' || size === 'sm' ? 'sm' : 'default'} />
						{children}
					</m.span>
				) : (
					<m.span
						key="content"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.15 }}
						className="inline-flex items-center gap-1.5"
					>
						{children}
					</m.span>
				)}
			</AnimatePresence>
		</ButtonPrimitive>
	)
}

export { Button, buttonVariants }
