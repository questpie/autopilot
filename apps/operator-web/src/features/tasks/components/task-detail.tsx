import { useMemo, useState } from 'react'
import { ArrowLeft, ChatCircle, Timer, Lightning, FileText, ArrowSquareOut, Check, X, ArrowBendUpLeft, ArrowCounterClockwise, Stop } from '@phosphor-icons/react'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { StatusPill } from '@/components/ui/status-pill'
import { Spinner } from '@/components/ui/spinner'
import { Markdown } from '@/components/ui/markdown'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { KvList } from '@/components/ui/kv-list'
import { taskStatusToPill } from '@/lib/status-colors'
import { cn } from '@/lib/utils'
import { SmartText } from '@/lib/smart-links'
import type { TaskWithRelations, Task } from '@/api/types'
import { useWorkflows } from '@/hooks/use-workflows'
import { useRuns } from '@/hooks/use-runs'
import { useTaskArtifacts, useApproveTask, useRejectTask, useReplyTask, useRetryTask, useCancelTask } from '@/hooks/use-tasks'
import { buildTimeline } from '../lib/build-timeline'
import { WorkflowTimeline } from './workflow-timeline'
import { RunViewerSheet } from './run-viewer-sheet'
import { ArtifactList } from './artifact-list'

interface TaskDetailProps {
  detail: TaskWithRelations | null | undefined
  isLoading: boolean
  onBack: () => void
  onSelectTask?: (id: string) => void
}

const TASK_TYPE_CONFIG: Record<string, { icon: typeof ChatCircle; label: string; className: string }> = {
  query: { icon: ChatCircle, label: 'query', className: 'bg-info-surface text-info' },
  scheduled: { icon: Timer, label: 'scheduled', className: 'bg-warning-surface text-warning' },
  task: { icon: Lightning, label: 'task', className: 'bg-primary-surface text-primary' },
}

function TaskTypeBadge({ type }: { type: string }) {
  const config = TASK_TYPE_CONFIG[type]
  if (!config) {
    return (
      <span className="inline-flex items-center gap-1 bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
        {type}
      </span>
    )
  }
  const Icon = config.icon
  return (
    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px]', config.className)}>
      <Icon size={10} weight="bold" />
      {config.label}
    </span>
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
}: {
  task: Task
  relation: string
  onSelect?: (id: string) => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect ? () => onSelect(task.id) : undefined}
      className={cn(
        'inline-flex items-center gap-1.5 bg-muted/40 px-2 py-1 text-left transition-colors',
        onSelect && 'hover:bg-muted cursor-pointer',
        !onSelect && 'cursor-default',
      )}
    >
      <span className="text-[10px] text-muted-foreground">{relation}</span>
      <span className="truncate text-[12px] text-foreground max-w-[200px]">{task.title}</span>
    </button>
  )
}

// ── Action dialog state type ────────────────────────────────────────────────
type ActionDialog = 'approve' | 'reject' | 'reply' | 'cancel' | null

