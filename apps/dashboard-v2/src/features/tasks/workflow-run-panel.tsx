import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
	ArchiveIcon,
	CheckCircleIcon,
	CircleNotchIcon,
	WarningCircleIcon,
} from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { type WorkflowRunDetail, taskWorkflowRunQuery } from './task.queries'

interface WorkflowRunPanelProps {
	taskId: string
}

function parseJson(value: string | null) {
	if (!value) return null
	try {
		return JSON.parse(value) as unknown
	} catch {
		return value
	}
}

function hasSnapshot(value: string | null) {
	if (!value || value === '{}') return false
	const parsed = parseJson(value)
	if (parsed == null) return false
	if (typeof parsed === 'string') return parsed.trim().length > 0
	if (Array.isArray(parsed)) return parsed.length > 0
	if (typeof parsed === 'object') return Object.keys(parsed as Record<string, unknown>).length > 0
	return true
}

function formatTimestamp(value: string | null) {
	if (!value) return '--'
	return new Date(value).toLocaleString()
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
	if (status === 'failed' || status === 'blocked') return 'destructive'
	if (status === 'completed' || status === 'done') return 'secondary'
	if (status === 'active' || status === 'assigned' || status === 'executing') return 'default'
	return 'outline'
}

function RuntimeHeader({ detail }: { detail: WorkflowRunDetail }) {
	const archived = !!detail.run.archived_at
	const completed = !!detail.run.completed_at

	return (
		<Card size="sm">
			<CardHeader className="border-b border-border">
				<div className="flex items-start justify-between gap-3">
					<div>
						<CardTitle>{detail.run.workflow_id}</CardTitle>
						<CardDescription className="mt-1 font-mono text-[11px]">
							{detail.run.id}
						</CardDescription>
					</div>
					<div className="flex flex-wrap items-center justify-end gap-1.5">
						<Badge variant={statusVariant(detail.run.status)}>{detail.run.status}</Badge>
						{completed && (
							<Badge variant="secondary" className="gap-1">
								<CheckCircleIcon size={12} />
								completed
							</Badge>
						)}
						{archived && (
							<Badge variant="outline" className="gap-1">
								<ArchiveIcon size={12} />
								archived
							</Badge>
						)}
					</div>
				</div>
			</CardHeader>
			<CardContent className="grid grid-cols-2 gap-x-6 gap-y-2 text-[11px] sm:grid-cols-3">
				<div>
					<div className="text-muted-foreground">Current step</div>
					<div className="font-medium text-foreground">{detail.run.current_step_id ?? '--'}</div>
				</div>
				<div>
					<div className="text-muted-foreground">Last event</div>
					<div className="font-medium text-foreground">{detail.run.last_event ?? '--'}</div>
				</div>
				<div>
					<div className="text-muted-foreground">Trigger</div>
					<div className="font-medium text-foreground">{detail.run.trigger_source ?? '--'}</div>
				</div>
				<div>
					<div className="text-muted-foreground">Started</div>
					<div className="font-medium text-foreground">
						{formatTimestamp(detail.run.started_at)}
					</div>
				</div>
				<div>
					<div className="text-muted-foreground">Completed</div>
					<div className="font-medium text-foreground">
						{formatTimestamp(detail.run.completed_at)}
					</div>
				</div>
				<div>
					<div className="text-muted-foreground">Archived</div>
					<div className="font-medium text-foreground">
						{formatTimestamp(detail.run.archived_at)}
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

function SnapshotBlock({ label, value }: { label: string; value: string | null }) {
	if (!hasSnapshot(value)) return null

	return (
		<div className="space-y-1">
			<div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
			<pre className="overflow-x-auto border border-border bg-muted/30 p-3 font-mono text-[11px] text-muted-foreground">
				{JSON.stringify(parseJson(value), null, 2)}
			</pre>
		</div>
	)
}

function StepRunCard({ step }: { step: WorkflowRunDetail['steps'][number] }) {
	return (
		<Card size="sm">
			<CardHeader className="border-b border-border">
				<div className="flex items-start justify-between gap-3">
					<div>
						<CardTitle>{step.step_id}</CardTitle>
						<CardDescription className="mt-1">
							attempt {step.attempt}
							{step.executor_ref ? ` - ${step.executor_ref}` : ''}
						</CardDescription>
					</div>
					<div className="flex flex-wrap items-center justify-end gap-1.5">
						<Badge variant={statusVariant(step.status)}>{step.status}</Badge>
						{step.model_policy && <Badge variant="outline">{step.model_policy}</Badge>}
						{step.archived_at && (
							<Badge variant="outline" className="gap-1">
								<ArchiveIcon size={12} />
								archived
							</Badge>
						)}
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-3 text-[11px]">
				<div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
					<div>
						<div className="text-muted-foreground">Executor</div>
						<div className="font-medium text-foreground">{step.executor_kind ?? '--'}</div>
					</div>
					<div>
						<div className="text-muted-foreground">Validation</div>
						<div className="font-medium text-foreground">{step.validation_mode ?? '--'}</div>
					</div>
					<div>
						<div className="text-muted-foreground">Failure action</div>
						<div className="font-medium text-foreground">{step.failure_action ?? '--'}</div>
					</div>
					<div>
						<div className="text-muted-foreground">Child workflow</div>
						<div className="font-medium text-foreground">{step.child_workflow_id ?? '--'}</div>
					</div>
					<div>
						<div className="text-muted-foreground">Child task</div>
						<div className="font-medium text-foreground">{step.child_task_id ?? '--'}</div>
					</div>
					<div>
						<div className="text-muted-foreground">Completed</div>
						<div className="font-medium text-foreground">{formatTimestamp(step.completed_at)}</div>
					</div>
				</div>

				{step.failure_reason && (
					<div className="flex items-start gap-2 border border-destructive/20 bg-destructive/5 p-3 text-[11px] text-destructive">
						<WarningCircleIcon size={14} className="mt-0.5 shrink-0" />
						<div>{step.failure_reason}</div>
					</div>
				)}

				<SnapshotBlock label="Input snapshot" value={step.input_snapshot} />
				<SnapshotBlock label="Validation snapshot" value={step.validation_snapshot} />
				<SnapshotBlock label="Output snapshot" value={step.output_snapshot} />
			</CardContent>
		</Card>
	)
}

export function WorkflowRunPanel({ taskId }: WorkflowRunPanelProps) {
	const { data, isLoading, isError } = useQuery(taskWorkflowRunQuery(taskId))

	if (isLoading) {
		return (
			<div className="grid gap-3">
				<div className="h-20 animate-pulse border border-border bg-muted/40" />
				<div className="h-24 animate-pulse border border-border bg-muted/40" />
			</div>
		)
	}

	if (isError) {
		return (
			<div className="border border-destructive/20 bg-destructive/5 p-4 text-[11px] text-destructive">
				Failed to load workflow runtime.
			</div>
		)
	}

	if (!data) {
		return (
			<div className="border border-dashed border-border p-4 text-[11px] text-muted-foreground">
				No workflow runtime recorded yet.
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center gap-2 text-xs text-muted-foreground">
				<CircleNotchIcon size={14} className="text-primary" />
				Runtime inspection from SQLite (`workflow_runs`, `step_runs`)
			</div>
			<RuntimeHeader detail={data} />
			<div className="flex flex-col gap-3">
				{data.steps.map((step) => (
					<StepRunCard key={step.id} step={step} />
				))}
			</div>
		</div>
	)
}
