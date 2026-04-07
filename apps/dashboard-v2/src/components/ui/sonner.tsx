import type { CSSProperties } from 'react'
import {
	CheckCircleIcon,
	InfoIcon,
	SpinnerGapIcon,
	WarningIcon,
	XCircleIcon,
	XIcon,
} from '@phosphor-icons/react'
import { useTheme } from 'next-themes'
import { Toaster as Sonner, type ToastClassnames, type ToasterProps } from 'sonner'
import { cn } from '@/lib/utils'

const defaultClassNames: ToastClassnames = {
	toast: cn(
		'pointer-events-auto flex w-[var(--width)] max-w-[calc(100vw-2rem)] items-start gap-2 rounded-none border border-border border-l-2 bg-popover px-3 py-2 text-popover-foreground shadow-none backdrop-blur-none',
		'focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50',
		'data-[swiping=true]:cursor-grabbing',
	),
	content: 'min-w-0 flex-1 space-y-0.5',
	icon: 'mt-0.5 flex size-4 shrink-0 items-center justify-center text-muted-foreground [&_svg]:size-4',
	loader: 'text-muted-foreground',
	title: 'min-w-0 text-[12px]/4 font-medium text-foreground [overflow-wrap:anywhere]',
	description:
		'min-w-0 whitespace-normal text-[11px]/4 text-muted-foreground [overflow-wrap:anywhere]',
	actionButton: cn(
		'ml-1 inline-flex h-6 shrink-0 items-center justify-center rounded-none border border-border bg-background px-2',
		'font-heading text-[10px] uppercase tracking-[0.12em] text-foreground',
		'transition-colors hover:bg-muted',
		'focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50',
	),
	cancelButton: cn(
		'ml-auto inline-flex h-6 shrink-0 items-center justify-center rounded-none border border-border bg-background px-2',
		'font-heading text-[10px] uppercase tracking-[0.12em] text-muted-foreground',
		'transition-colors hover:bg-muted hover:text-foreground',
		'focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50',
	),
	closeButton: cn(
		'order-4 ml-1 inline-flex size-5 shrink-0 items-center justify-center rounded-none border border-border bg-background',
		'text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
		'focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50',
		'[&_svg]:size-3',
	),
	default: 'border-l-border',
	success: 'border-l-success [&_[data-icon]]:text-success',
	info: 'border-l-info [&_[data-icon]]:text-info',
	warning: 'border-l-warning [&_[data-icon]]:text-warning',
	error: 'border-l-destructive [&_[data-icon]]:text-destructive',
	loading: 'border-l-border [&_[data-icon]]:text-muted-foreground',
}

function mergeClassNames(classNames?: ToastClassnames): ToastClassnames {
	return {
		toast: cn(defaultClassNames.toast, classNames?.toast),
		title: cn(defaultClassNames.title, classNames?.title),
		description: cn(defaultClassNames.description, classNames?.description),
		actionButton: cn(defaultClassNames.actionButton, classNames?.actionButton),
		cancelButton: cn(defaultClassNames.cancelButton, classNames?.cancelButton),
		closeButton: cn(defaultClassNames.closeButton, classNames?.closeButton),
		content: cn(defaultClassNames.content, classNames?.content),
		icon: cn(defaultClassNames.icon, classNames?.icon),
		loader: cn(defaultClassNames.loader, classNames?.loader),
		default: cn(defaultClassNames.default, classNames?.default),
		success: cn(defaultClassNames.success, classNames?.success),
		info: cn(defaultClassNames.info, classNames?.info),
		warning: cn(defaultClassNames.warning, classNames?.warning),
		error: cn(defaultClassNames.error, classNames?.error),
		loading: cn(defaultClassNames.loading, classNames?.loading),
	}
}

function Toaster({ className, icons, style, toastOptions, richColors, ...props }: ToasterProps) {
	const { theme = 'system' } = useTheme()

	return (
		<Sonner
			theme={theme as ToasterProps['theme']}
			richColors={richColors ?? false}
			className={cn('toaster group', className)}
			icons={{
				success: <CheckCircleIcon className="size-4" />,
				info: <InfoIcon className="size-4" />,
				warning: <WarningIcon className="size-4" />,
				error: <XCircleIcon className="size-4" />,
				loading: <SpinnerGapIcon className="size-4 animate-spin" />,
				close: <XIcon className="size-3" />,
				...icons,
			}}
			style={
				{
					'--normal-bg': 'var(--popover)',
					'--normal-text': 'var(--popover-foreground)',
					'--normal-border': 'var(--border)',
					'--border-radius': '0px',
					...style,
				} as CSSProperties
			}
			toastOptions={{
				...toastOptions,
				unstyled: true,
				classNames: mergeClassNames(toastOptions?.classNames),
			}}
			{...props}
		/>
	)
}

export { Toaster }
