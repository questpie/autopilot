import type { Task, TaskWithRelations } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import {
	InspectorHeader,
	InspectorLayout,
	type InspectorHeaderAction,
} from '@/components/ui/inspector-layout'
import { KvList } from '@/components/ui/kv-list'
import { Markdown } from '@/components/ui/markdown'
import { Spinner } from '@/components/ui/spinner'
import { StatusPill } from '@/components/ui/status-pill'
import { surfaceCardVariants } from '@/components/ui/surface-card'
import { Textarea } from '@/components/ui/textarea'
import { useChatWorkspace } from '@/features/chat/chat-workspace-context'
import { buildChatContextSearch } from '@/features/chat/lib/chat-context'
import { setDraggedChatAttachment } from '@/features/chat/lib/chat-dnd'
import { useQueryList } from '@/hooks/use-queries'
import { useRuns } from '@/hooks/use-runs'
import { useSessions } from '@/hooks/use-sessions'
import {
	useApproveTask,
	useCancelTask,
	useRejectTask,
	useReplyTask,
	useRetryTask,
	useTaskArtifacts,
} from '@/hooks/use-tasks'
import { useWorkflows } from '@/hooks/use-workflows'
import { SmartText } from '@/lib/smart-links'
import { taskStatusToPill } from '@/lib/status-colors'
import { cn } from '@/lib/utils'
import {
	ArrowBendUpLeft,
	ArrowLeft,
	ChatCircle,
	Check,
	Lightning,
	Stop,
	Timer,
	X,
} from '@phosphor-icons/react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { buildTimeline } from '../lib/build-timeline'
import { ArtifactList } from './artifact-list'
import { RunViewerSheet } from './run-viewer-sheet'
import { WorkflowTimeline } from './workflow-timeline'

interface TaskDetailProps {
	detail: TaskWithRelations | null | undefined
	isLoading: boolean
	onBack: () => void
	onSelectTask?: (id: string) => void
}

const TASK_TYPE_CONFIG: Record<
	string,
	{ icon: typeof ChatCircle; label: string; variant: 'default' | 'info' | 'warning' }
> = {
	query: { icon: ChatCircle, label: 'query', variant: 'info' },
	scheduled: { icon: Timer, label: 'scheduled', variant: 'warning' },
	task: { icon: Lightning, label: 'task', variant: 'default' },
}

function TaskTypeBadge({ type }: { type: string }) {
	const config = TASK_TYPE_CONFIG[type]
	if (!config) {
		return <Badge variant="outline">{type}</Badge>
	}
	const Icon = config.icon
	return (
		<Badge variant={config.variant}>
			<Icon data-icon="inline-start" weight="bold" />
			{config.label}
		</Badge>
	)
}

function formatTimestamp(iso: string): string {
	return new Date(iso).toLocaleString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	})
}

function RelationChip({
	task,
	relation,
	onSelect,
	className,
}: {
	task: Task
	relation: string
	onSelect?: (id: string) => void
	className?: string
}) {
	return (
		<Button
			type="button"
			onClick={onSelect ? () => onSelect(task.id) : undefined}
			title={`${relation}: ${task.title}`}
			variant="ghost"
			size={'xs'}
			className={cn(
				'max-w-full truncate gap-2 space-x-2 line-clamp-1 justify-start text-left',
				className,
			)}
		>
			<span className="text-[10px] text-primary">{relation}</span>
			<span>{task.title}</span>
		</Button>
	)
}

// ── Action dialog state type ────────────────────────────────────────────────
type ActionDialog = 'approve' | 'reject' | 'reply' | 'cancel' | null

const LIVE_RUN_STATUSES = new Set(['pending', 'claimed', 'running'])

