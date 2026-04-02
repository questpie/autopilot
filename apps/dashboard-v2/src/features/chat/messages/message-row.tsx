import { useState } from 'react'
import {
	PaperclipIcon,
	WarningCircleIcon,
} from '@phosphor-icons/react'
import { GenerativeAvatar } from '@questpie/avatar'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { cn } from '@/lib/utils'
import {
	formatAttachmentSize,
	summarizeErrorDetail,
} from './metadata'
import type { MessageAttachment } from '../chat.types'
import type { StreamBlock } from '../stream'
import { extractToolLinks, ToolCallCard } from './tool-call-card'
import { StreamingText } from './streaming-text'

interface MessageRowProps {
	sender: {
		id: string
		name: string
		type: 'human' | 'agent'
	}
	blocks: StreamBlock[]
	timestamp: string
	isGroupStart: boolean
	isStreaming?: boolean
	attachments?: MessageAttachment[]
	runError?: string | null
	className?: string
}

const RUN_ERROR_SUMMARY = 'The run stopped before the assistant could finish.'

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

// ── Chronological blocks renderer ─────────────────────────────────────

function BlocksRenderer({
	blocks,
	isStreaming,
}: {
	blocks: StreamBlock[]
	isStreaming: boolean
}) {
	const [openToolDetails, setOpenToolDetails] = useState<Record<string, boolean>>({})
	const isLastBlockText = blocks.length > 0 && blocks[blocks.length - 1].kind === 'text'

	return (
		<div className="space-y-2">
			{blocks.map((block, i) => {
				const isLast = i === blocks.length - 1
				switch (block.kind) {
					case 'text':
						if (isStreaming && isLast) {
							return (
								<StreamingText
									key={`text-${i}`}
									text={block.content}
									isStreaming={isStreaming}
									className="text-sm"
								/>
							)
						}
						return block.content ? (
							<div key={`text-${i}`} className="text-sm leading-relaxed">
								<MarkdownRenderer content={block.content} mode="inline" />
							</div>
						) : null
					case 'thinking':
						return (
							<div
								key={`thinking-${i}`}
								className="border-l-2 border-muted-foreground/30 pl-3 text-xs italic text-muted-foreground"
							>
								{block.content}
							</div>
						)
					case 'tool_call':
						return (
							<ToolCallCard
								key={block.toolCall.id}
								tool={block.toolCall.tool}
								params={block.toolCall.params}
								status={block.toolCall.status}
								result={block.toolCall.result}
								links={extractToolLinks(block.toolCall.tool, block.toolCall.params)}
								displayLabel={block.toolCall.displayLabel}
								displayMeta={block.toolCall.displayMeta}
								open={
									openToolDetails[block.toolCall.id] ??
									(block.toolCall.status === 'running' || block.toolCall.status === 'error')
								}
								onOpenChange={(open) =>
									setOpenToolDetails((current) => ({
										...current,
										[block.toolCall.id]: open,
									}))
								}
							/>
						)
					default:
						return null
				}
			})}
			{isStreaming && !isLastBlockText ? (
				<span className="animate-blink-cursor ml-0.5 inline-block h-4 w-0.5 bg-foreground align-middle" />
			) : null}
		</div>
	)
}

// ── Main MessageRow ─────────────────────────────────────────────────

export function MessageRow({
	sender,
	blocks,
	timestamp,
	isGroupStart,
	isStreaming = false,
	attachments = [],
	runError = null,
	className,
}: MessageRowProps): React.JSX.Element {
	const hasAttachments = attachments.length > 0
	const hasContentBeforeError = blocks.length > 0 || hasAttachments
	const summarizedRunError = summarizeErrorDetail(runError)

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

				{hasAttachments ? (
					<div className={cn('flex flex-wrap gap-2', 'mt-1')}>
						{attachments.map((attachment) => (
							<div
								key={attachment.id}
								className="inline-flex max-w-full items-center gap-2 border border-border/80 bg-card px-2.5 py-2 text-left"
							>
								<PaperclipIcon className="size-3.5 shrink-0 text-muted-foreground" />
								<div className="min-w-0">
									<div className="truncate text-xs text-foreground" title={attachment.filename}>
										{attachment.filename}
									</div>
									<div className="truncate text-[11px] text-muted-foreground" title={attachment.url}>
										{formatAttachmentSize(attachment.size)} {attachment.mime_type ? `· ${attachment.mime_type}` : ''}
									</div>
								</div>
							</div>
						))}
					</div>
				) : null}

				{blocks.length > 0 ? (
					<BlocksRenderer blocks={blocks} isStreaming={isStreaming} />
				) : null}

				{runError ? (
					<div
						className={cn(
							'mt-3 border-l-2 border-destructive/70 pl-3 text-xs',
							!hasContentBeforeError && 'mt-0',
						)}
					>
						<div className="flex items-start gap-2">
							<WarningCircleIcon className="mt-0.5 size-3.5 shrink-0 text-destructive" />
							<div className="min-w-0">
								<div className="text-destructive">{RUN_ERROR_SUMMARY}</div>
								{summarizedRunError ? (
									<div className="mt-1 break-words text-muted-foreground">
										{summarizedRunError}
									</div>
								) : null}
							</div>
						</div>
					</div>
				) : null}
			</div>
		</div>
	)
}
