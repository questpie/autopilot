import type { Artifact, Task, TaskWithRelations } from '@/api/types'
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
	type InspectorHeaderAction,
	InspectorLayout,
} from '@/components/ui/inspector-layout'
import { KvList } from '@/components/ui/kv-list'
import { Markdown } from '@/components/ui/markdown'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { buildChatContextSearch } from '@/features/chat/lib/chat-context'
import { setDraggedChatAttachment } from '@/features/chat/lib/chat-dnd'
import { useQueryList } from '@/hooks/use-queries'
import { useRuns } from '@/hooks/use-runs'
import { useSessions, useTaskThread } from '@/hooks/use-sessions'
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
import { buildRunsTimeline, buildTimeline } from '../lib/build-timeline'
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

export function TaskDetail({ detail, isLoading, onBack, onSelectTask }: TaskDetailProps) {
	// ALL hooks before any early returns (React hooks rule)
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
	const navigate = useNavigate()

	const isTaskActive =
		detail?.status === 'active' || detail?.status === 'backlog' || detail?.status === 'blocked'
	const taskThread = useTaskThread(detail?.id ?? null, isTaskActive)

	const workflow = detail?.workflow_id
		? ((workflowsQuery.data ?? []).find((w) => w.id === detail.workflow_id) ?? null)
		: null

	const timelineEntries = useMemo(() => {
		if (!detail || !runsQuery.data) return []
		let metadata: Record<string, unknown> = {}
		try {
			metadata = JSON.parse(detail.metadata ?? '{}')
		} catch (_e) {
			// malformed metadata — ignore
		}

		if (workflow) {
			return buildTimeline(workflow.steps, runsQuery.data, detail.workflow_step ?? null, metadata)
		}

		return buildRunsTimeline(runsQuery.data)
	}, [workflow, runsQuery.data, detail])

	const artifactsByRunId = useMemo(() => {
		return (artifactsQuery.data ?? []).reduce<Record<string, Artifact[]>>((acc, artifact) => {
			const runId = artifact.run_id
			if (!runId) return acc
			acc[runId] ??= []
			acc[runId].push(artifact)
			return acc
		}, {})
	}, [artifactsQuery.data])

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
		const dashboardTaskSessionId = relatedSessions.find(
			(session) => session.provider_id === 'dashboard' && session.task_id === detail.id,
		)?.id

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
				if (sessionId) return [[run.id, sessionId] as const]
				return dashboardTaskSessionId ? [[run.id, dashboardTaskSessionId] as const] : []
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

			{detail.description && (
        <Markdown
          content={detail.description}
          className="mt-4"
          contentClassName="[&_.ProseMirror]:px-0 [&_.ProseMirror]:py-0 [&_.ProseMirror]:text-[13px] [&_.ProseMirror]:leading-6"
        />
      )}

			{timelineEntries.length > 0 && (
				<>
					<div className="my-4" />
					<div className="mb-3 flex items-center gap-2">
						<p className="text-sm font-medium text-muted-foreground">
							{workflow ? 'Workflow timeline' : 'Run timeline'}
						</p>
						{workflow && (
							<Link
								to="/files"
								search={{ path: `.autopilot/workflows/${detail.workflow_id}.yaml`, view: 'file' }}
								className="text-sm text-primary hover:underline"
							>
								{workflow.name}
							</Link>
						)}
					</div>
					<WorkflowTimeline
						entries={timelineEntries}
						runSessionIds={runSessionIds}
						artifactsByRunId={artifactsByRunId}
					/>
				</>
			)}

			{taskThread.messages.length > 0 && (
				<>
					<div className="my-4" />
					<p className="text-sm font-medium text-muted-foreground mb-3">Thread</p>
					<div className="space-y-2">
						{taskThread.messages.map((msg) => (
							<div key={msg.id} className="flex gap-2 text-[13px]">
								<span className="text-xs text-muted-foreground tabular-nums shrink-0">
									{new Date(msg.created_at).toLocaleTimeString(undefined, {
										hour: '2-digit',
										minute: '2-digit',
									})}
								</span>
								{msg.role === 'system' ? (
									<span className="text-muted-foreground">
										{msg.content.replace(/^\[task_progress\]\s*/, '')}
									</span>
								) : (
									<Markdown content={msg.content} className="flex-1" />
								)}
							</div>
						))}
					</div>
				</>
			)}
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
