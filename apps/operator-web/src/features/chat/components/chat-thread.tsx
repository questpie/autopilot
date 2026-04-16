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
}

export function ChatThread({
	conversation,
	isLoading,
	isAgentThinking,
	activeRunId,
	onBack,
	onHistory,
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
	const taskNeedsApproval = useMemo(() => {
		const task = conversation.task
		if (!task || task.status !== 'active' || !task.workflow_step || !task.workflow_id) return false
		const workflows = workflowsQuery.data ?? []
		const workflow = workflows.find((w) => w.id === task.workflow_id)
		if (!workflow) return false
		const step = workflow.steps.find((s) => s.id === task.workflow_step)
		return step?.type === 'human_approval'
	}, [conversation.task, workflowsQuery.data])

	return (
		<div className="flex h-full flex-col overflow-hidden">
			{/* Thread header */}
			<div className="flex h-14 items-center gap-3 px-4 shrink-0">
				<Button size="icon-xs" variant="ghost" onClick={onBack} title="Back">
					<ArrowLeft size={14} weight="bold" />
				</Button>
				<h2 className="text-sm font-medium text-foreground truncate flex-1">
					{conversation.title || 'New conversation'}
				</h2>
				{onHistory && (
					<Button size="icon-xs" variant="ghost" onClick={onHistory} title="All conversations">
						<ClockCounterClockwise size={14} />
					</Button>
				)}
			</div>

			{/* Messages */}
			<div className="overflow-y-auto flex-1 relative">
				<div className="max-w-3xl mx-auto px-6 py-4 flex flex-col gap-4">
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
						// Detect completed query summary messages — show run events inside the message.
						const nextMsg = conversation.messages[i + 1]
						let queryRunId: string | null = null
						if (msg.id.startsWith('qsummary-')) {
							const queryId = msg.id.replace('qsummary-', '')
							const query = conversation.queries.find((q) => q.id === queryId)
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
