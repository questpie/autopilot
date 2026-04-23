import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const surfaceCardVariants = cva(
	'rounded-xl border border-border/70 bg-card/80 shadow-xs',
	{
		variants: {
			size: {
				sm: 'px-3 py-3',
				md: 'px-4 py-4',
				lg: 'px-5 py-5',
			},
			interactive: {
				true: 'cursor-pointer transition-[background-color,border-color,box-shadow,transform] hover:bg-muted/40 hover:shadow-sm active:scale-[0.99]',
				false: '',
			},
		},
		defaultVariants: {
			size: 'md',
			interactive: false,
		},
	},
)

function SurfaceCard({
	className,
	size,
	interactive,
	...props
}: React.ComponentProps<'div'> & VariantProps<typeof surfaceCardVariants>) {
	return <div data-slot="surface-card" className={cn(surfaceCardVariants({ size, interactive }), className)} {...props} />
}

export { SurfaceCard, surfaceCardVariants }
