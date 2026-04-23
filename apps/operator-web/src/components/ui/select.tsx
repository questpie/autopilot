import type * as React from 'react'

import { cn } from '@/lib/utils'

function Select({ className, children, ...props }: React.ComponentProps<'select'>) {
	return (
		<select
			data-slot="select"
			className={cn(
				'h-10 w-full min-w-0 rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground shadow-xs transition-[background-color,border-color,box-shadow] outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted/60 disabled:text-foreground/60 disabled:opacity-100',
				className,
			)}
			{...props}
		>
			{children}
		</select>
	)
}

export { Select }
