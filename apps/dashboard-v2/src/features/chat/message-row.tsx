import { useEffect, useState } from 'react'
import {
	CaretDownIcon,
	CaretRightIcon,
	PaperclipIcon,
	WarningCircleIcon,
	WrenchIcon,
} from '@phosphor-icons/react'
import { GenerativeAvatar } from '@questpie/avatar'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { cn } from '@/lib/utils'
import {
	formatAttachmentSize,
	summarizeErrorDetail,
	type ToolCallState,
} from './chat-message-metadata'
import type { MessageAttachment } from './chat.types'
import type { StreamBlock } from './use-session-stream'
import { extractToolLinks, ToolCallCard } from './tool-call-card'
import { StreamingText } from './streaming-text'

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
	/** Chronologically-ordered stream blocks (used for live streaming messages) */
	streamBlocks?: StreamBlock[]
	attachments?: MessageAttachment[]
	runError?: string | null
	className?: string
}

const RUN_ERROR_SUMMARY = 'The run stopped before the assistant could finish.'

function hasMeaningfulAssistantText(content: string): boolean {
	const trimmed = content.trim()
	if (!trimmed) return false

	return trimmed.length >= 48 || (trimmed.length >= 24 && /[\n.!?]/.test(trimmed))
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

// ── Tool section (used for historical messages) ─────────────────────

function ToolSection({
	toolCalls,
}: {
	toolCalls: ToolCallState[]
}) {
	const latestActiveToolCall = [...toolCalls].reverse().find((tc) => tc.status === 'running')
	const shouldCompactTools = toolCalls.length > 1
	const hasCollapsedToolHistory = toolCalls.length > 1 || !latestActiveToolCall
	const [toolSummaryOpen, setToolSummaryOpen] = useState<boolean | null>(null)
	const [openToolDetails, setOpenToolDetails] = useState<Record<string, boolean>>({})
	const isToolSummaryOpen =
		toolSummaryOpen ?? (toolCalls.length > 0 ? !shouldCompactTools : false)
	const visibleToolCalls = shouldCompactTools
		? isToolSummaryOpen
			? toolCalls
			: latestActiveToolCall
				? [latestActiveToolCall]
				: []
		: toolCalls
	const collapsedToolCount =
		shouldCompactTools && !isToolSummaryOpen
			? Math.max(toolCalls.length - visibleToolCalls.length, 0)
			: 0
	const showToolSummaryToggle = shouldCompactTools && hasCollapsedToolHistory

	useEffect(() => {
		if (toolCalls.length === 0) {
			setToolSummaryOpen(null)
			setOpenToolDetails({})
			return
		}

		setOpenToolDetails((current) =>
			Object.fromEntries(
				Object.entries(current).filter(([toolCallId]) =>
					toolCalls.some((toolCall) => toolCall.id === toolCallId),
				),
			),
		)
	}, [toolCalls])

	const toolSummaryLabel = latestActiveToolCall
		? `Using ${toolCalls.length} ${toolCalls.length === 1 ? 'tool' : 'tools'}`
		: `Called ${toolCalls.length} ${toolCalls.length === 1 ? 'tool' : 'tools'}`

	if (toolCalls.length === 0) return null

	return (
		<div className="space-y-1.5">
			{showToolSummaryToggle ? (
				<button
					type="button"
					onClick={() => setToolSummaryOpen((current) => !(current ?? false))}
					className="flex w-full items-center gap-2 border-l border-border/60 py-1 pl-2.5 text-left hover:text-foreground"
				>
					<WrenchIcon className="size-3.5 shrink-0 text-muted-foreground" />
					<span className="truncate font-heading text-[11px] text-muted-foreground">
						{toolSummaryLabel}
					</span>
					{!isToolSummaryOpen && collapsedToolCount > 0 ? (
						<span className="truncate text-[10px] text-muted-foreground">
							{collapsedToolCount} collapsed
						</span>
					) : null}
					<span className="ml-auto shrink-0 text-muted-foreground">
						{isToolSummaryOpen ? (
							<CaretDownIcon className="size-3.5" />
						) : (
							<CaretRightIcon className="size-3.5" />
						)}
					</span>
				</button>
			) : null}

			{visibleToolCalls.length > 0 ? (
				<div className="space-y-1">
					{visibleToolCalls.map((toolCall) => (
						<ToolCallCard
							key={toolCall.id}
							tool={toolCall.tool}
							params={toolCall.params}
							status={toolCall.status}
							result={toolCall.result}
							links={extractToolLinks(toolCall.tool, toolCall.params)}
							displayLabel={toolCall.displayLabel}
							displayMeta={toolCall.displayMeta}
							open={
								openToolDetails[toolCall.id] ??
								(toolCall.status === 'running' || toolCall.status === 'error')
							}
							onOpenChange={(open) =>
								setOpenToolDetails((current) => ({
									...current,
									[toolCall.id]: open,
								}))
							}
						/>
					))}
				</div>
			) : null}
		</div>
	)
}

// ── Chronological stream blocks renderer ────────────────────────────

function StreamBlocksRenderer({
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
	content,
	timestamp,
	isGroupStart,
	isStreaming = false,
	toolCalls = [],
	streamBlocks,
	attachments = [],
	runError = null,
	className,
}: MessageRowProps): React.JSX.Element {
	const hasAttachments = attachments.length > 0
	const hasContentBeforeError = !!content || hasAttachments || toolCalls.length > 0 || (streamBlocks && streamBlocks.length > 0)
	const hasMeaningfulText = hasMeaningfulAssistantText(content)
	const renderToolsAfterContent = hasMeaningfulText || hasAttachments
	const summarizedRunError = summarizeErrorDetail(runError)

	// Stream blocks mode: chronological rendering
	const useBlocksMode = streamBlocks && streamBlocks.length > 0

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
					<div className={cn('flex flex-wrap gap-2', toolCalls.length === 0 && !content && 'mt-0', 'mt-1')}>
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

				{useBlocksMode ? (
					<StreamBlocksRenderer blocks={streamBlocks} isStreaming={isStreaming} />
				) : (
					<>
						{!renderToolsAfterContent ? (
							<ToolSection toolCalls={toolCalls} />
						) : null}

						{isStreaming ? (
							<StreamingText
								text={content}
								isStreaming={isStreaming}
								className={cn(
									'text-sm',
									((!renderToolsAfterContent && toolCalls.length > 0) || hasAttachments) && 'mt-3',
								)}
							/>
						) : content ? (
							<div
								className={cn(
									'text-sm leading-relaxed',
									((!renderToolsAfterContent && toolCalls.length > 0) || hasAttachments) && 'mt-3',
								)}
							>
								<MarkdownRenderer content={content} mode="inline" />
							</div>
						) : null}

						{renderToolsAfterContent ? (
							<div className={cn((content || hasAttachments) && 'mt-3')}>
								<ToolSection toolCalls={toolCalls} />
							</div>
						) : null}
					</>
				)}

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
