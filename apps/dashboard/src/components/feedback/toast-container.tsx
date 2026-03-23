import { useToasts, useDismissToast } from '@/hooks/use-toast'
import type { ToastVariant } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

const VARIANT_STYLES: Record<ToastVariant, string> = {
	success: 'border-l-2 border-l-success',
	warning: 'border-l-2 border-l-warning',
	error: 'border-l-2 border-l-destructive',
	info: 'border-l-2 border-l-info',
}

export function ToastContainer() {
	const toasts = useToasts()
	const dismiss = useDismissToast()

	if (toasts.length === 0) return null

	return (
		<div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
			{toasts.map((t) => (
				<div
					key={t.id}
					onClick={() => dismiss(t.id)}
					className={cn(
						'pointer-events-auto cursor-pointer bg-card border border-border px-4 py-2.5 font-mono text-[11px] text-foreground shadow-lg animate-[slide-in-right_200ms_ease-out,fade-in_200ms_ease-out]',
						VARIANT_STYLES[t.variant],
					)}
				>
					{t.message}
				</div>
			))}
		</div>
	)
}
