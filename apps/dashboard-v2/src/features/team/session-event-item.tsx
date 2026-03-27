import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
	BrainIcon,
	CaretDownIcon,
	CaretRightIcon,
	ChatCircleIcon,
	ChatTextIcon,
	CheckSquareIcon,
	EyeIcon,
	FileTextIcon,
	PencilSimpleIcon,
	PushPinIcon,
	TerminalIcon,
	XCircleIcon,
} from '@phosphor-icons/react'
import { useState } from 'react'

export type SessionEventType = 'thinking' | 'tool_call' | 'tool_result' | 'text' | 'error'

export interface SessionEvent {
	id: string
	type: SessionEventType
	timestamp: string
	content: string
	toolName?: string
	toolArgs?: Record<string, unknown>
	filePath?: string
	diff?: string
	lineCount?: number
	agentId: string
}

export type ViewMode = 'full' | 'compact' | 'tools'

/**
 * Tool call category for color coding:
 * - read: dim (read_file, search, etc.)
 * - write: green (write_file, create_file, etc.)
 * - action: amber (message, pin, task updates, etc.)
 */
function getToolCategory(toolName?: string): 'read' | 'write' | 'action' {
	if (!toolName) return 'read'
	const name = toolName.toLowerCase()
	if (
		name.includes('write') ||
		name.includes('create') ||
		name.includes('update') ||
		name.includes('delete')
	) {
		return 'write'
	}
	if (
		name.includes('message') ||
		name.includes('send') ||
		name.includes('pin') ||
		name.includes('approve') ||
		name.includes('reject') ||
		name.includes('deploy')
	) {
		return 'action'
	}
	return 'read'
}

function getToolIcon(toolName?: string) {
	if (!toolName) return TerminalIcon
	const name = toolName.toLowerCase()
	if (name.includes('read_file') || name.includes('search')) return EyeIcon
	if (name.includes('write_file') || name.includes('create')) return PencilSimpleIcon
	if (name.includes('message')) return ChatCircleIcon
	if (name.includes('pin')) return PushPinIcon
	return TerminalIcon
}

const EVENT_ICONS: Record<SessionEventType, typeof BrainIcon> = {
	thinking: BrainIcon,
	tool_call: TerminalIcon,
	tool_result: CheckSquareIcon,
	text: ChatTextIcon,
	error: XCircleIcon,
}

const TOOL_CATEGORY_STYLES: Record<string, string> = {
	read: 'text-muted-foreground',
	write: 'text-green-500',
	action: 'text-amber-500',
}

interface SessionEventItemProps {
	event: SessionEvent
	mode: ViewMode
}

export function SessionEventItem({ event, mode }: SessionEventItemProps) {
	const { t } = useTranslation()
	const [diffExpanded, setDiffExpanded] = useState(false)

	// In tools mode, hide thinking events
	if (mode === 'tools' && (event.type === 'thinking' || event.type === 'text')) {
		return null
	}

	const timestamp = new Date(event.timestamp).toLocaleTimeString('en-US', {
		hour12: false,
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	})

	// Compact mode: one-liner
	if (mode === 'compact') {
		return <CompactEventItem event={event} timestamp={timestamp} />
	}

	// Full mode
	const Icon = event.type === 'tool_call' ? getToolIcon(event.toolName) : EVENT_ICONS[event.type]
	const toolCategory = event.type === 'tool_call' ? getToolCategory(event.toolName) : null
	const iconColor = toolCategory
		? TOOL_CATEGORY_STYLES[toolCategory]
		: event.type === 'error'
			? 'text-red-500'
			: event.type === 'thinking'
				? 'text-muted-foreground/60'
				: 'text-foreground'

	return (
		<div className="flex gap-3 px-4 py-2">
			{/* Timestamp */}
			<span className="shrink-0 font-mono text-[10px] text-muted-foreground pt-0.5">
				{timestamp}
			</span>

			{/* Icon */}
			<Icon size={14} className={cn('shrink-0 mt-0.5', iconColor)} />

			{/* Content */}
			<div className="flex min-w-0 flex-1 flex-col gap-1">
				{/* Tool call header */}
				{event.type === 'tool_call' && event.toolName && (
					<div className="flex items-center gap-2">
						<Badge
							variant="outline"
							className={cn(
								'text-[10px]',
								toolCategory === 'write' && 'border-green-500/30 text-green-500',
								toolCategory === 'action' && 'border-amber-500/30 text-amber-500',
							)}
						>
							{event.toolName}
						</Badge>
						{event.filePath && (
							<span className="truncate font-mono text-[10px] text-primary">{event.filePath}</span>
						)}
					</div>
				)}

				{/* Text content */}
				{event.content && (
					<p
						className={cn(
							'text-xs leading-relaxed',
							event.type === 'thinking' && 'italic text-muted-foreground/70',
							event.type === 'error' && 'text-red-400',
							event.type === 'text' && 'text-foreground',
							event.type === 'tool_result' && 'text-muted-foreground',
						)}
					>
						{event.content}
					</p>
				)}

				{/* Inline diff viewer for write_file */}
				{event.diff && (
					<div className="mt-1">
						<Button
							variant="ghost"
							size="sm"
							className="h-5 gap-1 px-1 text-[10px] text-muted-foreground"
							onClick={() => setDiffExpanded(!diffExpanded)}
						>
							{diffExpanded ? <CaretDownIcon size={10} /> : <CaretRightIcon size={10} />}
							<FileTextIcon size={10} />
							{t('team.session_view_diff')}
							{event.lineCount && (
								<span className="text-muted-foreground/60">
									{t('team.session_lines', { count: event.lineCount })}
								</span>
							)}
						</Button>
						{diffExpanded && (
							<pre className="mt-1 max-h-64 overflow-auto border border-border bg-muted/30 p-2 font-mono text-[10px] leading-tight">
								{event.diff}
							</pre>
						)}
					</div>
				)}
			</div>
		</div>
	)
}

function CompactEventItem({ event, timestamp }: { event: SessionEvent; timestamp: string }) {
	const toolCategory = event.type === 'tool_call' ? getToolCategory(event.toolName) : null
	const Icon = event.type === 'tool_call' ? getToolIcon(event.toolName) : EVENT_ICONS[event.type]
	const iconColor = toolCategory
		? TOOL_CATEGORY_STYLES[toolCategory]
		: event.type === 'error'
			? 'text-red-500'
			: 'text-muted-foreground'

	const summary =
		event.type === 'tool_call'
			? `${event.toolName}${event.filePath ? ` ${event.filePath}` : ''}`
			: event.type === 'thinking'
				? event.content.slice(0, 80) + (event.content.length > 80 ? '...' : '')
				: event.content.slice(0, 100) + (event.content.length > 100 ? '...' : '')

	return (
		<div className="flex items-center gap-2 px-4 py-1">
			<span className="shrink-0 font-mono text-[10px] text-muted-foreground">{timestamp}</span>
			<Icon size={12} className={cn('shrink-0', iconColor)} />
			<span
				className={cn(
					'truncate text-[11px]',
					event.type === 'thinking' && 'italic text-muted-foreground/70',
					event.type === 'error' && 'text-red-400',
				)}
			>
				{summary}
			</span>
		</div>
	)
}
