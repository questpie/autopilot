import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
	CaretRight,
	CaretDown,
	File,
	FileText,
	Wrench,
	Robot,
	Check,
	X,
	ArrowBendUpLeft,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Markdown } from '@/components/ui/markdown'
import { Button } from '@/components/ui/button'
import { MetaChip } from '@/components/ui/meta-chip'
import { SmartText } from '@/lib/smart-links'
import { useRunEvents } from '@/hooks/use-runs'
import { useApproveTask, useRejectTask, useReplyTask } from '@/hooks/use-tasks'
import { ToolCallCard, ThinkingBlock, ArtifactEventCard } from './run-event-feed'
import type { ChatAttachment, SessionMessage, RunEvent } from '@/api/types'

interface ChatMessageProps {
	message: SessionMessage
	queryRunId?: string | null
	/** When the message belongs to a task thread, the task id enables inline actions. */
	taskId?: string | null
	/**
	 * Whether the task is currently on a human_approval step and awaiting review.
	 * Only relevant when taskId is provided.
	 */
	taskNeedsApproval?: boolean
	/** When true, suppresses the timestamp for this message, assuming the next assistant message will render it. */
	isNextAssistant?: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────

function parseEventMeta(event: RunEvent): Record<string, unknown> {
	try {
		return JSON.parse(event.metadata || '{}') as Record<string, unknown>
	} catch {
		return {}
	}
}

function isAgentTool(event: RunEvent): boolean {
	return (event.summary ?? '').startsWith('Agent:')
}

// ── Render item types ────────────────────────────────────────────────────

type RenderItem =
	| { kind: 'thinking'; event: RunEvent }
	| { kind: 'progress'; event: RunEvent }
	| { kind: 'artifact'; event: RunEvent }
	| { kind: 'tool'; event: RunEvent }
	| { kind: 'tool_group'; events: RunEvent[] }
	| { kind: 'agent_group'; agents: RunEvent[]; children: RunEvent[] }

/** Walk deduped events and build render items with Agent nesting. */
function buildRenderItems(deduped: RunEvent[]): RenderItem[] {
	const items: RenderItem[] = []
	let i = 0

	while (i < deduped.length) {
		const event = deduped[i]

		// Agent tool call — start collecting an agent group
		if (event.type === 'tool_use' && isAgentTool(event)) {
			const agents: RunEvent[] = [event]
			i++
			// Collect consecutive Agent calls (parallel agents)
			while (i < deduped.length && deduped[i].type === 'tool_use' && isAgentTool(deduped[i])) {
				agents.push(deduped[i])
				i++
			}
			// Collect child tool calls until a non-tool event
			const children: RunEvent[] = []
			while (i < deduped.length && deduped[i].type === 'tool_use' && !isAgentTool(deduped[i])) {
				children.push(deduped[i])
				i++
			}
			items.push({ kind: 'agent_group', agents, children })
			continue
		}

		// Regular tool call — group consecutive non-Agent tools
		if (event.type === 'tool_use') {
			const group: RunEvent[] = [event]
			i++
			while (i < deduped.length && deduped[i].type === 'tool_use' && !isAgentTool(deduped[i])) {
				group.push(deduped[i])
				i++
			}
			if (group.length > 1) {
				items.push({ kind: 'tool_group', events: group })
			} else {
				items.push({ kind: 'tool', event: group[0] })
			}
			continue
		}

		// Non-tool events
		if (event.type === 'thinking') {
			items.push({ kind: 'thinking', event })
		} else if (event.type === 'progress') {
			items.push({ kind: 'progress', event })
		} else if (event.type === 'artifact') {
			items.push({ kind: 'artifact', event })
		}
		i++
	}

	return items
}

// ── Collapsible tool group ───────────────────────────────────────────────

function CollapsibleToolGroup({ events, label }: { events: RunEvent[]; label?: string }) {
	const [open, setOpen] = useState(false)
	const CaretIcon = open ? CaretDown : CaretRight

	return (
		<div>
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="flex items-center gap-1.5 py-0.5 text-left"
			>
				<CaretIcon className="size-3 shrink-0 text-muted-foreground" />
				<Wrench size={10} className="text-muted-foreground shrink-0" />
				<span className="text-sm text-muted-foreground">
					{label ?? `${events.length} tool call${events.length === 1 ? '' : 's'}`}
				</span>
			</button>
			{open && (
				<div className="flex flex-col gap-0.5 mt-0.5">
					{events.map((event) => (
						<ToolCallCard key={event.id} summary={event.summary ?? 'tool call'} status="done" />
					))}
				</div>
			)}
		</div>
	)
}

// ── Agent group — nested display ─────────────────────────────────────────

function AgentGroup({ agents, events }: { agents: RunEvent[]; events: RunEvent[] }) {
	const [open, setOpen] = useState(false)
	const CaretIcon = open ? CaretDown : CaretRight
	const totalTools = events.length

	return (
		<div className="pl-4">
			{/* Agent headers */}
			{agents.map((agent) => (
				<div
					key={agent.id}
					className="flex items-center gap-2 py-0.5 text-sm text-muted-foreground"
				>
					<Robot size={10} className="shrink-0" />
					<span className="truncate">{agent.summary ?? 'Agent'}</span>
					<span className="ml-auto shrink-0">done</span>
				</div>
			))}
			{/* Nested tool calls */}
			{totalTools > 0 && (
				<div>
					<button
						type="button"
						onClick={() => setOpen((v) => !v)}
						className="flex items-center gap-1.5 py-0.5 text-left"
					>
						<CaretIcon className="size-3 shrink-0 text-muted-foreground" />
						<Wrench size={10} className="text-muted-foreground shrink-0" />
						<span className="text-sm text-muted-foreground">
							{totalTools} tool call{totalTools === 1 ? '' : 's'}
						</span>
					</button>
					{open && (
						<div className="flex flex-col gap-0.5 pl-4 mt-0.5">
							{events.map((child) => (
								<ToolCallCard key={child.id} summary={child.summary ?? 'tool call'} status="done" />
							))}
						</div>
					)}
				</div>
			)}
		</div>
	)
}

// ── InlineRunEvents — interleaved chronological rendering ─────────────────

function InlineRunEvents({ runId, fallbackContent }: { runId: string; fallbackContent: string }) {
	const { data: events } = useRunEvents(runId)

	if (!events || events.length === 0) {
		return <Markdown content={fallbackContent} className="prose prose-sm font-sans text-sm" />
	}

	const sorted = [...events]
		.filter(
			(e) =>
				e.type === 'tool_use' ||
				e.type === 'thinking' ||
				e.type === 'artifact' ||
				e.type === 'progress',
		)
		.sort((a, b) => a.created_at.localeCompare(b.created_at))

	if (sorted.length === 0) {
		return <Markdown content={fallbackContent} className="prose prose-sm font-sans text-sm" />
	}

	// Deduplicate consecutive thinking/progress — keep last in streak
	const deduped: RunEvent[] = []
	for (let i = 0; i < sorted.length; i++) {
		const next = sorted[i + 1]
		if (
			(sorted[i].type === 'thinking' || sorted[i].type === 'progress') &&
			next &&
			next.type === sorted[i].type
		) {
			continue
		}
		deduped.push(sorted[i])
	}

	const items = buildRenderItems(deduped)
	const hasProgress = deduped.some((e) => e.type === 'progress')

	return (
		<div className="flex flex-col gap-1">
			{items.map((item, idx) => {
				if (item.kind === 'agent_group') {
					return <AgentGroup key={item.agents[0]?.id ?? idx} agents={item.agents} events={item.children} />
				}
				if (item.kind === 'tool_group') {
					return <CollapsibleToolGroup key={idx} events={item.events} />
				}
				if (item.kind === 'tool') {
					return (
						<ToolCallCard
							key={item.event.id}
							summary={item.event.summary ?? 'tool call'}
							status="done"
						/>
					)
				}
				if (item.kind === 'thinking') {
					return <ThinkingBlock key={item.event.id} isActive={false} />
				}
				if (item.kind === 'progress' && item.event.summary) {
					return (
						<div key={item.event.id} className="py-0.5">
							<Markdown content={item.event.summary} className="prose prose-sm font-sans text-sm" />
						</div>
					)
				}
				if (item.kind === 'artifact') {
					const meta = parseEventMeta(item.event)
					return (
						<ArtifactEventCard
							key={item.event.id}
							title={item.event.summary ?? 'artifact'}
							previewUrl={typeof meta.preview_url === 'string' ? meta.preview_url : null}
							kind={typeof meta.kind === 'string' ? meta.kind : undefined}
						/>
					)
				}
				return null
			})}
			{!hasProgress && (
				<Markdown content={fallbackContent} className="prose prose-sm font-sans text-sm" />
			)}
		</div>
	)
}

// ── Message metadata ─────────────────────────────────────────────────────

function parseMessageMeta(message: SessionMessage): Record<string, unknown> {
	try {
		return JSON.parse(message.metadata || '{}') as Record<string, unknown>
	} catch {
		return {}
	}
}

function getMessageAttachments(message: SessionMessage): ChatAttachment[] {
	if (Array.isArray(message.attachments)) {
		return message.attachments.filter((attachment): attachment is ChatAttachment => !!attachment)
	}

	const meta = parseMessageMeta(message)
	return Array.isArray(meta.attachments)
		? meta.attachments.filter((attachment): attachment is ChatAttachment => !!attachment && typeof attachment === 'object')
		: []
}

function renderAttachmentLink(attachment: ChatAttachment) {
	const label = attachment.name ?? attachment.label ?? attachment.url ?? attachment.refId ?? 'Attachment'

	if (attachment.url) {
		return (
			<a
				href={attachment.url}
				target="_blank"
				rel="noopener noreferrer"
				className="truncate max-w-[280px] text-primary hover:underline"
			>
				{label}
			</a>
		)
	}

	if (attachment.type === 'ref' && attachment.refId) {
		if (attachment.refType === 'task') {
			return (
				<Link to="/tasks" search={{ taskId: attachment.refId }} className="truncate max-w-[280px] text-primary hover:underline">
					{label}
				</Link>
			)
		}

		if (attachment.refType === 'session') {
			return (
				<Link to="/chat" search={{ sessionId: attachment.refId }} className="truncate max-w-[280px] text-primary hover:underline">
					{label}
				</Link>
			)
		}

		if (attachment.refType === 'file') {
			return (
				<Link to="/files" search={{ path: attachment.refId, view: 'file' }} className="truncate max-w-[280px] text-primary hover:underline">
					{label}
				</Link>
			)
		}

		if (attachment.refType === 'directory') {
			return (
				<Link to="/files" search={{ path: attachment.refId }} className="truncate max-w-[280px] text-primary hover:underline">
					{label}
				</Link>
			)
		}

		if (attachment.refType === 'run') {
			const taskId = typeof attachment.metadata?.taskId === 'string' ? attachment.metadata.taskId : null
			if (taskId) {
				return (
					<Link to="/tasks" search={{ taskId }} className="truncate max-w-[280px] text-primary hover:underline">
						{label}
					</Link>
				)
			}
		}
	}

	return <span className="truncate max-w-[280px]">{label}</span>
}

function AttachmentBlock({ attachment, tone = 'muted' }: { attachment: ChatAttachment; tone?: 'muted' | 'subtle' }) {
	const isText = attachment.type === 'text' && typeof attachment.content === 'string' && attachment.content.length > 0
	const Icon = isText ? FileText : File
	const containerClass = tone === 'subtle'
		? 'rounded-md border border-border/40 bg-muted/10 px-3 py-2'
		: 'rounded-md border border-border/60 bg-background/60 px-3 py-2'

	if (isText) {
		const label = attachment.name ?? attachment.label ?? attachment.url ?? attachment.refId ?? 'Attachment'
		const preview = attachment.content!.length > 320
			? `${attachment.content!.slice(0, 320)}...`
			: attachment.content!
		return (
			<div className={containerClass}>
				<div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
					<Icon size={12} />
					<span className="truncate">{label}</span>
					{attachment.mimeType && <span className="tabular-nums">{attachment.mimeType}</span>}
				</div>
				<pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground">{preview}</pre>
			</div>
		)
	}

	return (
		<MetaChip icon={<Icon size={12} />} className="max-w-full">
			{renderAttachmentLink(attachment)}
			{attachment.mimeType && <span className="tabular-nums">{attachment.mimeType}</span>}
		</MetaChip>
	)
}

function MessageAttachments({ attachments, tone = 'muted' }: { attachments: ChatAttachment[]; tone?: 'muted' | 'subtle' }) {
	if (attachments.length === 0) return null

	return (
		<div className="mt-2 flex flex-col gap-2">
			{attachments.map((attachment, index) => (
				<AttachmentBlock
					key={`${attachment.name ?? attachment.label ?? attachment.url ?? attachment.refId ?? 'attachment'}-${index}`}
					attachment={attachment}
					tone={tone}
				/>
			))}
		</div>
	)
}

/** True when the message carries a task_progress notification. */
function isTaskProgressMessage(message: SessionMessage): boolean {
	const meta = parseMessageMeta(message)
	return meta.notification_type === 'task_progress' && typeof meta.task_id === 'string'
}

// ── TaskActionBar ─────────────────────────────────────────────────────────

interface TaskActionBarProps {
	taskId: string
	taskNeedsApproval: boolean
}

function TaskActionBar({ taskId, taskNeedsApproval }: TaskActionBarProps) {
	const [replyOpen, setReplyOpen] = useState(false)
	const [rejectOpen, setRejectOpen] = useState(false)
	const [message, setMessage] = useState('')

	const approveTask = useApproveTask()
	const rejectTask = useRejectTask()
	const replyTask = useReplyTask()

	function handleApprove() {
		approveTask.mutate(taskId, {
			onSuccess: () => {
				toast.success('Task approved')
			},
			onError: (err) => {
				toast.error(err.message)
			},
		})
	}

	function handleReject() {
		if (!message.trim()) return
		rejectTask.mutate(
			{ id: taskId, message: message.trim() },
			{
				onSuccess: () => {
					toast.success('Task rejected')
					setRejectOpen(false)
					setMessage('')
				},
				onError: (err) => {
					toast.error(err.message)
				},
			},
		)
	}

	function handleReply() {
		if (!message.trim()) return
		replyTask.mutate(
			{ id: taskId, message: message.trim() },
			{
				onSuccess: () => {
					toast.success('Reply sent')
					setReplyOpen(false)
					setMessage('')
				},
				onError: (err) => {
					toast.error(err.message)
				},
			},
		)
	}

	function openReply() {
		setRejectOpen(false)
		setMessage('')
		setReplyOpen(true)
	}

	function openReject() {
		setReplyOpen(false)
		setMessage('')
		setRejectOpen(true)
	}

	function cancelInput() {
		setReplyOpen(false)
		setRejectOpen(false)
		setMessage('')
	}

	const isRejectPending = rejectTask.isPending
	const isReplyPending = replyTask.isPending
	const isApprovePending = approveTask.isPending

	return (
		<div className="mt-2 flex flex-col gap-1.5">
			{/* Primary action row */}
			<div className="flex items-center gap-1.5">
				{taskNeedsApproval && (
					<>
						<Button size="xs" variant="success" loading={isApprovePending} onClick={handleApprove}>
							<Check size={11} weight="bold" />
							Approve
						</Button>
						<Button size="xs" variant="destructive" onClick={openReject}>
							<X size={11} weight="bold" />
							Reject
						</Button>
					</>
				)}
				<Button size="xs" variant="outline" onClick={openReply}>
					<ArrowBendUpLeft size={11} weight="bold" />
					Reply
				</Button>
			</div>

			{/* Inline reject input */}
			{rejectOpen && (
				<div className="flex flex-col gap-1.5 border-l-2 border-destructive/40 pl-3">
					<textarea
						className="w-full resize-none rounded-md border border-destructive/15 bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-[3px] focus:ring-ring/20"
						placeholder="Reason for rejection (required)..."
						rows={3}
						value={message}
						onChange={(e) => setMessage(e.target.value)}
					/>
					<div className="flex items-center gap-1.5">
						<Button
							size="xs"
							variant="destructive"
							loading={isRejectPending}
							disabled={!message.trim()}
							onClick={handleReject}
						>
							<X size={11} weight="bold" />
							Reject
						</Button>
						<Button size="xs" variant="ghost" onClick={cancelInput}>
							Cancel
						</Button>
					</div>
				</div>
			)}

			{/* Inline reply input */}
			{replyOpen && (
				<div className="flex flex-col gap-1.5 border-l-2 border-border pl-3">
					<textarea
						className="w-full resize-none rounded-md border border-border/70 bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-[3px] focus:ring-ring/20"
						placeholder="Send a reply message..."
						rows={3}
						value={message}
						onChange={(e) => setMessage(e.target.value)}
					/>
					<div className="flex items-center gap-1.5">
						<Button
							size="xs"
							variant="default"
							loading={isReplyPending}
							disabled={!message.trim()}
							onClick={handleReply}
						>
							<ArrowBendUpLeft size={11} weight="bold" />
							Reply
						</Button>
						<Button size="xs" variant="ghost" onClick={cancelInput}>
							Cancel
						</Button>
					</div>
				</div>
			)}
		</div>
	)
}

// ── ChatMessage ────────────────────────────────────────────────────────────

export function ChatMessage({
	message,
	queryRunId,
	taskId,
	taskNeedsApproval = false,
	isNextAssistant = false,
}: ChatMessageProps) {
	const isUser = message.role === 'user'
	const isSystem = message.role === 'system'

	const timestamp = new Date(message.created_at).toLocaleTimeString(undefined, {
		hour: '2-digit',
		minute: '2-digit',
	})
	const attachments = getMessageAttachments(message)

	// System messages: only surface task-progress notifications; drop everything else
	if (isSystem) {
		const isTaskProgress = isTaskProgressMessage(message)
		if (!isTaskProgress || !taskId) return null

		return (
			<div className="flex w-full justify-start">
				<div className="max-w-[85%] px-4 py-2">
					<p className="mb-1 text-sm font-medium text-muted-foreground">
						Task update
					</p>
					{message.content && (
						<p className="font-sans text-sm text-muted-foreground leading-relaxed">
							{message.content.replace(/^\[task_progress\]\s*/, '')}
						</p>
					)}
					<TaskActionBar taskId={taskId} taskNeedsApproval={taskNeedsApproval} />
					<p className="mt-2 text-xs text-muted-foreground tabular-nums">{timestamp}</p>
				</div>
			</div>
		)
	}

	if (isUser) {
		return (
			<div className="flex w-full items-end flex-col justify-end">
				<div className="max-w-[72%] rounded-lg bg-secondary px-3 py-2.5 shadow-xs">
					{message.content && (
						<p className="font-sans text-sm leading-relaxed text-secondary-foreground whitespace-pre-wrap wrap-break-word">
							<SmartText text={message.content} />
						</p>
					)}
					<MessageAttachments attachments={attachments} />
				</div>
				{!!isNextAssistant && (
					<p className="text-xs text-muted-foreground tabular-nums">{timestamp}</p>
				)}
			</div>
		)
	}

	// Assistant — one unified block: events interleaved with text, chronological
	return (
		<div className="flex w-full flex-col items-start justify-start">
			<div className="max-w-[85%] bg-transparent px-4 py-3">
				{/* <div className="flex items-center gap-4 justify-between">
					<p className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
						Assistant
					</p>
					</div> */}
				{queryRunId ? (
					<InlineRunEvents runId={queryRunId} fallbackContent={message.content} />
				) : (
					<Markdown content={message.content} className="prose prose-sm font-sans text-sm" />
				)}
				<MessageAttachments attachments={attachments} tone="subtle" />
				{taskId && <TaskActionBar taskId={taskId} taskNeedsApproval={taskNeedsApproval} />}
			</div>
			{!isNextAssistant && (
				<p className="text-xs text-muted-foreground tabular-nums">{timestamp}</p>
			)}
		</div>
	)
}
