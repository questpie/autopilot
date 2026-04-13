import type { Run, WorkflowStep } from '@/api/types'

export type TimelineStatus = 'done' | 'empty' | 'running' | 'pending' | 'failed'

export interface TimelineEntry {
  stepId: string
  label: string
  status: TimelineStatus
  run?: Run
  annotation?: string
  isHumanApproval?: boolean
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 3) + '...'
}

export function formatDuration(
  startedAt: string | null | undefined,
  endedAt: string | null | undefined,
): string {
  if (!startedAt) return ''
  const start = new Date(startedAt).getTime()
  const end = endedAt ? new Date(endedAt).getTime() : Date.now()
  const diffMs = end - start
  if (diffMs < 0) return ''

  const totalSec = Math.floor(diffMs / 1000)
  if (totalSec < 60) return `${totalSec}s`
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  if (min < 60) return sec > 0 ? `${min}m ${sec}s` : `${min}m`
  const hr = Math.floor(min / 60)
  const remainMin = min % 60
  return remainMin > 0 ? `${hr}h ${remainMin}m` : `${hr}h`
}

/**
 * Build timeline entries by matching runs to workflow steps.
 * Ported from packages/cli/src/commands/tasks.ts buildTimeline().
 */
export function buildTimeline(
  steps: WorkflowStep[],
  taskRuns: Run[],
  currentStep: string | null,
  metadata: Record<string, unknown>,
): TimelineEntry[] {
  const entries: TimelineEntry[] = []

  // Sort runs by created_at ascending, only workflow-engine initiated
  const sortedRuns = [...taskRuns]
    .filter((r) => r.initiated_by === 'workflow-engine' || r.initiated_by === 'system')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  const stepVisits = new Map<string, number>()
  let pointer = 0

  for (const run of sortedRuns) {
    // Try matching by instruction content
    let matchedStepIdx = -1
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]!
      if (step.type !== 'agent') continue
      if (step.instructions && run.instructions?.includes(step.instructions)) {
        matchedStepIdx = i
        break
      }
    }

    if (matchedStepIdx === -1) {
      matchedStepIdx = pointer
    }

    const step = steps[matchedStepIdx]
    if (!step) continue

    const visits = (stepVisits.get(step.id) ?? 0) + 1
    stepVisits.set(step.id, visits)

    const isRevision = matchedStepIdx < pointer
    const isRetry = matchedStepIdx === pointer && visits > 1
    const isEmpty =
      !run.summary ||
      run.summary.trim() === '' ||
      /^(no output|empty|n\/a|completed? with no output)$/i.test(run.summary?.trim() ?? '')

    let label = step.name ?? step.id
    if (isRevision) label = `${step.name ?? step.id} (revision)`
    else if (isRetry) label = `${step.name ?? step.id} (retry)`

    let status: TimelineStatus = 'done'
    if (run.status === 'running' || run.status === 'claimed') {
      status = 'running'
    } else if (run.status === 'failed') {
      status = 'failed'
    } else if (isEmpty && run.status === 'completed') {
      status = 'empty'
    }

    entries.push({ stepId: step.id, label, status, run })

    // Revision annotation
    if (isRevision && entries.length >= 2) {
      const prevEntry = entries[entries.length - 2]
      if (prevEntry?.run?.summary) {
        const revKey = Object.keys(metadata).find(
          (k) => k.startsWith('_revisions:') && k.includes(step.id),
        )
        if (revKey) {
          entries.splice(entries.length - 1, 0, {
            stepId: prevEntry.stepId,
            label: `↳ revision ${visits - 1}`,
            status: 'done',
            annotation: truncate(prevEntry.run.summary, 80),
          })
        }
      }
    }

    // Advance pointer
    if (!isRevision && run.status === 'completed' && !isEmpty) {
      pointer = matchedStepIdx + 1
    } else if (isRevision) {
      pointer = matchedStepIdx
    }
  }

  // Remaining pending steps
  for (let i = pointer; i < steps.length; i++) {
    const step = steps[i]!
    const alreadyShown = entries.some(
      (e) => e.stepId === step.id && (e.status === 'running' || e.status === 'pending'),
    )
    if (alreadyShown) continue

    const isCurrent = step.id === currentStep
    if (isCurrent) {
      const hasRunning = entries.some((e) => e.stepId === step.id && e.status === 'running')
      if (!hasRunning) {
        entries.push({
          stepId: step.id,
          label: step.name ?? step.id,
          status: 'pending',
          isHumanApproval: step.type === 'human_approval',
        })
      }
    } else {
      entries.push({
        stepId: step.id,
        label: step.type === 'done' ? 'done' : (step.name ?? step.id),
        status: 'pending',
        isHumanApproval: step.type === 'human_approval',
      })
    }
  }

  return entries
}
