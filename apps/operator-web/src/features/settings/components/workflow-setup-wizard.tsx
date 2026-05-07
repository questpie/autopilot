/**
 * Workflow setup wizard.
 *
 * Edits a workflow record through structured controls instead of raw JSON.
 * Hands the serialized JSON back to ConfigSettings via onChange — that
 * keeps the save/delete/reload flow identical to other config types.
 *
 * The raw JSON editor is still available in advanced mode for fields the
 * wizard intentionally does not surface (declarative output/input contracts,
 * external actions, transition catchall fields).
 */
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { SurfaceSection } from '@/components/ui/surface-section'
import { Textarea } from '@/components/ui/textarea'
import { useConfigRecords } from '@/hooks/use-config'
import { Plus, Workflow as WorkflowIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { WorkflowStepEditor } from './workflow-step-editor'
import {
	emptyStep,
	parseWorkflowDraft,
	serializeWorkflowDraft,
	type WorkflowDraft,
	type WorkflowStepDraft,
} from './workflow-types'
import { validateWorkflow } from './workflow-validation'

interface WorkflowSetupWizardProps {
	value: string
	onChange: (next: string) => void
	draftId: string
	onDraftIdChange: (next: string) => void
	projectId: string | null
}

function toSlug(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
}

export function WorkflowSetupWizard({
	value,
	onChange,
	draftId,
	onDraftIdChange,
	projectId,
}: WorkflowSetupWizardProps) {
	// Workflow wizard pulls agents and capability profiles from the existing
	// config registry so the pickers show real options rather than freeform input.
	// Falls back to company-scope when project-scope isn't loaded yet.
	const agentsQuery = useConfigRecords('agents', projectId)
	const capabilitiesQuery = useConfigRecords('capabilities', projectId)
	const companyAgentsQuery = useConfigRecords('agents', null)
	const companyCapsQuery = useConfigRecords('capabilities', null)

	const availableAgents = useMemo(() => {
		const merged = new Map<string, { id: string; name?: string }>()
		for (const list of [companyAgentsQuery.data ?? [], agentsQuery.data ?? []]) {
			for (const record of list) {
				const r = record as { id?: string; name?: string }
				if (r.id) merged.set(r.id, { id: r.id, name: r.name })
			}
		}
		return [...merged.values()]
	}, [agentsQuery.data, companyAgentsQuery.data])

	const availableCapabilities = useMemo(() => {
		const merged = new Map<string, { id: string }>()
		for (const list of [companyCapsQuery.data ?? [], capabilitiesQuery.data ?? []]) {
			for (const record of list) {
				const r = record as { id?: string }
				if (r.id) merged.set(r.id, { id: r.id })
			}
		}
		return [...merged.values()]
	}, [capabilitiesQuery.data, companyCapsQuery.data])

	const parsed = useMemo(() => parseWorkflowDraft(value, draftId), [draftId, value])
	const [draft, setDraft] = useState<WorkflowDraft>(parsed)

	useEffect(() => {
		setDraft(parsed)
	}, [parsed])

	function applyChange(next: WorkflowDraft) {
		setDraft(next)
		onDraftIdChange(next.id)
		onChange(serializeWorkflowDraft(next))
	}

	function updateField(patch: Partial<WorkflowDraft>) {
		applyChange({ ...draft, ...patch })
	}

	function updateName(name: string) {
		const id = draft.id ? draft.id : toSlug(name)
		applyChange({ ...draft, name, id })
	}

	function addStep() {
		const baseId = `step-${draft.steps.length + 1}`
		applyChange({ ...draft, steps: [...draft.steps, emptyStep(baseId)] })
	}

	function updateStep(index: number, next: WorkflowStepDraft) {
		const steps = [...draft.steps]
		steps[index] = next
		applyChange({ ...draft, steps })
	}

	function deleteStep(index: number) {
		const steps = draft.steps.filter((_, i) => i !== index)
		applyChange({ ...draft, steps })
	}

	function moveStep(index: number, delta: -1 | 1) {
		const target = index + delta
		if (target < 0 || target >= draft.steps.length) return
		const steps = [...draft.steps]
		;[steps[index], steps[target]] = [steps[target]!, steps[index]!]
		applyChange({ ...draft, steps })
	}

	const issues = useMemo(
		() => validateWorkflow(draft, { availableAgents }),
		[availableAgents, draft],
	)
	const issuesByStep = useMemo(() => {
		const map = new Map<string, string[]>()
		for (const issue of issues) {
			if (!issue.stepId) continue
			const list = map.get(issue.stepId) ?? []
			list.push(issue.message)
			map.set(issue.stepId, list)
		}
		return map
	}, [issues])
	const topLevelIssues = issues.filter((i) => !i.stepId)
	const errorCount = issues.filter((i) => i.severity === 'error').length
	const warningCount = issues.filter((i) => i.severity === 'warning').length
	const stepIds = draft.steps.map((s) => s.id)

	return (
		<div className="space-y-4">
			<SurfaceSection
				title="Workflow"
				description="Configure orchestration steps. Save persists to the config registry and triggers a runtime reload."
				contentClassName="space-y-4"
			>
				<div className="grid gap-3 md:grid-cols-2">
					<div className="space-y-1">
						<Label>Workflow ID</Label>
						<Input
							aria-label="Workflow ID"
							value={draft.id}
							onChange={(e) => updateField({ id: toSlug(e.target.value) })}
							placeholder="newsletter-review"
						/>
					</div>
					<div className="space-y-1">
						<Label>Display name</Label>
						<Input
							aria-label="Workflow name"
							value={draft.name}
							onChange={(e) => updateName(e.target.value)}
							placeholder="Newsletter review"
						/>
					</div>
					<div className="md:col-span-2 space-y-1">
						<Label>Description</Label>
						<Textarea
							aria-label="Workflow description"
							value={draft.description}
							onChange={(e) => updateField({ description: e.target.value })}
							placeholder="What this workflow does, when to use it, and what good output looks like."
							className="min-h-20 resize-y"
						/>
					</div>
					<div className="space-y-1">
						<Label>Workspace mode</Label>
						<Select
							aria-label="Workspace mode"
							value={draft.workspace_mode}
							onChange={(e) =>
								updateField({
									workspace_mode: e.target.value === 'none' ? 'none' : 'isolated_worktree',
								})
							}
						>
							<option value="isolated_worktree">Isolated git worktree (default)</option>
							<option value="none">No workspace (read-only / non-git work)</option>
						</Select>
					</div>
				</div>
			</SurfaceSection>

			<SurfaceSection
				title="Steps"
				description="Steps run in order unless transitions or join policies say otherwise."
				action={
					<Button type="button" size="sm" variant="outline" onClick={addStep}>
						<Plus className="size-3.5" />
						Add step
					</Button>
				}
				contentClassName="space-y-3"
			>
				{draft.steps.length === 0 ? (
					<EmptyState
						icon={WorkflowIcon}
						title="No steps yet"
						description="Add the first step to get started."
						height="h-32"
					/>
				) : (
					draft.steps.map((step, index) => (
						<WorkflowStepEditor
							key={`${step.id}-${index}`}
							step={step}
							allStepIds={stepIds}
							availableAgents={availableAgents}
							availableCapabilities={availableCapabilities}
							stepIssues={issuesByStep.get(step.id) ?? []}
							canMoveUp={index > 0}
							canMoveDown={index < draft.steps.length - 1}
							onChange={(next) => updateStep(index, next)}
							onDelete={() => deleteStep(index)}
							onMoveUp={() => moveStep(index, -1)}
							onMoveDown={() => moveStep(index, 1)}
						/>
					))
				)}
			</SurfaceSection>

			{(topLevelIssues.length > 0 || errorCount > 0 || warningCount > 0) && (
				<SurfaceSection
					title="Validation"
					description={`${errorCount} error${errorCount === 1 ? '' : 's'}, ${warningCount} warning${
						warningCount === 1 ? '' : 's'
					}.`}
					contentClassName="space-y-1"
				>
					{topLevelIssues.map((issue, idx) => (
						<div
							key={`top-${idx}`}
							className="flex items-center gap-2 text-sm text-destructive"
						>
							<Badge variant={issue.severity === 'error' ? 'destructive' : 'warning'}>
								{issue.severity}
							</Badge>
							<span>{issue.message}</span>
						</div>
					))}
					{issues
						.filter((i) => i.stepId)
						.map((issue, idx) => (
							<div
								key={`step-${idx}`}
								className="flex items-center gap-2 text-sm text-muted-foreground"
							>
								<Badge variant={issue.severity === 'error' ? 'destructive' : 'warning'}>
									{issue.severity}
								</Badge>
								<span>{issue.message}</span>
							</div>
						))}
				</SurfaceSection>
			)}
		</div>
	)
}
