import { useEffect, useRef, useMemo } from 'react'
import { ArrowLeft, ClockCounterClockwise, ChatTeardrop } from '@phosphor-icons/react'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import type { ConversationViewModel } from '@/api/conversations.api'
import { useRunStream } from '@/hooks/use-run-stream'
import { useWorkflows } from '@/hooks/use-workflows'
import { ChatMessage } from './chat-message'
import { RunEventFeed } from './run-event-feed'

interface ChatThreadProps {
	conversation: ConversationViewModel
	isLoading: boolean
	isAgentThinking: boolean
	activeRunId: string | null
	onBack: () => void
	onHistory?: () => void
	showHeader?: boolean
}

function ThreadMetaChip({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'live' | 'warning' }) {
	const toneClass =
		tone === 'live'
			? 'bg-info-surface text-info'
			: tone === 'warning'
				? 'bg-warning-surface text-warning'
				: 'bg-muted/40 text-muted-foreground'

	return (
		<span className={`inline-flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-medium ${toneClass}`}>
			<span className="opacity-70">{label}:</span>
			<span className="max-w-[180px] truncate">{value}</span>
		</span>
	)
}

export function ChatThread({
	conversation,
	isLoading,
	isAgentThinking,
	activeRunId,
	onBack,
	onHistory,
	showHeader = true,
}: ChatThreadProps) {
	const bottomRef = useRef<HTMLDivElement>(null)
	const stream = useRunStream(isAgentThinking ? activeRunId : null)
	const workflowsQuery = useWorkflows()

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
	}, [conversation.messages.length, stream.events.length])

	// Derive task action context for the conversation
	const taskId = conversation.task?.id ?? null
	const activeQuery = useMemo(
		() => conversation.queries.find((q) => q.status === 'pending' || q.status === 'running') ?? null,
		[conversation.queries],
	)
	const taskNeedsApproval = useMemo(() => {
		const task = conversation.task
		if (!task || task.status !== 'blocked' || !task.workflow_step || !task.workflow_id) return false
		const workflows = workflowsQuery.data ?? []
		const workflow = workflows.find((w) => w.id === task.workflow_id)
		if (!workflow) return false
		const step = workflow.steps.find((s) => s.id === task.workflow_step)
		return step?.type === 'human_approval'
	}, [conversation.task, workflowsQuery.data])
	const hasSessionMeta =
		!!activeRunId ||
		!!conversation.session.preferred_worker_id ||
		!!conversation.session.runtime_session_ref ||
		!!activeQuery ||
		taskNeedsApproval

	return (
		<div className="flex h-full flex-col overflow-hidden">
			{/* Thread header */}
			{showHeader && (
				<div className="flex h-12 shrink-0 items-center gap-3 px-4">
					<Button size="icon-xs" variant="ghost" onClick={onBack} title="Back">
						<ArrowLeft size={14} weight="bold" />
					</Button>
					<h2 className="flex-1 truncate text-sm font-semibold text-foreground">
						{conversation.title || 'New conversation'}
					</h2>
					{onHistory && (
						<Button size="icon-xs" variant="ghost" onClick={onHistory} title="All conversations">
							<ClockCounterClockwise size={14} />
						</Button>
					)}
				</div>
			)}

			{hasSessionMeta && (
				<div className="flex flex-wrap gap-1.5 px-4 pb-2">
					<ThreadMetaChip label="session" value={conversation.session.id.slice(0, 8)} />
					{activeRunId && <ThreadMetaChip label="run" value={activeRunId.slice(0, 8)} tone="live" />}
					{activeQuery && (
						<ThreadMetaChip
							label="state"
							value={activeQuery.status === 'pending' ? 'queued' : 'running'}
							tone="live"
						/>
					)}
					{conversation.session.preferred_worker_id && (
						<ThreadMetaChip
							label="worker"
							value={conversation.session.preferred_worker_id.slice(0, 8)}
						/>
					)}
					{conversation.session.runtime_session_ref && (
						<ThreadMetaChip
							label="runtime"
							value={conversation.session.runtime_session_ref.slice(0, 12)}
						/>
					)}
					{taskNeedsApproval && (
						<ThreadMetaChip label="task" value="awaiting approval" tone="warning" />
					)}
				</div>
			)}

			{/* Messages */}
			<div className="overflow-y-auto flex-1 relative">
				<div className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-5">
					{conversation.messages.length === 0 && isLoading && (
						<div className="flex items-center justify-center py-12">
							<Spinner />
						</div>
					)}

					{conversation.messages.length === 0 && !isLoading && (
						<EmptyState
							icon={ChatTeardrop}
							title="No messages yet"
							description="Send a message below to start the conversation."
							height="h-48"
						/>
					)}

					{conversation.messages.map((msg, i) => {
						// Assistant messages already carry query_id, so use the real query linkage
						// instead of legacy qsummary-* placeholder IDs.
						const nextMsg = conversation.messages[i + 1]
						let queryRunId: string | null = null
						if (msg.role === 'assistant' && msg.query_id) {
							const query = conversation.queries.find((q) => q.id === msg.query_id)
							if (query?.run_id && (query.status === 'completed' || query.status === 'failed')) {
								queryRunId = query.run_id
							}
						}
						return (
							<ChatMessage
								key={msg.id}
								message={msg}
								queryRunId={queryRunId}
								taskId={taskId}
								taskNeedsApproval={taskNeedsApproval}
								isNextAssistant={nextMsg?.role === 'assistant'}
							/>
						)
					})}

					{isAgentThinking && stream.events.length > 0 && (
						<RunEventFeed events={stream.events} isStreaming={!stream.isComplete} />
					)}

					{isAgentThinking && stream.events.length === 0 && (
						<div className="flex w-full justify-start">
							<div className="flex items-center gap-1.5 px-1 py-2">
								<span
									className="inline-block size-1.5 animate-pulse rounded-full bg-muted-foreground"
									style={{ animationDelay: '0ms' }}
								/>
								<span
									className="inline-block size-1.5 animate-pulse rounded-full bg-muted-foreground"
									style={{ animationDelay: '150ms' }}
								/>
								<span
									className="inline-block size-1.5 animate-pulse rounded-full bg-muted-foreground"
									style={{ animationDelay: '300ms' }}
								/>
							</div>
						</div>
					)}

					<div ref={bottomRef} />
				</div>
			</div>
		</div>
	)
}
