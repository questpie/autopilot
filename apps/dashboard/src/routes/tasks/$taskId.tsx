import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { TopBar } from '@/components/layout/top-bar'
import { StatusBadge } from '@/components/data/status-badge'
import { AgentAvatar } from '@/components/data/agent-avatar'
import { RejectDialog } from '@/components/data/reject-dialog'
import { AddResourceDialog } from '@/components/data/add-resource-dialog'
import { EmptyState } from '@/components/feedback/empty-state'
import { ErrorBoundary } from '@/components/feedback/error-boundary'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Linkify } from '@/lib/linkify'
import { renderMarkdown, PROSE_CLASSES } from '@/lib/markdown'
import { useTask, useApproveTask, useRejectTask, useAddTaskLabel } from '@/hooks/use-tasks'
import { useAgents } from '@/hooks/use-agents'
import { useChat, useSendMessage } from '@/hooks/use-chat'
import { ChatBubble } from '@/components/chat/chat-bubble'
import { ChatInput } from '@/components/chat/chat-input'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'

export const Route = createFileRoute('/tasks/$taskId')({
	component: TaskDetailPage,
})

const TABS = ['Description', 'Resources', 'Discussion', 'History', 'Dependencies'] as const
type Tab = (typeof TABS)[number]

function TaskDetailPage() {
	const { taskId } = Route.useParams()
	const navigate = useNavigate()
	const { data: task, isLoading, isError } = useTask(taskId)
	const { data: agents } = useAgents()
	const approveTask = useApproveTask()
	const rejectTask = useRejectTask()
	const addLabel = useAddTaskLabel()
	const [showReject, setShowReject] = useState(false)
	const [showResource, setShowResource] = useState(false)
	const [activeTab, setActiveTab] = useState<Tab>('Description')
	const [labelInput, setLabelInput] = useState('')
	const [showLabelInput, setShowLabelInput] = useState(false)

	const agentRoleMap: Record<string, string> = useMemo(() => {
		const map: Record<string, string> = {}
		if (agents) {
			for (const a of agents) {
				map[a.id] = a.role
				map[a.name] = a.role
			}
		}
		return map
	}, [agents])

	if (isLoading) {
		return (
			<ErrorBoundary>
				<TopBar title="Task" />
				<div className="flex-1 overflow-y-auto p-6 max-w-[900px] space-y-4">
					<Skeleton className="h-8 w-1/2" />
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-40 w-full" />
				</div>
			</ErrorBoundary>
		)
	}

	if (isError || !task) {
		return (
			<ErrorBoundary>
				<TopBar title="Task" />
				<EmptyState icon={'\u26A0'} title="Task not found" description={`Could not find ${taskId}`} />
			</ErrorBoundary>
		)
	}

	const handleApprove = () => {
		approveTask.mutate(task.id)
		navigate({ to: '/' })
	}

	const handleReject = (reason: string) => {
		rejectTask.mutate({ taskId: task.id, reason })
		setShowReject(false)
	}

	const handleAddLabel = () => {
		const label = labelInput.trim()
		if (!label) return
		addLabel.mutate({ taskId: task.id, label })
		setLabelInput('')
		setShowLabelInput(false)
	}

	const priorityColors: Record<string, string> = {
		critical: 'bg-destructive/10 text-destructive',
		high: 'bg-warning/10 text-warning',
		medium: 'bg-info/10 text-info',
		low: 'bg-muted text-muted-foreground',
	}

	return (
		<ErrorBoundary>
			<TopBar title="Task">
				<nav className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
					<Link to="/" className="hover:text-foreground">Dashboard</Link>
					<span>/</span>
					<span>Tasks</span>
					<span>/</span>
					<span className="text-foreground">{task.id}</span>
				</nav>
			</TopBar>
			<div className="flex-1 overflow-y-auto">
				<div className="p-6 max-w-[900px] space-y-6">
					{/* Header */}
					<div className="space-y-3">
						<div className="flex items-center gap-3 flex-wrap">
							<StatusBadge status={task.status} />
							{task.priority && (
								<Badge className={cn('font-mono text-[9px]', priorityColors[task.priority])}>
									{task.priority.toUpperCase()}
								</Badge>
							)}
							<span className="font-mono text-[11px] text-muted-foreground">{task.id}</span>
							{task.workflow_step && (
								<Badge variant="outline" className="font-mono text-[9px]">
									{task.workflow}/{task.workflow_step}
								</Badge>
							)}
						</div>
						<h1 className="text-lg font-semibold tracking-[-0.02em]">{task.title}</h1>
						{task.assigned_to && (
							<div className="flex items-center gap-2">
								<AgentAvatar name={task.assigned_to} role={agentRoleMap[task.assigned_to]} size="md" />
								<span className="font-mono text-[11px]">{task.assigned_to}</span>
								{agentRoleMap[task.assigned_to] && (
									<Badge variant="outline" className="text-[8px]">
										{agentRoleMap[task.assigned_to]}
									</Badge>
								)}
							</div>
						)}
						{/* Labels */}
						{(task.labels?.length ?? 0) > 0 && (
							<div className="flex gap-1.5 flex-wrap">
								{task.labels?.map((label) => (
									<Badge key={label} variant="outline" className="font-mono text-[9px]">
										{label}
									</Badge>
								))}
							</div>
						)}
					</div>

					{/* Actions */}
					<div className="flex gap-2 flex-wrap">
						{task.status === 'review' && (
							<>
								<Button onClick={handleApprove} disabled={approveTask.isPending}>
									{approveTask.isPending ? 'Approving...' : 'Approve'}
								</Button>
								<Button variant="destructive" onClick={() => setShowReject(true)}>
									Reject
								</Button>
							</>
						)}
						{task.status === 'blocked' && (
							<Button onClick={handleApprove} disabled={approveTask.isPending}>
								Resolve & Approve
							</Button>
						)}
						{showLabelInput ? (
							<div className="flex items-center gap-1">
								<Input
									value={labelInput}
									onChange={(e) => setLabelInput(e.target.value)}
									onKeyDown={(e) => e.key === 'Enter' && handleAddLabel()}
									placeholder="label name"
									className="h-8 w-32 text-[11px]"
									autoFocus
								/>
								<Button size="sm" onClick={handleAddLabel}>Add</Button>
								<Button size="sm" variant="outline" onClick={() => setShowLabelInput(false)}>X</Button>
							</div>
						) : (
							<Button variant="outline" size="sm" onClick={() => setShowLabelInput(true)}>
								Add Label
							</Button>
						)}
						<Button variant="outline" size="sm" onClick={() => setShowResource(true)}>
							Add Resource
						</Button>
					</div>

					{/* Tabs */}
					<div className="border-b border-border flex">
						{TABS.map((tab) => (
							<button
								key={tab}
								onClick={() => setActiveTab(tab)}
								className={cn(
									'font-mono text-[11px] font-semibold uppercase tracking-[0.08em] px-5 py-3 cursor-pointer border-b-2 -mb-px transition-colors',
									activeTab === tab
										? 'text-primary border-primary'
										: 'text-muted-foreground border-transparent hover:text-foreground',
								)}
							>
								{tab}
							</button>
						))}
					</div>

					{/* Tab Content */}
					<div className="min-h-[200px]">
						{activeTab === 'Description' && <DescriptionTab task={task} />}
						{activeTab === 'Resources' && <ResourcesTab task={task} />}
						{activeTab === 'Discussion' && <DiscussionTab taskId={task.id} agentRoleMap={agentRoleMap} />}
						{activeTab === 'History' && <HistoryTab task={task} agentRoleMap={agentRoleMap} />}
						{activeTab === 'Dependencies' && <DependenciesTab task={task} />}
					</div>

					{/* Meta */}
					<div className="grid grid-cols-2 gap-4">
						{task.project && <MetaItem label="Project" value={task.project} />}
						{task.milestone && <MetaItem label="Milestone" value={task.milestone} />}
						{task.branch && <MetaItem label="Branch" value={task.branch} />}
						{task.pr && <MetaItem label="PR" value={task.pr} />}
						{task.deadline && <MetaItem label="Deadline" value={task.deadline} />}
						{task.created_at && (
							<MetaItem label="Created" value={new Date(task.created_at).toLocaleString()} />
						)}
						{task.updated_at && (
							<MetaItem label="Updated" value={new Date(task.updated_at).toLocaleString()} />
						)}
						{task.completed_at && (
							<MetaItem label="Completed" value={new Date(task.completed_at).toLocaleString()} />
						)}
					</div>
				</div>
			</div>

			{showReject && (
				<RejectDialog
					onSubmit={handleReject}
					onClose={() => setShowReject(false)}
					isLoading={rejectTask.isPending}
				/>
			)}
			{showResource && (
				<AddResourceDialog
					taskId={task.id}
					onClose={() => setShowResource(false)}
				/>
			)}
		</ErrorBoundary>
	)
}

