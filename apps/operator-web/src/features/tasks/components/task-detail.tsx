import { useMemo, useState } from 'react'
import { ArrowLeft, ChatCircle, Timer, Lightning, FileText, ArrowSquareOut, Check, X, SteeringWheel, ArrowBendUpLeft } from '@phosphor-icons/react'
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
import { taskStatusToPill } from '@/lib/status-colors'
import { cn } from '@/lib/utils'
import { SmartText } from '@/lib/smart-links'
import type { TaskWithRelations, Task } from '@/api/types'
import { useWorkflows } from '@/hooks/use-workflows'
import { useRuns } from '@/hooks/use-runs'
import { useTaskArtifacts, useApproveTask, useRejectTask, useReplyTask } from '@/hooks/use-tasks'
import { buildTimeline } from '../lib/build-timeline'
import { WorkflowTimeline } from './workflow-timeline'
import { RunViewerSheet } from './run-viewer-sheet'
import { SteerDialog } from './steer-dialog'
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
      <span className="inline-flex items-center gap-1 bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
        {type}
      </span>
    )
  }
  const Icon = config.icon
  return (
    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 font-mono text-[10px]', config.className)}>
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
        'inline-flex items-center gap-1.5 border border-border bg-card px-2 py-1 text-left transition-colors',
        onSelect && 'hover:bg-muted cursor-pointer',
        !onSelect && 'cursor-default',
      )}
    >
      <span className="font-mono text-[10px] text-muted-foreground">{relation}</span>
      <span className="truncate text-[12px] text-foreground max-w-[200px]">{task.title}</span>
    </button>
  )
}

// ── Action dialog state type ────────────────────────────────────────────────
type ActionDialog = 'approve' | 'reject' | 'reply' | 'steer' | null

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
  const activeRun = detail?.runs.find(
    (r) => r.status === 'pending' || r.status === 'claimed' || r.status === 'running',
  ) ?? null
  const canSteer = activeRun !== null
  const canReply = detail?.type === 'task'

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


  if (isLoading && !detail) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3 shrink-0">
          <Button size="icon-xs" variant="ghost" onClick={onBack} title="Back to tasks">
            <ArrowLeft size={14} weight="bold" />
          </Button>
          <h2 className="font-mono text-xs font-medium text-foreground truncate flex-1">Loading…</h2>
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
        <div className="flex items-center gap-3 border-b border-border px-4 py-3 shrink-0">
          <Button size="icon-xs" variant="ghost" onClick={onBack} title="Back to tasks">
            <ArrowLeft size={14} weight="bold" />
          </Button>
          <h2 className="font-mono text-xs font-medium text-foreground truncate flex-1">Task not found</h2>
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
      <div className="flex items-center gap-3 border-b border-border px-4 py-3 shrink-0">
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
        {canSteer && (
          <Button size="xs" variant="outline" onClick={() => setActionDialog('steer')}>
            <SteeringWheel size={11} weight="bold" />
            Steer
          </Button>
        )}
        {canReply && (
          <Button size="xs" variant="outline" onClick={() => setActionDialog('reply')}>
            <ArrowBendUpLeft size={11} weight="bold" />
            Reply
          </Button>
        )}
      </div>

      {/* Run viewer sheet */}
      <RunViewerSheet runId={selectedRunId} onClose={() => setSelectedRunId(null)} />

      {/* Steer dialog */}
      {activeRun && (
        <SteerDialog
          open={actionDialog === 'steer'}
          onClose={closeActionDialog}
          runId={activeRun.id}
        />
      )}

      {/* Approve dialog */}
      <Dialog open={actionDialog === 'approve'} onOpenChange={(open) => { if (!open) closeActionDialog() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono text-xs uppercase tracking-widest">Approve Step</DialogTitle>
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
            <DialogTitle className="font-mono text-xs uppercase tracking-widest">Reject Step</DialogTitle>
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
            <DialogTitle className="font-mono text-xs uppercase tracking-widest">Reply to Task</DialogTitle>
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

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-6">
          {/* Title */}
          <h1 className="text-xl font-semibold leading-snug text-foreground">
            <SmartText text={detail.title} />
          </h1>

          {/* Properties grid */}
          <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-3">
            {detail.assigned_to && (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Agent</p>
                <p className="mt-0.5 font-mono text-[12px] text-foreground">{detail.assigned_to}</p>
              </div>
            )}
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Priority</p>
              <p className="mt-0.5 text-[12px] text-foreground capitalize">{detail.priority}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Type</p>
              <div className="mt-1">
                <TaskTypeBadge type={detail.type} />
              </div>
            </div>
            {workflow && (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Workflow</p>
                <p className="mt-0.5 font-mono text-[12px] text-foreground">{workflow.name}</p>
              </div>
            )}
            {detail.workflow_step && (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Current Step</p>
                <p className="mt-0.5 font-mono text-[12px] text-foreground">{detail.workflow_step}</p>
              </div>
            )}
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Created</p>
              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{formatTimestamp(detail.created_at)}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Updated</p>
              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{formatTimestamp(detail.updated_at)}</p>
            </div>
          </div>

          {/* Description */}
          {detail.description && (
            <>
              <div className="my-5 border-t border-border" />
              <Markdown content={detail.description} className="text-[13px]" />
            </>
          )}

          {/* Relations */}
          {hasRelated && (
            <>
              <div className="my-5 border-t border-border" />
              <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Relations</p>
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

          {/* Workflow Timeline */}
          {workflow && timelineEntries.length > 0 && (
            <>
              <div className="my-5 border-t border-border" />
              <p className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Workflow Progress</p>
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
                <div className="my-5 border-t border-border" />
                <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Cross-references
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {detail.workflow_id && workflow && (
                    <span className="inline-flex items-center gap-1 border border-border bg-card px-2 py-1 font-mono text-[11px] text-foreground">
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
                      className="inline-flex items-center gap-1 border border-border bg-card px-2 py-1 font-mono text-[11px] text-primary hover:bg-muted"
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
                      className="inline-flex items-center gap-1 border border-border bg-card px-2 py-1 font-mono text-[11px] text-primary hover:bg-muted"
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
              <div className="my-5 border-t border-border" />
              <p className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Runs</p>
              <div className="space-y-2">
                {detail.runs.map((run) => {
                  const runArtifacts = (artifactsQuery.data ?? []).filter((a) => a.run_id === run.id)
                  return (
                    <div key={run.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedRunId(run.id)}
                        className="w-full text-left border border-border bg-card px-3 py-2.5 hover:bg-muted transition-colors cursor-pointer"
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
                          <div className="mt-1 border border-destructive/20 bg-destructive-surface px-2 py-1.5">
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
                <div className="my-5 border-t border-border" />
                <p className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Artifacts
                </p>
                <ArtifactList artifacts={allArtifacts} />
              </>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