export function TaskDetail({ detail, isLoading, onBack, onSelectTask }: TaskDetailProps) {
  // ALL hooks before any early returns (React hooks rule)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [actionDialog, setActionDialog] = useState<ActionDialog>(null)
  const [actionMessage, setActionMessage] = useState('')
  const workflowsQuery = useWorkflows()
  const runsQuery = useRuns(detail?.id ? { task_id: detail.id } : undefined)
  const artifactsQuery = useTaskArtifacts(detail?.id ?? null)
  const approveTask = useApproveTask()
  const rejectTask = useRejectTask()
  const replyTask = useReplyTask()
  const retryTaskMutation = useRetryTask()
  const cancelTaskMutation = useCancelTask()

  const workflow = detail?.workflow_id
    ? (workflowsQuery.data ?? []).find((w) => w.id === detail.workflow_id) ?? null
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

  // ── Action bar conditions ────────────────────────────────────────────────
  const currentStep = workflow && detail?.workflow_step
    ? workflow.steps.find((s) => s.id === detail.workflow_step) ?? null
    : null
  const isHumanApproval = currentStep?.type === 'human_approval' && detail?.status === 'active'
  const canReply = detail?.type === 'task'
  const canRetry = detail?.status === 'failed'
  const canCancel = detail?.status === 'active' || detail?.status === 'backlog' || detail?.status === 'blocked'

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
    rejectTask.mutate({ id: detail.id, message: actionMessage.trim() }, { onSuccess: closeActionDialog })
  }

  function handleReply() {
    if (!detail || !actionMessage.trim()) return
    replyTask.mutate({ id: detail.id, message: actionMessage.trim() }, { onSuccess: closeActionDialog })
  }

  function handleRetry() {
    if (!detail) return
    retryTaskMutation.mutate(detail.id)
  }

  function handleCancel() {
    if (!detail || !actionMessage.trim()) return
    cancelTaskMutation.mutate({ id: detail.id, reason: actionMessage.trim() }, { onSuccess: closeActionDialog })
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

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 shrink-0">
        <Button size="icon-xs" variant="ghost" onClick={onBack} title="Back to tasks">
          <ArrowLeft size={14} weight="bold" />
        </Button>
        <span className="font-mono text-[11px] text-muted-foreground">{detail.id.slice(0, 12)}…</span>
        <div className="flex-1" />
        <StatusPill
          status={taskStatusToPill(detail.status)}
          pulse={detail.status === 'active'}
        />
        {isHumanApproval && (
          <>
            <Button size="xs" variant="default" onClick={() => setActionDialog('approve')}>
              <Check size={11} weight="bold" />
              Approve
            </Button>
            <Button size="xs" variant="destructive" onClick={() => setActionDialog('reject')}>
              <X size={11} weight="bold" />
              Reject
            </Button>
          </>
        )}
        {canReply && (
          <Button size="xs" variant="outline" onClick={() => setActionDialog('reply')}>
            <ArrowBendUpLeft size={11} weight="bold" />
            Reply
          </Button>
        )}
        {canRetry && (
          <Button size="xs" variant="outline" onClick={handleRetry} loading={retryTaskMutation.isPending}>
            <ArrowCounterClockwise size={11} weight="bold" />
            Retry
          </Button>
        )}
        {canCancel && (
          <Button size="xs" variant="destructive" onClick={() => setActionDialog('cancel')}>
            <Stop size={11} weight="bold" />
            Cancel
          </Button>
        )}
      </div>

      {/* Run viewer sheet */}
      <RunViewerSheet runId={selectedRunId} onClose={() => setSelectedRunId(null)} />

      {/* Approve dialog */}
      <Dialog open={actionDialog === 'approve'} onOpenChange={(open) => { if (!open) closeActionDialog() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xs uppercase tracking-widest">Approve Step</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-muted-foreground">
            Approve this workflow step? The workflow will advance to the next step.
          </p>
          <DialogFooter>
            <Button variant="default" size="sm" loading={approveTask.isPending} onClick={handleApprove}>
              <Check size={12} weight="bold" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={actionDialog === 'reject'} onOpenChange={(open) => { if (!open) closeActionDialog() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xs uppercase tracking-widest">Reject Step</DialogTitle>
          </DialogHeader>
          <Textarea
            className="font-mono text-xs"
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
      <Dialog open={actionDialog === 'reply'} onOpenChange={(open) => { if (!open) closeActionDialog() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xs uppercase tracking-widest">Reply to Task</DialogTitle>
          </DialogHeader>
          <Textarea
            className="font-mono text-xs"
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
      <Dialog open={actionDialog === 'cancel'} onOpenChange={(open) => { if (!open) closeActionDialog() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xs uppercase tracking-widest">Cancel Task</DialogTitle>
          </DialogHeader>
          <Textarea
            className="font-mono text-xs"
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

      {/* Two-column content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left column */}
        <div className="flex-1 min-w-0 overflow-y-auto px-6 py-6">
          {/* Title */}
          <h1 className="text-xl font-semibold leading-snug text-foreground">
            <SmartText text={detail.title} />
          </h1>

          {/* Description */}
          {detail.description && (
            <Markdown content={detail.description} className="mt-6 text-[13px]" />
          )}

          {/* Workflow Timeline */}
          {workflow && timelineEntries.length > 0 && (
            <>
              <div className="my-5" />
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Workflow Progress</p>
              <WorkflowTimeline entries={timelineEntries} />
            </>
          )}

          {/* Cross-references — workflow link, artifact file links, session links */}
          {(() => {
            const fileArtifacts = (artifactsQuery.data ?? []).filter(
              (a) => a.ref_kind === 'file' && a.ref_value,
            )
            const sessionRefs = detail.runs
              .map((r) => r.runtime_session_ref)
              .filter((s): s is string => s !== null)
            const uniqueSessions = [...new Set(sessionRefs)]
            const hasRefs = detail.workflow_id || fileArtifacts.length > 0 || uniqueSessions.length > 0
            if (!hasRefs) return null
            return (
              <>
                <div className="my-5" />
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Cross-references
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {detail.workflow_id && workflow && (
                    <span className="inline-flex items-center gap-1 bg-muted/40 px-2 py-1 font-mono text-[11px] text-foreground">
                      <ArrowSquareOut size={10} className="text-muted-foreground" />
                      workflow:{' '}
                      <Link
                        to="/files"
                        search={{ path: `.autopilot/workflows/${detail.workflow_id}.yaml`, view: 'file' }}
                        className="text-primary hover:underline"
                      >
                        {workflow.name}
                      </Link>
                    </span>
                  )}
                  {uniqueSessions.map((sid) => (
                    <Link
                      key={sid}
                      to="/chat"
                      search={{ sessionId: sid }}
                      className="inline-flex items-center gap-1 bg-muted/40 px-2 py-1 font-mono text-[11px] text-primary hover:bg-muted"
                    >
                      <ChatCircle size={10} />
                      session:{sid.slice(0, 8)}
                    </Link>
                  ))}
                  {fileArtifacts.map((a) => (
                    <Link
                      key={a.id}
                      to="/files"
                      search={{ path: a.ref_value, view: 'file' }}
                      className="inline-flex items-center gap-1 bg-muted/40 px-2 py-1 font-mono text-[11px] text-primary hover:bg-muted"
                    >
                      <FileText size={10} />
                      {a.title || a.ref_value.split('/').pop() || a.ref_value}
                    </Link>
                  ))}
                </div>
              </>
            )
          })()}

          {/* Runs (non-workflow tasks only) */}
          {!workflow && detail.runs.length > 0 && (
            <>
              <div className="my-5" />
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Runs</p>
              <div className="space-y-2">
                {detail.runs.map((run) => {
                  const runArtifacts = (artifactsQuery.data ?? []).filter((a) => a.run_id === run.id)
                  return (
                    <div key={run.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedRunId(run.id)}
                        className="w-full text-left bg-muted/40 px-3 py-2.5 hover:bg-muted transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <StatusPill status={taskStatusToPill(run.status)} />
                          <div className="flex items-center gap-2">
                            {runArtifacts.length > 0 && (
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {runArtifacts.length} artifact{runArtifacts.length !== 1 ? 's' : ''}
                              </span>
                            )}
                            <span className="font-mono text-[11px] text-muted-foreground">{run.agent_id}</span>
                          </div>
                        </div>
                        <p className="mt-1 font-mono text-[10px] text-muted-foreground">{run.id.slice(0, 16)}…</p>
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
                        <div className="mt-1.5 flex gap-3">
                          {run.model && <span className="font-mono text-[10px] text-muted-foreground">{run.model}</span>}
                          {run.started_at && (
                            <span className="font-mono text-[10px] text-muted-foreground">{formatTimestamp(run.started_at)}</span>
                          )}
                        </div>
                      </button>
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

          {/* Task-level artifacts (all runs combined) */}
          {(() => {
            const allArtifacts = artifactsQuery.data ?? []
            if (allArtifacts.length === 0) return null
            return (
              <>
                <div className="my-5" />
                <p className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Artifacts
                </p>
                <ArtifactList artifacts={allArtifacts} />
              </>
            )
          })()}
        </div>

        {/* Right column */}
        <div className="w-[300px] shrink-0 overflow-y-auto bg-muted/20 px-4 py-5">
          <KvList
            items={[
              {
                label: 'Status',
                value: (
                  <StatusPill
                    status={taskStatusToPill(detail.status)}
                    pulse={detail.status === 'active'}
                  />
                ),
              },
              ...(detail.assigned_to
                ? [{ label: 'Agent', value: <span className="font-mono text-[12px]">{detail.assigned_to}</span> }]
                : []),
              {
                label: 'Priority',
                value: <span className="text-[12px] capitalize">{detail.priority}</span>,
              },
              {
                label: 'Type',
                value: <TaskTypeBadge type={detail.type} />,
              },
              ...(workflow
                ? [{ label: 'Workflow', value: <span className="font-mono text-[12px]">{workflow.name}</span> }]
                : []),
              ...(detail.workflow_step
                ? [{ label: 'Current Step', value: <span className="font-mono text-[12px]">{detail.workflow_step}</span> }]
                : []),
              {
                label: 'Created',
                value: <span className="font-mono text-[11px] text-muted-foreground">{formatTimestamp(detail.created_at)}</span>,
              },
              {
                label: 'Updated',
                value: <span className="font-mono text-[11px] text-muted-foreground">{formatTimestamp(detail.updated_at)}</span>,
              },
            ]}
          />

          {hasRelated && (
            <>
              <div className="mt-5" />
              <p className="mb-2 mt-4 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Relations</p>
              <div className="flex flex-wrap gap-1.5">
                {detail.parents.map((t) => (
                  <RelationChip key={t.id} task={t} relation="parent" onSelect={onSelectTask} />
                ))}
                {detail.children.map((t) => (
                  <RelationChip key={t.id} task={t} relation="child" onSelect={onSelectTask} />
                ))}
                {detail.dependencies.map((t) => (
                  <RelationChip key={t.id} task={t} relation="depends on" onSelect={onSelectTask} />
                ))}
                {detail.dependents.map((t) => (
                  <RelationChip key={t.id} task={t} relation="blocks" onSelect={onSelectTask} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
