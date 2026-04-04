import defaultComponents from 'fumadocs-ui/mdx'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

function CustomPre({
	title,
	className,
	...props
}: ComponentProps<'pre'> & { title?: string }) {
	return (
		<div className="group border-border bg-card relative my-6 overflow-hidden border">
			{title && (
				<div className="border-border bg-card border-b px-4 py-1.5">
					<span className="text-muted-foreground font-mono text-[9px] tracking-[2px] uppercase">
						{title}
					</span>
				</div>
			)}
			<defaultComponents.pre
				{...props}
				title={undefined}
				className={cn('!my-0 !border-0 !bg-transparent', className)}
			>
				{props.children}
			</defaultComponents.pre>
		</div>
	)
}

export const components = {
	...defaultComponents,
	pre: CustomPre,
}