function DescriptionTab({ task }: { task: import('@/lib/types').Task }) {
	if (!task.description) {
		return <EmptyState title="No description" description="This task has no description." />
	}
	return (
		<div>
			<div
				className={PROSE_CLASSES}
				dangerouslySetInnerHTML={{ __html: renderMarkdown(task.description) }}
			/>
			{task.context && Object.keys(task.context).length > 0 && (
				<div className="mt-4 space-y-1">
					<SectionTitle>Context Files</SectionTitle>
					{Object.entries(task.context).map(([key, value]) => (
						<div key={key} className="flex items-start gap-4">
							<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.1em] w-20 shrink-0 pt-0.5">
								{key}
							</span>
							<span className="text-sm"><Linkify>{value}</Linkify></span>
						</div>
					))}
				</div>
			)}
			{task.blockers && task.blockers.length > 0 && (
				<div className="mt-4">
					<SectionTitle>Blockers</SectionTitle>
					{task.blockers.map((b, i) => (
						<div key={i} className="border-l-2 border-destructive pl-3 py-2 text-sm text-destructive mb-2">
							{b.reason}
							{b.assigned_to && (
								<div className="font-mono text-[10px] text-muted-foreground mt-1">
									assigned to {b.assigned_to}
								</div>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	)
}

function ResourcesTab({ task }: { task: import('@/lib/types').Task }) {
	const resources = task.resources ?? []
	if (resources.length === 0) {
		return <EmptyState title="No resources" description="Link files, URLs, pins, or related tasks." />
	}

	const typeIcons: Record<string, string> = {
		file: '\uD83D\uDCC4',
		pin: '\uD83D\uDCCC',
		channel: '\uD83D\uDCAC',
		url: '\uD83D\uDD17',
		task: '\u2B21',
	}

	return (
		<div className="space-y-2">
			{resources.map((r, i) => (
				<div key={i} className="flex items-center gap-3 border border-border bg-card p-3">
					<span className="text-lg">{typeIcons[r.type] ?? '\uD83D\uDCC4'}</span>
					<div className="flex-1 min-w-0">
						{r.label && (
							<div className="text-sm font-medium">{r.label}</div>
						)}
						<div className="font-mono text-[11px] text-muted-foreground truncate">
							<Linkify>{r.path}</Linkify>
						</div>
					</div>
					<Badge variant="outline" className="font-mono text-[8px] shrink-0">
						{r.type}
					</Badge>
				</div>
			))}
		</div>
	)
}

function DiscussionTab({ taskId, agentRoleMap }: { taskId: string; agentRoleMap: Record<string, string> }) {
	const channel = taskId
	const { data: messages, isLoading } = useChat(channel)
	const sendMessage = useSendMessage()

	const handleSend = (message: string) => {
		sendMessage.mutate({ message, channel })
	}

	if (isLoading) {
		return (
			<div className="space-y-3">
				{Array.from({ length: 3 }).map((_, i) => (
					<Skeleton key={i} className="h-16 w-3/4" />
				))}
			</div>
		)
	}

	return (
		<div className="space-y-4">
			{(!messages || messages.length === 0) ? (
				<EmptyState
					title="No discussion yet"
					description={`Messages in #${channel} will appear here.`}
				/>
			) : (
				messages.map((msg) => (
					<ChatBubble
						key={msg.id}
						message={msg}
						agentRole={agentRoleMap[msg.sender]}
					/>
				))
			)}
			<ChatInput
				channel={channel}
				onSend={handleSend}
				isLoading={sendMessage.isPending}
			/>
		</div>
	)
}

function HistoryTab({ task, agentRoleMap }: { task: import('@/lib/types').Task; agentRoleMap: Record<string, string> }) {
	if (!task.history || task.history.length === 0) {
		return <EmptyState title="No history" description="Task events will appear here." />
	}

	return (
		<div className="space-y-0">
			{task.history.map((entry, i) => (
				<div key={i} className="flex gap-3">
					<div className="flex flex-col items-center">
						<div
							className={cn(
								'w-2 h-2 shrink-0 mt-1.5',
								i === 0 ? 'bg-primary' : 'bg-muted-foreground',
							)}
						/>
						{i < (task.history?.length ?? 0) - 1 && (
							<div className="w-px flex-1 bg-border mt-1" />
						)}
					</div>
					<div className="pb-4">
						<div className="flex items-center gap-2">
							<span className="font-mono text-[10px] text-muted-foreground">
								{formatTime(entry.at)}
							</span>
							<AgentAvatar name={entry.by} role={agentRoleMap[entry.by]} size="sm" />
							<span className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em]">
								{entry.by}
							</span>
						</div>
						<div className="text-sm text-muted-foreground mt-0.5">
							<Linkify>{entry.action + (entry.note ? ` -- ${entry.note}` : '')}</Linkify>
						</div>
					</div>
				</div>
			))}
		</div>
	)
}

function DependenciesTab({ task }: { task: import('@/lib/types').Task }) {
	const dependsOn = task.depends_on ?? []
	const blocks = task.blocks ?? []
	const related = task.related ?? []

	if (dependsOn.length === 0 && blocks.length === 0 && related.length === 0) {
		return <EmptyState title="No dependencies" description="This task has no dependency links." />
	}

	return (
		<div className="space-y-4">
			{dependsOn.length > 0 && (
				<div>
					<SectionTitle>Depends On</SectionTitle>
					<div className="space-y-1">
						{dependsOn.map((id) => (
							<DepLink key={id} id={id} type="depends" />
						))}
					</div>
				</div>
			)}
			{blocks.length > 0 && (
				<div>
					<SectionTitle>Blocks</SectionTitle>
					<div className="space-y-1">
						{blocks.map((id) => (
							<DepLink key={id} id={id} type="blocks" />
						))}
					</div>
				</div>
			)}
			{related.length > 0 && (
				<div>
					<SectionTitle>Related</SectionTitle>
					<div className="space-y-1">
						{related.map((id) => (
							<DepLink key={id} id={id} type="related" />
						))}
					</div>
				</div>
			)}
		</div>
	)
}

function DepLink({ id, type }: { id: string; type: 'depends' | 'blocks' | 'related' }) {
	const colors = {
		depends: 'border-l-warning',
		blocks: 'border-l-destructive',
		related: 'border-l-info',
	}
	return (
		<Link
			to="/tasks/$taskId"
			params={{ taskId: id }}
			className={cn('flex items-center gap-2 border border-border bg-card p-2 border-l-2 hover:bg-accent transition-colors', colors[type])}
		>
			<span className="font-mono text-[11px] text-primary">{id}</span>
		</Link>
	)
}

function SectionTitle({ children }: { children: React.ReactNode }) {
	return (
		<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.12em] mb-2">
			{children}
		</div>
	)
}

function MetaItem({ label, value }: { label: string; value: string }) {
	return (
		<div className="border border-border bg-card px-3 py-2">
			<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.1em]">
				{label}
			</div>
			<div className="text-sm font-medium mt-0.5">{value}</div>
		</div>
	)
}

function formatTime(ts: string): string {
	const d = new Date(ts)
	if (Number.isNaN(d.getTime())) return ''
	return d.toLocaleString('en-US', {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	})
}
