import { MarkdownRenderer } from '@/components/markdown-renderer'
import { cn } from '@/lib/utils'

interface StreamingTextProps {
	text: string
	isStreaming: boolean
	className?: string
}

export function StreamingText({
	text,
	isStreaming,
	className,
}: StreamingTextProps): React.JSX.Element | null {
	if (!text && !isStreaming) {
		return null
	}

	return (
		<div className={cn('break-words', className)}>
			{text ? (
				<div className="leading-relaxed">
					<MarkdownRenderer content={text} mode="inline" />
				</div>
			) : null}
			{isStreaming ? (
				<span className="animate-blink-cursor ml-0.5 inline-block h-4 w-0.5 bg-foreground align-middle" />
			) : null}
		</div>
	)
}
