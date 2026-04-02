import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUpIcon, SpinnerGapIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupTextarea } from '@/components/ui/input-group'
import { cn } from '@/lib/utils'
import { MentionAutocomplete } from './mention-autocomplete'

interface ChannelComposerProps {
	channelId: string
	disabled?: boolean
	placeholder?: string
	onSend: (content: string, mentions: string[]) => Promise<void>
	className?: string
}

const MENTION_PATTERN = /@([a-z0-9-]+)/g

function extractMentions(text: string): string[] {
	const mentions: string[] = []
	let match: RegExpExecArray | null = null
	while ((match = MENTION_PATTERN.exec(text)) !== null) {
		if (match[1]) mentions.push(match[1])
	}
	return [...new Set(mentions)]
}

export function ChannelComposer({
	channelId,
	disabled = false,
	placeholder = 'Type a message...',
	onSend,
	className,
}: ChannelComposerProps): React.JSX.Element {
	const [message, setMessage] = useState('')
	const [isSending, setIsSending] = useState(false)
	const [mentionQuery, setMentionQuery] = useState<string | null>(null)
	const [mentionAnchor, setMentionAnchor] = useState<{ top: number; left: number } | null>(null)
	const textareaRef = useRef<HTMLTextAreaElement | null>(null)
	const composerRef = useRef<HTMLDivElement | null>(null)

	const canSend = !disabled && !isSending && message.trim().length > 0

	useEffect(() => {
		const el = textareaRef.current
		if (!el) return
		el.style.height = '0px'
		el.style.height = `${Math.min(el.scrollHeight, 200)}px`
	}, [message])

	const handleChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
		const value = event.target.value
		setMessage(value)

		// Detect @mention trigger
		const textarea = event.target
		const cursorPos = textarea.selectionStart
		const textBeforeCursor = value.slice(0, cursorPos)
		const mentionMatch = textBeforeCursor.match(/@([a-z0-9-]*)$/)

		if (mentionMatch) {
			setMentionQuery(mentionMatch[1] ?? '')
			// Position autocomplete above the textarea
			if (composerRef.current) {
				const rect = composerRef.current.getBoundingClientRect()
				setMentionAnchor({ top: rect.top, left: rect.left + 16 })
			}
		} else {
			setMentionQuery(null)
			setMentionAnchor(null)
		}
	}, [])

	const insertMention = useCallback((name: string) => {
		setMessage((prev) => {
			const textarea = textareaRef.current
			if (!textarea) return prev
			const cursorPos = textarea.selectionStart
			const textBeforeCursor = prev.slice(0, cursorPos)
			const textAfterCursor = prev.slice(cursorPos)
			const replaced = textBeforeCursor.replace(/@[a-z0-9-]*$/, `@${name} `)
			return replaced + textAfterCursor
		})
		setMentionQuery(null)
		setMentionAnchor(null)
		textareaRef.current?.focus()
	}, [])

	const submit = async () => {
		if (!canSend) return
		const content = message.trim()
		const mentions = extractMentions(content)
		setIsSending(true)
		try {
			await onSend(content, mentions)
			setMessage('')
		} finally {
			setIsSending(false)
		}
	}

	return (
		<div ref={composerRef} className={cn('relative border-t border-border/80 bg-background/95 px-4 py-2', className)}>
			{mentionQuery !== null && mentionAnchor ? (
				<MentionAutocomplete
					channelId={channelId}
					query={mentionQuery}
					anchor={mentionAnchor}
					onSelect={insertMention}
					onClose={() => {
						setMentionQuery(null)
						setMentionAnchor(null)
					}}
				/>
			) : null}

			<InputGroup className="mx-auto h-auto w-full max-w-4xl flex-col items-stretch border-input bg-card/90">
				<InputGroupTextarea
					ref={textareaRef}
					value={message}
					onChange={handleChange}
					placeholder={disabled ? 'Sending...' : placeholder}
					disabled={disabled || isSending}
					aria-label="Message"
					className="min-h-[48px] max-h-[200px] border-0 bg-transparent px-2.5 pt-2 pb-1 font-sans text-sm leading-6 shadow-none focus-visible:ring-0"
					onKeyDown={(event) => {
						if (event.key === 'Escape') {
							if (mentionQuery !== null) {
								setMentionQuery(null)
								setMentionAnchor(null)
								return
							}
							textareaRef.current?.blur()
						}
						if (event.key === 'Enter' && !event.shiftKey) {
							event.preventDefault()
							void submit()
						}
					}}
				/>
				<div className="flex items-center justify-end px-2.5 pb-1.5 pt-0.5">
					<Button
						type="button"
						size="icon-sm"
						className="shrink-0"
						onClick={() => void submit()}
						disabled={!canSend}
						aria-label="Send message"
					>
						{isSending ? (
							<SpinnerGapIcon className="size-4 animate-spin" />
						) : (
							<ArrowUpIcon className="size-4" />
						)}
					</Button>
				</div>
			</InputGroup>
		</div>
	)
}
