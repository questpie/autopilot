import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import {
	ResponsiveModal,
	ResponsiveModalContent,
	ResponsiveModalDescription,
	ResponsiveModalFooter,
	ResponsiveModalHeader,
	ResponsiveModalTitle,
} from '@/components/ui/responsive-modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useAgents } from '@/hooks/use-agents'
import { useWorkflows } from '@/hooks/use-workflows'
import { useCreateTask } from '@/hooks/use-tasks'

interface NewTaskModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
}

interface NewTaskFormState {
	title: string
	description: string
	type: string
	priority: 'low' | 'medium' | 'high'
	assignedTo: string
	workflowId: string
}

const INITIAL_FORM: NewTaskFormState = {
	title: '',
	description: '',
	type: 'task',
	priority: 'medium',
	assignedTo: '',
	workflowId: '',
}

export function NewTaskModal({ open, onOpenChange }: NewTaskModalProps) {
	const navigate = useNavigate()
	const createTask = useCreateTask()
	const agentsQuery = useAgents()
	const workflowsQuery = useWorkflows()
	const [form, setForm] = useState(INITIAL_FORM)

	useEffect(() => {
		if (!open) {
			setForm(INITIAL_FORM)
		}
	}, [open])

	function updateField<K extends keyof NewTaskFormState>(key: K, value: NewTaskFormState[K]) {
		setForm((prev) => ({ ...prev, [key]: value }))
	}

	function handleSubmit() {
		const title = form.title.trim()
		if (!title) return

		createTask.mutate(
			{
				title,
				description: form.description.trim() || undefined,
				type: form.type,
				status: 'backlog',
				priority: form.priority,
				assigned_to: form.assignedTo || undefined,
				workflow_id: form.workflowId || undefined,
			},
			{
				onSuccess: (task) => {
					toast.success('Task created')
					onOpenChange(false)
					void navigate({ to: '/tasks', search: { taskId: task.id } })
				},
				onError: (error) => {
					toast.error(error instanceof Error ? error.message : 'Failed to create task')
				},
			},
		)
	}

	const canSubmit = form.title.trim().length > 0 && !createTask.isPending

	return (
		<ResponsiveModal open={open} onOpenChange={onOpenChange}>
			<ResponsiveModalContent
				desktopClassName="sm:max-w-xl"
				mobileClassName="max-h-[85vh]"
				mobileSide="bottom"
			>
				<ResponsiveModalHeader>
					<ResponsiveModalTitle>New task</ResponsiveModalTitle>
					<ResponsiveModalDescription>
						Create a task quickly, then jump straight into the detail view.
					</ResponsiveModalDescription>
				</ResponsiveModalHeader>

				<div className="space-y-4 px-0 py-1">
					<Field>
						<FieldLabel htmlFor="new-task-title">Title</FieldLabel>
						<FieldContent>
							<Input
								id="new-task-title"
								autoFocus
								placeholder="Fix composer slash command flow"
								value={form.title}
								onChange={(event) => updateField('title', event.target.value)}
							/>
						</FieldContent>
					</Field>

					<Field>
						<FieldLabel htmlFor="new-task-description">Description</FieldLabel>
						<FieldContent>
							<Textarea
								id="new-task-description"
								rows={5}
								placeholder="Describe the problem, intent, or expected outcome."
								value={form.description}
								onChange={(event) => updateField('description', event.target.value)}
							/>
							<FieldDescription>
								Keep this focused on the outcome. Implementation details can come later.
							</FieldDescription>
						</FieldContent>
					</Field>

					<FieldGroup className="grid gap-3 sm:grid-cols-2">
						<Field>
							<FieldLabel htmlFor="new-task-type">Type</FieldLabel>
							<FieldContent>
								<Select
									id="new-task-type"
									value={form.type}
									onChange={(event) => updateField('type', event.target.value)}
								>
									<option value="task">Task</option>
									<option value="feature">Feature</option>
									<option value="query">Query</option>
								</Select>
							</FieldContent>
						</Field>

						<Field>
							<FieldLabel htmlFor="new-task-priority">Priority</FieldLabel>
							<FieldContent>
								<Select
									id="new-task-priority"
									value={form.priority}
									onChange={(event) =>
										updateField('priority', event.target.value as NewTaskFormState['priority'])
									}
								>
									<option value="low">Low</option>
									<option value="medium">Medium</option>
									<option value="high">High</option>
								</Select>
							</FieldContent>
						</Field>

						<Field>
							<FieldLabel htmlFor="new-task-assignee">Assignee</FieldLabel>
							<FieldContent>
								<Select
									id="new-task-assignee"
									value={form.assignedTo}
									onChange={(event) => updateField('assignedTo', event.target.value)}
									disabled={agentsQuery.isLoading}
								>
									<option value="">Unassigned</option>
									{(agentsQuery.data ?? []).map((agent) => (
										<option key={agent.id} value={agent.id}>
											{agent.name}
										</option>
									))}
								</Select>
							</FieldContent>
						</Field>

						<Field>
							<FieldLabel htmlFor="new-task-workflow">Workflow</FieldLabel>
							<FieldContent>
								<Select
									id="new-task-workflow"
									value={form.workflowId}
									onChange={(event) => updateField('workflowId', event.target.value)}
									disabled={workflowsQuery.isLoading}
								>
									<option value="">None</option>
									{(workflowsQuery.data ?? []).map((workflow) => (
										<option key={workflow.id} value={workflow.id}>
											{workflow.name}
										</option>
									))}
								</Select>
							</FieldContent>
						</Field>
					</FieldGroup>
				</div>

				<ResponsiveModalFooter className="gap-2 sm:justify-end">
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button loading={createTask.isPending} disabled={!canSubmit} onClick={handleSubmit}>
						Create task
					</Button>
				</ResponsiveModalFooter>
			</ResponsiveModalContent>
		</ResponsiveModal>
	)
}
