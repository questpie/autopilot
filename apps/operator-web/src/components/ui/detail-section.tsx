import { cn } from '@/lib/utils'
import { SectionHeader } from '@/components/ui/section-header'

/**
 * DetailSection — standardized section wrapper for detail panels.
 *
 * Wraps the repeated pattern of:
 *   border-b border-border/50 px-5 py-4
 *   SectionHeader
 *   content slot (children)
 *
 * The optional `action` prop is forwarded to SectionHeader.
 * Pass `last` to suppress the bottom border on the final section.
 */

interface DetailSectionProps {
	title?: React.ReactNode
	action?: React.ReactNode
	last?: boolean
	className?: string
	children: React.ReactNode
}

function DetailSection({ title, action, last, className, children }: DetailSectionProps) {
	return (
		<div data-slot="detail-section" className={cn('px-5 py-4', !last && 'mb-1', className)}>
			{title != null && <SectionHeader action={action}>{title}</SectionHeader>}
			{children}
		</div>
	)
}

export { DetailSection }
export type { DetailSectionProps }
