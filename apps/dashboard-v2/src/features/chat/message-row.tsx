import { GenerativeAvatar } from '@questpie/avatar'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { cn } from '@/lib/utils'
import { extractToolLinks, ToolCallCard } from './tool-call-card'
import { StreamingText } from './streaming-text'
import type { ToolCallState } from './use-session-stream'

interface MessageRowProps {
	sender: {
		id: string
		name: string
		type: 'human' | 'agent'
	}
	content: string
	timestamp: string
	isGroupStart: boolean
	isStreaming?: boolean
	toolCalls?: ToolCallState[]
	className?: string
}

function formatTimestamp(timestamp: string): string {
	const date = new Date(timestamp)
	if (Number.isNaN(date.getTime())) {
		return '—'
	}

	const now = new Date()
	const diffMs = now.getTime() - date.getTime()
	const diffMinutes = Math.floor(diffMs / 60000)
	if (diffMinutes < 1) return 'now'
	if (diffMinutes < 60) return `${diffMinutes}m ago`
	if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`
	return date.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
	})
}

export function MessageRow({
	sender,
	content,
	timestamp,
	isGroupStart,
	isStreaming = false,
	toolCalls = [],
	className,
}: MessageRowProps): React.JSX.Element {
	return (
		<div
			className={cn(
				'flex gap-3 px-4 py-2',
				isGroupStart ? 'pt-4' : 'pt-1',
				className,
			)}
		>
			<div className="w-8 shrink-0">
				{isGroupStart ? (
					<GenerativeAvatar
						seed={sender.id}
						size={32}
						className="size-8 border border-border"
					/>
				) : null}
			</div>

			<div className="min-w-0 flex-1">
				{isGroupStart ? (
					<div className="mb-1 flex items-center gap-2">
						<span className="truncate font-heading text-sm text-foreground" title={sender.name}>
							{sender.name || 'Unknown'}
						</span>
						{sender.type === 'agent' ? (
							<span className="bg-primary/10 px-1 py-0.5 text-[8px] uppercase text-primary">
								BOT
							</span>
						) : null}
						<span className="text-[10px] text-muted-foreground" title={timestamp}>
							{formatTimestamp(timestamp)}
						</span>
					</div>
				) : null}

				{toolCalls.length > 0 ? (
					<div className="space-y-2">
						{toolCalls.map((toolCall) => (
							<ToolCallCard
								key={toolCall.id}
								tool={toolCall.tool}
								params={toolCall.params}
								status={toolCall.status}
								result={toolCall.result}
								links={extractToolLinks(toolCall.tool, toolCall.params)}
							/>
						))}
					</div>
				) : null}

				{isStreaming ? (
					<StreamingText text={content} isStreaming={isStreaming} className={cn('text-sm', toolCalls.length > 0 && 'mt-3')} />
				) : content ? (
					<div className={cn('text-sm leading-relaxed', toolCalls.length > 0 && 'mt-3')}>
						<MarkdownRenderer content={content} mode="inline" />
					</div>
				) : null}
			</div>
		</div>
	)
}
