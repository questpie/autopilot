/**
 * Single-step editor used by WorkflowSetupWizard.
 *
 * Renders a card per step. The fields shown depend on step.type — the agent
 * step exposes agent_id/instructions/capability profiles/retry/targeting,
 * the human_approval step exposes approvers and approve/reply/reject
 * routing, the wait_for_children step exposes the join policy, and the
 * done step has no extra fields.
 */
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import {
	emptyStep,
	STEP_TYPE_LABEL,
	type WorkflowStepDraft,
	type WorkflowStepType,
	type WorkflowTransitionDraft,
} from './workflow-types'

interface AgentOption {
	id: string
	name?: string
}

interface CapabilityOption {
	id: string
}

interface WorkflowStepEditorProps {
	step: WorkflowStepDraft
	allStepIds: string[]
	availableAgents: AgentOption[]
	availableCapabilities: CapabilityOption[]
	stepIssues: string[]
	canMoveUp: boolean
	canMoveDown: boolean
	onChange: (next: WorkflowStepDraft) => void
	onDelete: () => void
	onMoveUp: () => void
	onMoveDown: () => void
}

const STEP_TYPES: WorkflowStepType[] = ['agent', 'human_approval', 'wait_for_children', 'done']

function parseCsv(value: string): string[] {
	return value
		.split(',')
		.map((item) => item.trim())
		.filter(Boolean)
}

function formatCsv(values: string[] | undefined): string {
	return (values ?? []).join(', ')
}

