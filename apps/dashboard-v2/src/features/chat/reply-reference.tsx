import { cn } from '@/lib/utils'
import { memo, useCallback } from 'react'
import type { Message } from './chat.types'

interface ReplyReferenceProps {
	/** The parent message being replied to */
	parentMessage: Message | null
	compact?: boolean
}

/** Generates a deterministic color from a string (for mini-avatar backgrounds). */
function stringToColor(str: string): string {
	const colors = [
		'bg-primary/20 text-primary',
		'bg-info/20 text-info',
		'bg-success/20 text-success',
		'bg-amber-500/20 text-amber-400',
		'bg-destructive/20 text-destructive',
		'bg-cyan-500/20 text-cyan-400',
		'bg-violet-500/20 text-violet-400',
		'bg-pink-500/20 text-pink-400',
	]
	let hash = 0
	for (let i = 0; i < str.length; i++) {
		hash = str.charCodeAt(i) + ((hash << 5) - hash)
	}
	return colors[Math.abs(hash) % colors.length]
}

/**
 * Displays a compact reference to the parent message above a reply.
 * Shows a left accent border, mini avatar, sender name, and truncated first line.
 * Clicking scrolls to and briefly highlights the original message.
 */
export const ReplyReference = memo(function ReplyReference({
	parentMessage,
	compact = false,
}: ReplyReferenceProps) {
	const handleClick = useCallback(() => {
		if (!parentMessage) return
		const el = document.querySelector(`[data-message-id="${parentMessage.id}"]`)
		if (!el) return
		el.scrollIntoView({ behavior: 'smooth', block: 'center' })
		el.classList.add('reply-highlight')
		setTimeout(() => el.classList.remove('reply-highlight'), 1500)
	}, [parentMessage])

	if (!parentMessage) {
		return (
			<div className="mb-1 flex items-center gap-1.5 border-l-2 border-muted-foreground/30 pl-2 text-[11px] text-muted-foreground/60 italic">
				Original message was deleted
			</div>
		)
	}

	const avatarColor = stringToColor(parentMessage.from)
	const initial = parentMessage.from.charAt(0).toUpperCase()
	const firstLine = parentMessage.content.split('\n')[0].slice(0, 120)

	return (
		<button
			type="button"
			onClick={handleClick}
			aria-label={`Jump to reply from ${parentMessage.from}`}
			className={cn(
				'mb-1 flex items-center gap-1.5 border-l-2 border-primary/40 pl-2 text-left transition-colors hover:border-primary/70',
				compact ? 'max-w-[260px]' : 'max-w-[500px]',
			)}
		>
			{/* Mini avatar */}
			<div
				className={cn(
					'flex size-4 shrink-0 items-center justify-center rounded-full text-[8px] font-bold',
					avatarColor,
				)}
			>
				{initial}
			</div>
			{/* Sender name */}
			<span className="shrink-0 text-[11px] font-semibold text-foreground/80">
				{parentMessage.from}
			</span>
			{/* Truncated content */}
			<span className="truncate text-[11px] text-muted-foreground/70">{firstLine}</span>
		</button>
	)
})
