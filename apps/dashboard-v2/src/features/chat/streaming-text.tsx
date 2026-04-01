import { useEffect, useRef, useState } from 'react'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { cn } from '@/lib/utils'

const SMOOTH_DELAY_MS = 12
const FLUSH_INTERVAL_MS = 8

interface StreamingTextProps {
	text: string
	isStreaming: boolean
	className?: string
}

/**
 * Smoothly reveals streamed text word-by-word instead of dumping raw chunks.
 * When streaming ends, any remaining buffer is flushed immediately.
 */
function useSmoothText(text: string, isStreaming: boolean): string {
	const [displayed, setDisplayed] = useState('')
	const bufferRef = useRef('')
	const displayedRef = useRef('')
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

	// Feed new text into buffer
	useEffect(() => {
		if (text.length > displayedRef.current.length + bufferRef.current.length) {
			bufferRef.current = text.slice(displayedRef.current.length)
		}
	}, [text])

	// Drain buffer word-by-word on an interval while streaming
	useEffect(() => {
		if (!isStreaming) {
			// Flush everything when streaming stops
			if (timerRef.current) {
				clearInterval(timerRef.current)
				timerRef.current = null
			}
			if (text !== displayedRef.current) {
				displayedRef.current = text
				bufferRef.current = ''
				setDisplayed(text)
			}
			return
		}

		if (timerRef.current) return

		timerRef.current = setInterval(() => {
			const buf = bufferRef.current
			if (!buf) return

			// Find the next word boundary (whitespace after non-whitespace)
			const match = buf.match(/^\S*\s*/)
			const chunk = match ? match[0] : buf.charAt(0)

			bufferRef.current = buf.slice(chunk.length)
			displayedRef.current += chunk
			setDisplayed(displayedRef.current)
		}, SMOOTH_DELAY_MS + FLUSH_INTERVAL_MS)

		return () => {
			if (timerRef.current) {
				clearInterval(timerRef.current)
				timerRef.current = null
			}
		}
	}, [isStreaming, text])

	return displayed
}

export function StreamingText({
	text,
	isStreaming,
	className,
}: StreamingTextProps): React.JSX.Element | null {
	const smoothText = useSmoothText(text, isStreaming)

	if (!smoothText && !isStreaming) {
		return null
	}

	return (
		<div className={cn('break-words', className)}>
			{smoothText ? (
				<div className="leading-relaxed">
					<MarkdownRenderer content={smoothText} mode="inline" />
				</div>
			) : null}
			{isStreaming ? (
				<span className="animate-blink-cursor ml-0.5 inline-block h-4 w-0.5 bg-foreground align-middle" />
			) : null}
		</div>
	)
}