export function WorkflowStepEditor({
	step,
	allStepIds,
	availableAgents,
	availableCapabilities,
	stepIssues,
	canMoveUp,
	canMoveDown,
	onChange,
	onDelete,
	onMoveUp,
	onMoveDown,
}: WorkflowStepEditorProps) {
	const otherStepIds = allStepIds.filter((id) => id !== step.id)

	function update(patch: Partial<WorkflowStepDraft>) {
		onChange({ ...step, ...patch })
	}

	function changeType(nextType: WorkflowStepType) {
		const blank = emptyStep(step.id, nextType)
		// Carry over commonly useful fields, drop ones the new type wouldn't read.
		onChange({ ...blank, name: step.name, next: step.next })
	}

	function addTransition() {
		update({
			transitions: [...(step.transitions ?? []), { when_field: '', when_value: '', goto: '' }],
		})
	}

	function updateTransition(index: number, patch: Partial<WorkflowTransitionDraft>) {
		const transitions = [...(step.transitions ?? [])]
		transitions[index] = { ...transitions[index]!, ...patch }
		update({ transitions })
	}

	function removeTransition(index: number) {
		update({ transitions: (step.transitions ?? []).filter((_, i) => i !== index) })
	}

	return (
		<div className="space-y-3 rounded-xl border border-border/70 bg-card/40 p-4">
			<div className="flex items-center justify-between gap-3">
				<div className="flex items-center gap-2">
					<Badge variant="outline" className="font-mono">
						{step.id || 'step-id'}
					</Badge>
					<Badge variant="info">{STEP_TYPE_LABEL[step.type]}</Badge>
				</div>
				<div className="flex items-center gap-1">
					<Button
						type="button"
						variant="ghost"
						size="icon"
						aria-label="Move step up"
						onClick={onMoveUp}
						disabled={!canMoveUp}
					>
						<ArrowUp className="size-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						aria-label="Move step down"
						onClick={onMoveDown}
						disabled={!canMoveDown}
					>
						<ArrowDown className="size-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						aria-label="Delete step"
						onClick={onDelete}
					>
						<Trash2 className="size-4" />
					</Button>
				</div>
			</div>

			{stepIssues.length > 0 && (
				<ul className="space-y-1 text-xs text-destructive">
					{stepIssues.map((issue, idx) => (
						<li key={idx}>· {issue}</li>
					))}
				</ul>
			)}

			<div className="grid gap-3 md:grid-cols-3">
				<div className="space-y-1">
					<Label>Step ID</Label>
					<Input
						aria-label="Step ID"
						value={step.id}
						onChange={(e) => update({ id: e.target.value })}
						placeholder="implement"
					/>
				</div>
				<div className="space-y-1">
					<Label>Display name</Label>
					<Input
						aria-label="Step name"
						value={step.name}
						onChange={(e) => update({ name: e.target.value })}
						placeholder="Implement feature"
					/>
				</div>
				<div className="space-y-1">
					<Label>Type</Label>
					<Select
						aria-label="Step type"
						value={step.type}
						onChange={(e) => changeType(e.target.value as WorkflowStepType)}
					>
						{STEP_TYPES.map((t) => (
							<option key={t} value={t}>
								{STEP_TYPE_LABEL[t]}
							</option>
						))}
					</Select>
				</div>
			</div>

			{step.type === 'agent' && (
				<div className="space-y-3">
					<div className="grid gap-3 md:grid-cols-2">
						<div className="space-y-1">
							<Label>Agent</Label>
							<Select
								aria-label="Agent"
								value={step.agent_id ?? ''}
								onChange={(e) => update({ agent_id: e.target.value || undefined })}
							>
								<option value="">— choose agent —</option>
								{availableAgents.map((agent) => (
									<option key={agent.id} value={agent.id}>
										{agent.name ? `${agent.name} (${agent.id})` : agent.id}
									</option>
								))}
							</Select>
						</div>
						<div className="space-y-1">
							<Label>Capability profiles</Label>
							<Input
								aria-label="Capability profiles"
								value={formatCsv(step.capability_profiles)}
								onChange={(e) => update({ capability_profiles: parseCsv(e.target.value) })}
								placeholder={
									availableCapabilities.length > 0
										? availableCapabilities
												.slice(0, 3)
												.map((c) => c.id)
												.join(', ')
										: 'coding, review'
								}
							/>
						</div>
					</div>

					<div className="space-y-1">
						<Label>Instructions</Label>
						<Textarea
							aria-label="Instructions"
							value={step.instructions ?? ''}
							onChange={(e) => update({ instructions: e.target.value })}
							placeholder="Brief telling the agent what to do for this step."
							className="min-h-24 resize-y"
						/>
					</div>

					<div className="grid gap-3 md:grid-cols-2">
						<div className="space-y-1">
							<Label>Retry: max attempts</Label>
							<Input
								aria-label="Retry max attempts"
								type="number"
								min={1}
								value={step.retry_max_attempts ?? ''}
								onChange={(e) =>
									update({
										retry_max_attempts: e.target.value ? Number(e.target.value) : undefined,
									})
								}
								placeholder="1"
							/>
						</div>
						<div className="space-y-1">
							<Label>Retry: delay (seconds)</Label>
							<Input
								aria-label="Retry delay seconds"
								type="number"
								min={0}
								value={step.retry_delay_seconds ?? ''}
								onChange={(e) =>
									update({
										retry_delay_seconds: e.target.value ? Number(e.target.value) : undefined,
									})
								}
								placeholder="0"
							/>
						</div>
					</div>

					<div className="grid gap-3 md:grid-cols-2">
						<div className="space-y-1">
							<Label>Targeting: required runtime</Label>
							<Input
								aria-label="Targeting required runtime"
								value={step.targeting_runtime ?? ''}
								onChange={(e) => update({ targeting_runtime: e.target.value || undefined })}
								placeholder="claude-code, codex, opencode"
							/>
						</div>
						<div className="space-y-1">
							<Label>Targeting: required worker tags</Label>
							<Input
								aria-label="Targeting required tags"
								value={formatCsv(step.targeting_tags)}
								onChange={(e) => update({ targeting_tags: parseCsv(e.target.value) })}
								placeholder="gpu, mac, browser"
							/>
						</div>
					</div>
				</div>
			)}

			{step.type === 'human_approval' && (
				<div className="space-y-3">
					<div className="space-y-1">
						<Label>Approvers</Label>
						<Input
							aria-label="Approvers"
							value={formatCsv(step.approvers)}
							onChange={(e) => update({ approvers: parseCsv(e.target.value) })}
							placeholder="alice, bob, owner"
						/>
					</div>
					<div className="grid gap-3 md:grid-cols-3">
						<div className="space-y-1">
							<Label>On approve</Label>
							<Select
								aria-label="On approve"
								value={step.on_approve ?? ''}
								onChange={(e) => update({ on_approve: e.target.value || undefined })}
							>
								<option value="">— next default —</option>
								{otherStepIds.map((id) => (
									<option key={id} value={id}>
										{id}
									</option>
								))}
							</Select>
						</div>
						<div className="space-y-1">
							<Label>On reply</Label>
							<Select
								aria-label="On reply"
								value={step.on_reply ?? ''}
								onChange={(e) => update({ on_reply: e.target.value || undefined })}
							>
								<option value="">— stay paused —</option>
								{otherStepIds.map((id) => (
									<option key={id} value={id}>
										{id}
									</option>
								))}
							</Select>
						</div>
						<div className="space-y-1">
							<Label>On reject</Label>
							<Select
								aria-label="On reject"
								value={step.on_reject ?? ''}
								onChange={(e) => update({ on_reject: e.target.value || undefined })}
							>
								<option value="">— terminate —</option>
								{otherStepIds.map((id) => (
									<option key={id} value={id}>
										{id}
									</option>
								))}
							</Select>
						</div>
					</div>
				</div>
			)}

			{step.type === 'wait_for_children' && (
				<div className="grid gap-3 md:grid-cols-3">
					<div className="space-y-1">
						<Label>Join policy</Label>
						<Select
							aria-label="Join policy"
							value={step.join_policy ?? 'all_done'}
							onChange={(e) =>
								update({ join_policy: e.target.value as 'all_done' | 'any_failed' })
							}
						>
							<option value="all_done">All children done</option>
							<option value="any_failed">Any child failed</option>
						</Select>
					</div>
					<div className="space-y-1">
						<Label>On met</Label>
						<Select
							aria-label="On met"
							value={step.on_met ?? ''}
							onChange={(e) => update({ on_met: e.target.value || undefined })}
						>
							<option value="">— next default —</option>
							{otherStepIds.map((id) => (
								<option key={id} value={id}>
									{id}
								</option>
							))}
						</Select>
					</div>
					<div className="space-y-1">
						<Label>On failed</Label>
						<Select
							aria-label="On failed"
							value={step.on_failed ?? ''}
							onChange={(e) => update({ on_failed: e.target.value || undefined })}
						>
							<option value="">— terminate —</option>
							{otherStepIds.map((id) => (
								<option key={id} value={id}>
									{id}
								</option>
							))}
						</Select>
					</div>
				</div>
			)}

			{step.type !== 'done' && (
				<div className="space-y-1">
					<Label>Default next step</Label>
					<Select
						aria-label="Default next step"
						value={step.next ?? ''}
						onChange={(e) => update({ next: e.target.value || undefined })}
					>
						<option value="">— next in list —</option>
						{otherStepIds.map((id) => (
							<option key={id} value={id}>
								{id}
							</option>
						))}
					</Select>
				</div>
			)}

			{step.type !== 'done' && (
				<div className="space-y-2">
					<div className="flex items-center justify-between gap-3">
						<div>
							<Label>Output transitions</Label>
							<p className="text-xs text-muted-foreground">
								Route to a specific step when an output field matches a value.
							</p>
						</div>
						<Button type="button" size="sm" variant="outline" onClick={addTransition}>
							<Plus className="size-3.5" />
							Add rule
						</Button>
					</div>

					{(step.transitions ?? []).length === 0 ? (
						<p className="text-sm text-muted-foreground">No output-based rules.</p>
					) : (
						<div className="space-y-2">
							{(step.transitions ?? []).map((transition, index) => (
								<div
									key={index}
									className="grid gap-2 rounded-lg border border-border/60 bg-card/30 p-3 md:grid-cols-[1fr_1fr_1fr_auto]"
								>
									<div className="space-y-1">
										<Label>When field</Label>
										<Input
											aria-label={`Transition field ${index + 1}`}
											value={transition.when_field}
											onChange={(e) =>
												updateTransition(index, { when_field: e.target.value })
											}
											placeholder="status"
										/>
									</div>
									<div className="space-y-1">
										<Label>Equals</Label>
										<Input
											aria-label={`Transition value ${index + 1}`}
											value={transition.when_value}
											onChange={(e) =>
												updateTransition(index, { when_value: e.target.value })
											}
											placeholder="needs_revision"
										/>
									</div>
									<div className="space-y-1">
										<Label>Go to</Label>
										<Select
											aria-label={`Transition target ${index + 1}`}
											value={transition.goto}
											onChange={(e) => updateTransition(index, { goto: e.target.value })}
										>
											<option value="">— choose step —</option>
											{otherStepIds.map((id) => (
												<option key={id} value={id}>
													{id}
												</option>
											))}
										</Select>
									</div>
									<div className="flex items-end">
										<Button
											type="button"
											size="icon"
											variant="ghost"
											aria-label={`Remove transition ${index + 1}`}
											onClick={() => removeTransition(index)}
										>
											<Trash2 className="size-4" />
										</Button>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	)
}