export function TaskDetail({ detail, isLoading, onBack, onSelectTask }: TaskDetailProps) {
	// ALL hooks before any early returns (React hooks rule)
	const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
	const [actionDialog, setActionDialog] = useState<ActionDialog>(null)
	const [actionMessage, setActionMessage] = useState('')
	const workflowsQuery = useWorkflows()
	const queriesQuery = useQueryList()
	const runsQuery = useRuns(detail?.id ? { task_id: detail.id } : undefined)
	const artifactsQuery = useTaskArtifacts(detail?.id ?? null)
	const sessionsQuery = useSessions()
	const approveTask = useApproveTask()
	const rejectTask = useRejectTask()
	const replyTask = useReplyTask()
	const retryTaskMutation = useRetryTask()
	const cancelTaskMutation = useCancelTask()
	const { openSession } = useChatWorkspace()
	const navigate = useNavigate()

	const workflow = detail?.workflow_id
		? ((workflowsQuery.data ?? []).find((w) => w.id === detail.workflow_id) ?? null)
		: null

	const timelineEntries = useMemo(() => {
		if (!workflow || !runsQuery.data || !detail) return []
		let metadata: Record<string, unknown> = {}
		try {
			metadata = JSON.parse(detail.metadata ?? '{}')
		} catch (_e) {
			// malformed metadata — ignore
		}
		return buildTimeline(workflow.steps, runsQuery.data, detail.workflow_step ?? null, metadata)
	}, [workflow, runsQuery.data, detail])

	const relatedSessions = useMemo(() => {
		if (!detail) return []
		const runtimeRefs = new Set(
			detail.runs
				.map((run) => run.runtime_session_ref)
				.filter((value): value is string => value !== null),
		)

		return (sessionsQuery.data ?? [])
			.filter((session) => {
				if (session.task_id === detail.id) return true
				return !!session.runtime_session_ref && runtimeRefs.has(session.runtime_session_ref)
			})
			.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
	}, [detail, sessionsQuery.data])

	const runSessionIds = useMemo(() => {
		if (!detail) return {}

		const querySessionIds = new Map(
			(queriesQuery.data ?? []).flatMap((query) =>
				query.run_id && query.session_id ? [[query.run_id, query.session_id] as const] : [],
			),
		)

		const sessionByRuntimeRef = new Map(
			relatedSessions.flatMap((session) =>
				session.runtime_session_ref ? [[session.runtime_session_ref, session.id] as const] : [],
			),
		)

		return Object.fromEntries(
			detail.runs.flatMap((run) => {
				const querySessionId = querySessionIds.get(run.id)
				if (querySessionId) return [[run.id, querySessionId] as const]

				const sessionId = run.runtime_session_ref
					? sessionByRuntimeRef.get(run.runtime_session_ref)
					: undefined
				return sessionId ? [[run.id, sessionId] as const] : []
			}),
		)
	}, [detail, queriesQuery.data, relatedSessions])

	// ── Action bar conditions ────────────────────────────────────────────────
	const currentStep =
		workflow && detail?.workflow_step
			? (workflow.steps.find((s) => s.id === detail.workflow_step) ?? null)
			: null
	const isHumanApproval = currentStep?.type === 'human_approval' && detail?.status === 'blocked'
	const canReply = isHumanApproval
	const canRetry = detail?.status === 'failed'
	const canCancel =
		detail?.status === 'active' || detail?.status === 'backlog' || detail?.status === 'blocked'

	// ── Action dialog handlers ───────────────────────────────────────────────
	function closeActionDialog() {
		setActionDialog(null)
		setActionMessage('')
	}

	function handleApprove() {
		if (!detail) return
		approveTask.mutate(detail.id, { onSuccess: closeActionDialog })
	}

	function handleReject() {
		if (!detail || !actionMessage.trim()) return
		rejectTask.mutate(
			{ id: detail.id, message: actionMessage.trim() },
			{ onSuccess: closeActionDialog },
		)
	}

	function handleReply() {
		if (!detail || !actionMessage.trim()) return
		replyTask.mutate(
			{ id: detail.id, message: actionMessage.trim() },
			{ onSuccess: closeActionDialog },
		)
	}

	function handleRetry() {
		if (!detail) return
		retryTaskMutation.mutate(detail.id)
	}

	function handleCancel() {
		if (!detail || !actionMessage.trim()) return
		cancelTaskMutation.mutate(
			{ id: detail.id, reason: actionMessage.trim() },
			{ onSuccess: closeActionDialog },
		)
	}

	if (isLoading && !detail) {
		return (
			<div className="flex h-full flex-col">
				<div className="flex items-center gap-3 px-4 py-3 shrink-0">
					<Button size="icon-xs" variant="ghost" onClick={onBack} title="Back to tasks">
						<ArrowLeft size={14} weight="bold" />
					</Button>
					<h2 className="text-xs font-medium text-foreground truncate flex-1">Loading…</h2>
				</div>
				<div className="flex flex-1 items-center justify-center">
					<Spinner size="lg" className="text-muted-foreground" />
				</div>
			</div>
		)
	}

	if (!detail) {
		return (
			<div className="flex h-full flex-col">
				<div className="flex items-center gap-3 px-4 py-3 shrink-0">
					<Button size="icon-xs" variant="ghost" onClick={onBack} title="Back to tasks">
						<ArrowLeft size={14} weight="bold" />
					</Button>
					<h2 className="text-xs font-medium text-foreground truncate flex-1">Task not found</h2>
				</div>
				<div className="flex flex-1 items-center justify-center">
					<p className="text-sm text-muted-foreground">Task not found</p>
				</div>
			</div>
		)
	}

	const hasRelated =
		detail.parents.length > 0 ||
		detail.children.length > 0 ||
		detail.dependencies.length > 0 ||
		detail.dependents.length > 0

	const headerActions: InspectorHeaderAction[] = []
	if (isHumanApproval) {
		headerActions.push(
			{
				type: 'button',
				id: 'approve',
				label: 'Approve',
				onClick: () => setActionDialog('approve'),
				variant: 'default' as const,
			},
			{
				type: 'button',
				id: 'reject',
				label: 'Reject',
				onClick: () => setActionDialog('reject'),
				variant: 'destructive' as const,
			},
		)
	}

	if (canReply) {
		headerActions.push({
			type: 'button',
			id: 'reply',
			label: 'Reply',
			onClick: () => setActionDialog('reply'),
			variant: 'outline' as const,
		})
	}

	headerActions.push({
		type: 'button',
		id: 'ask_in_chat',
		label: 'Ask in chat',
		onClick: () => {
			void navigate({
				to: '/chat',
				search: buildChatContextSearch({
					refType: 'task',
					refId: detail.id,
					label: `Task ${detail.id.slice(0, 8)} ${detail.title}`,
				}),
			})
		},
	})

	if (canRetry) {
		headerActions.push({
			type: 'button',
			id: 'retry',
			label: 'Retry',
			onClick: handleRetry,
			variant: 'outline' as const,
		})
	}

	if (canCancel) {
		headerActions.push({
			type: 'button',
			id: 'cancel',
			label: 'Cancel',
			onClick: () => setActionDialog('cancel'),
			variant: 'destructive' as const,
		})
	}

	const header = <InspectorHeader onBack={onBack} title={detail.title} actions={headerActions} />

	const content = (
		<>
			<h1
				className="text-xl font-semibold leading-snug text-foreground"
				draggable
				onDragStart={(e) => {
					setDraggedChatAttachment(e.dataTransfer, {
						type: 'ref',
						source: 'drag',
						label: `Task ${detail.id.slice(0, 8)} ${detail.title}`,
						refType: 'task',
						refId: detail.id,
						metadata: { view: 'tasks', taskId: detail.id },
					})
				}}
			>
				<SmartText text={detail.title} />
			</h1>

			{detail.description && <Markdown content={detail.description} className="mt-4 text-[13px]" />}

			{workflow && timelineEntries.length > 0 && (
				<>
					<div className="my-4" />
					<div className="mb-3 flex items-center gap-2">
						<p className="text-sm font-medium text-muted-foreground">Workflow</p>
						<Link
							to="/files"
							search={{ path: `.autopilot/workflows/${detail.workflow_id}.yaml`, view: 'file' }}
							className="text-sm text-primary hover:underline"
						>
							{workflow.name}
						</Link>
					</div>
					<WorkflowTimeline entries={timelineEntries} runSessionIds={runSessionIds} />
				</>
			)}

			{detail.runs.length > 0 && !(workflow && timelineEntries.length > 0) && (
				<>
					<div className="my-4" />
					<p className="mb-3 text-sm font-medium text-muted-foreground">Runs</p>
					<div className="space-y-1.5">
						{detail.runs.map((run) => {
							const runArtifacts = (artifactsQuery.data ?? []).filter((a) => a.run_id === run.id)
							return (
								<div key={run.id}>
									<button
										type="button"
										onClick={() => setSelectedRunId(run.id)}
										draggable
										onDragStart={(e) => {
											setDraggedChatAttachment(e.dataTransfer, {
												type: 'ref',
												source: 'drag',
												label: `Run ${run.id.slice(0, 8)}`,
												refType: 'run',
												refId: run.id,
												metadata: { runId: run.id, taskId: detail.id },
											})
										}}
										className={cn(
											surfaceCardVariants({ size: 'sm', interactive: true }),
											'w-full text-left',
										)}
									>
										<div className="flex items-center justify-between gap-2">
											<StatusPill
												status={taskStatusToPill(run.status)}
												pulse={LIVE_RUN_STATUSES.has(run.status)}
											/>
											<div className="flex items-center gap-2 flex-wrap justify-end">
												{runArtifacts.length > 0 && (
													<span className="text-xs text-muted-foreground tabular-nums">
														{runArtifacts.length} artifact{runArtifacts.length !== 1 ? 's' : ''}
													</span>
												)}
												{run.worker_id && (
													<span className="text-xs text-muted-foreground tabular-nums">
														worker:{run.worker_id.slice(0, 8)}
													</span>
												)}
												<span className="text-xs text-muted-foreground">{run.agent_id}</span>
											</div>
										</div>
										<p className="mt-1 text-xs text-muted-foreground tabular-nums">
											{run.id.slice(0, 16)}…
										</p>
										{run.summary && (
											<div className="mt-1.5">
												<Markdown content={run.summary} className="text-[12px]" />
											</div>
										)}
										{run.error && (
											<div className="mt-1 bg-destructive-surface px-2 py-1.5">
												<Markdown content={run.error} className="text-[12px] text-destructive" />
											</div>
										)}
										<div className="mt-1.5 flex flex-wrap gap-3">
											{run.runtime_session_ref && (
												<span className="text-xs text-muted-foreground tabular-nums">
													runtime:{run.runtime_session_ref.slice(0, 12)}
												</span>
											)}
											{run.preferred_worker_id && !run.worker_id && (
												<span className="text-xs text-muted-foreground tabular-nums">
													preferred:{run.preferred_worker_id.slice(0, 8)}
												</span>
											)}
											{run.model && (
												<span className="text-xs text-muted-foreground">{run.model}</span>
											)}
											{run.started_at && (
												<span className="text-xs text-muted-foreground tabular-nums">
													{formatTimestamp(run.started_at)}
												</span>
											)}
										</div>
									</button>
									{(runSessionIds[run.id] || run.runtime_session_ref) && (
										<div className="mt-1 flex flex-wrap gap-1.5 pl-3">
											{runSessionIds[run.id] ? (
												<Button
													onClick={() => openSession(runSessionIds[run.id]!)}
													size="xs"
													variant="secondary"
													draggable
													onDragStart={(e) => {
														setDraggedChatAttachment(e.dataTransfer, {
															type: 'ref',
															source: 'drag',
															label: `Session ${runSessionIds[run.id]!.slice(0, 8)}`,
															refType: 'session',
															refId: runSessionIds[run.id]!,
															metadata: { sessionId: runSessionIds[run.id]!, runId: run.id },
														})
													}}
												>
													<ChatCircle data-icon="inline-start" />
													session:{runSessionIds[run.id].slice(0, 8)}
												</Button>
											) : (
												<Badge variant="outline">
													<ChatCircle data-icon="inline-start" />
													runtime:{run.runtime_session_ref?.slice(0, 8) ?? 'unknown'}
												</Badge>
											)}
										</div>
									)}
									{runArtifacts.length > 0 && (
										<div className="mt-1 pl-3">
											<ArtifactList artifacts={runArtifacts} />
										</div>
									)}
								</div>
							)
						})}
					</div>
				</>
			)}

			{(() => {
				const allArtifacts = artifactsQuery.data ?? []
				if (allArtifacts.length === 0) return null
				return (
					<>
						<div className="my-4" />
						<p className="mb-3 text-sm font-medium text-muted-foreground">Artifacts</p>
						<ArtifactList artifacts={allArtifacts} />
					</>
				)
			})()}
		</>
	)

	const sidebar = (
		<>
			<KvList
				items={[
					...(detail.assigned_to
						? [{ label: 'Agent', value: <span className="text-sm">{detail.assigned_to}</span> }]
						: []),
					{
						label: 'Priority',
						value: <span className="text-[12px] capitalize">{detail.priority}</span>,
					},
					{ label: 'Type', value: <TaskTypeBadge type={detail.type} /> },
					...(workflow
						? [{ label: 'Workflow', value: <span className="text-sm">{workflow.name}</span> }]
						: []),
					...(detail.workflow_step
						? [
								{
									label: 'Current Step',
									value: <span className="text-sm">{detail.workflow_step}</span>,
								},
							]
						: []),
					{
						label: 'Created',
						value: (
							<span className="text-xs text-muted-foreground tabular-nums">
								{formatTimestamp(detail.created_at)}
							</span>
						),
					},
					{
						label: 'Updated',
						value: (
							<span className="text-xs text-muted-foreground tabular-nums">
								{formatTimestamp(detail.updated_at)}
							</span>
						),
					},
				]}
			/>

			{hasRelated && (
				<>
					<div className="mt-5" />
					<p className="mb-2 mt-4 text-xs font-medium text-muted-foreground">Relations</p>
					<div className="flex flex-wrap gap-1.5">
						{detail.parents.map((t) => (
							<RelationChip
								key={`parent-${t.id}`}
								task={t}
								relation="parent"
								onSelect={onSelectTask}
							/>
						))}
						{detail.children.map((t) => (
							<RelationChip
								key={`child-${t.id}`}
								task={t}
								relation="child"
								onSelect={onSelectTask}
							/>
						))}
						{detail.dependencies.map((t) => (
							<RelationChip
								key={`dependency-${t.id}`}
								task={t}
								relation="depends on"
								onSelect={onSelectTask}
							/>
						))}
						{detail.dependents.map((t) => (
							<RelationChip
								key={`dependent-${t.id}`}
								task={t}
								relation="blocks"
								onSelect={onSelectTask}
							/>
						))}
					</div>
				</>
			)}
		</>
	)

	return (
		<>
			<RunViewerSheet runId={selectedRunId} onClose={() => setSelectedRunId(null)} />

			{/* Approve dialog */}
			<Dialog
				open={actionDialog === 'approve'}
				onOpenChange={(open) => {
					if (!open) closeActionDialog()
				}}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="text-sm font-semibold">Approve step</DialogTitle>
					</DialogHeader>
					<p className="text-[13px] text-muted-foreground">
						Approve this workflow step? The workflow will advance to the next step.
					</p>
					<DialogFooter>
						<Button
							variant="default"
							size="sm"
							loading={approveTask.isPending}
							onClick={handleApprove}
						>
							<Check size={12} weight="bold" />
							Approve
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Reject dialog */}
			<Dialog
				open={actionDialog === 'reject'}
				onOpenChange={(open) => {
					if (!open) closeActionDialog()
				}}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="text-sm font-semibold">Reject step</DialogTitle>
					</DialogHeader>
					<Textarea
						className="text-sm"
						placeholder="Reason for rejection (required)..."
						rows={4}
						value={actionMessage}
						onChange={(e) => setActionMessage(e.target.value)}
						autoFocus
					/>
					<DialogFooter>
						<Button
							variant="destructive"
							size="sm"
							disabled={!actionMessage.trim() || rejectTask.isPending}
							loading={rejectTask.isPending}
							onClick={handleReject}
						>
							<X size={12} weight="bold" />
							Reject
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Reply dialog */}
			<Dialog
				open={actionDialog === 'reply'}
				onOpenChange={(open) => {
					if (!open) closeActionDialog()
				}}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="text-sm font-semibold">Reply to task</DialogTitle>
					</DialogHeader>
					<Textarea
						className="text-sm"
						placeholder="Send a reply message..."
						rows={4}
						value={actionMessage}
						onChange={(e) => setActionMessage(e.target.value)}
						autoFocus
					/>
					<DialogFooter>
						<Button
							variant="default"
							size="sm"
							disabled={!actionMessage.trim() || replyTask.isPending}
							loading={replyTask.isPending}
							onClick={handleReply}
						>
							<ArrowBendUpLeft size={12} weight="bold" />
							Reply
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Cancel dialog */}
			<Dialog
				open={actionDialog === 'cancel'}
				onOpenChange={(open) => {
					if (!open) closeActionDialog()
				}}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="text-sm font-semibold">Cancel task</DialogTitle>
					</DialogHeader>
					<Textarea
						className="text-sm"
						placeholder="Reason for cancellation (required)..."
						rows={4}
						value={actionMessage}
						onChange={(e) => setActionMessage(e.target.value)}
						autoFocus
					/>
					<DialogFooter>
						<Button
							variant="destructive"
							size="sm"
							disabled={!actionMessage.trim() || cancelTaskMutation.isPending}
							loading={cancelTaskMutation.isPending}
							onClick={handleCancel}
						>
							<Stop size={12} weight="bold" />
							Cancel Task
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<InspectorLayout
				header={header}
				content={content}
				sidebar={sidebar}
				contentClassName="overflow-y-auto px-5 py-3.5"
				sidebarClassName="bg-transparent px-3 py-2"
			/>
		</>
	)
}
