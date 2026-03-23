import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAgents } from '@/hooks/use-agents'
import { useCreateTask } from '@/hooks/use-tasks'
import { useState } from 'react'

const TASK_TYPES = [
	'intent',
	'planning',
	'implementation',
	'review',
	'deployment',
	'marketing',
] as const
const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const
const WORKFLOWS = ['development', 'marketing', 'incident', 'none'] as const

interface CreateTaskDialogProps {
	onClose: () => void
}

export function CreateTaskDialog({ onClose }: CreateTaskDialogProps) {
	const [title, setTitle] = useState('')
	const [description, setDescription] = useState('')
	const [type, setType] = useState<string>('intent')
	const [priority, setPriority] = useState<string>('medium')
	const [assignedTo, setAssignedTo] = useState<string>('')
	const [workflow, setWorkflow] = useState<string>('none')
	const [project, setProject] = useState('')
	const [labels, setLabels] = useState<string[]>([])
	const [labelInput, setLabelInput] = useState('')
	const createTask = useCreateTask()
	const { data: agents } = useAgents()

	const addLabel = () => {
		const label = labelInput.trim().toLowerCase()
		if (label && !labels.includes(label)) {
			setLabels([...labels, label])
		}
		setLabelInput('')
	}

	const removeLabel = (label: string) => {
		setLabels(labels.filter((l) => l !== label))
	}

	const handleSubmit = () => {
		if (!title.trim()) return
		createTask.mutate(
			{
				title: title.trim(),
				description: description.trim() || undefined,
				type,
				priority,
				assigned_to: assignedTo || undefined,
				workflow: workflow === 'none' ? undefined : workflow,
				labels: labels.length > 0 ? labels : undefined,
				project: project.trim() || undefined,
			},
			{ onSuccess: () => onClose() },
		)
	}

	return (
		<>
			<div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
			<div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-background border border-border p-6 max-h-[90vh] overflow-y-auto">
				<h2 className="font-mono text-[13px] font-bold tracking-[-0.03em] mb-4">New Task</h2>
				<div className="space-y-4">
					<Field label="Title">
						<Input
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="Task title"
							autoFocus
						/>
					</Field>

					<Field label="Description">
						<Textarea
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Describe the task (markdown supported)"
							rows={4}
						/>
					</Field>

					<div className="grid grid-cols-2 gap-4">
						<Field label="Type">
							<SelectField value={type} onChange={setType} options={TASK_TYPES} />
						</Field>

						<Field label="Priority">
							<SelectField value={priority} onChange={setPriority} options={PRIORITIES} />
						</Field>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<Field label="Assign to">
							<select
								value={assignedTo}
								onChange={(e) => setAssignedTo(e.target.value)}
								className="h-8 w-full border border-input bg-transparent px-2.5 text-sm"
							>
								<option value="">Unassigned</option>
								{agents?.map((a) => (
									<option key={a.id} value={a.id}>
										{a.name} ({a.role})
									</option>
								))}
							</select>
						</Field>

						<Field label="Workflow">
							<SelectField value={workflow} onChange={setWorkflow} options={WORKFLOWS} />
						</Field>
					</div>

					<Field label="Project">
						<Input
							value={project}
							onChange={(e) => setProject(e.target.value)}
							placeholder="e.g. pricing-page"
						/>
					</Field>

					<Field label="Labels">
						<div className="space-y-2">
							{labels.length > 0 && (
								<div className="flex gap-1 flex-wrap">
									{labels.map((label) => (
										<Badge
											key={label}
											variant="outline"
											className="font-mono text-[9px] cursor-pointer hover:bg-destructive/10"
											onClick={() => removeLabel(label)}
										>
											{label} x
										</Badge>
									))}
								</div>
							)}
							<div className="flex gap-2">
								<Input
									value={labelInput}
									onChange={(e) => setLabelInput(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === 'Enter') {
											e.preventDefault()
											addLabel()
										}
									}}
									placeholder="Add label..."
									className="flex-1 h-8 text-[11px]"
								/>
								<Button size="sm" variant="outline" onClick={addLabel} type="button">
									Add
								</Button>
							</div>
						</div>
					</Field>

					<div className="flex justify-end gap-2 pt-2">
						<Button variant="outline" onClick={onClose}>
							Cancel
						</Button>
						<Button onClick={handleSubmit} disabled={!title.trim() || createTask.isPending}>
							{createTask.isPending ? 'Creating...' : 'Create Task'}
						</Button>
					</div>
				</div>
			</div>
		</>
	)
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div>
			<label className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.1em] mb-1 block">
				{label}
			</label>
			{children}
		</div>
	)
}

function SelectField({
	value,
	onChange,
	options,
}: {
	value: string
	onChange: (v: string) => void
	options: readonly string[]
}) {
	return (
		<select
			value={value}
			onChange={(e) => onChange(e.target.value)}
			className="h-8 w-full border border-input bg-transparent px-2.5 text-sm"
		>
			{options.map((opt) => (
				<option key={opt} value={opt}>
					{opt}
				</option>
			))}
		</select>
	)
}
