import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAddTaskResource } from '@/hooks/use-tasks'
import { useState } from 'react'

const RESOURCE_TYPES = ['file', 'url', 'pin', 'task'] as const

interface AddResourceDialogProps {
	taskId: string
	onClose: () => void
}

export function AddResourceDialog({ taskId, onClose }: AddResourceDialogProps) {
	const [type, setType] = useState<string>('file')
	const [path, setPath] = useState('')
	const [label, setLabel] = useState('')
	const addResource = useAddTaskResource()

	const handleSubmit = () => {
		if (!path.trim()) return
		addResource.mutate(
			{ taskId, resource: { type, path: path.trim(), label: label.trim() || undefined } },
			{ onSuccess: () => onClose() },
		)
	}

	return (
		<>
			<div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
			<div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-background border border-border p-6">
				<h2 className="font-mono text-[13px] font-bold tracking-[-0.03em] mb-4">Add Resource</h2>
				<div className="space-y-4">
					<div>
						<label className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.1em] mb-1 block">
							Type
						</label>
						<select
							value={type}
							onChange={(e) => setType(e.target.value)}
							className="h-8 w-full border border-input bg-transparent px-2.5 text-sm"
						>
							{RESOURCE_TYPES.map((t) => (
								<option key={t} value={t}>
									{t}
								</option>
							))}
						</select>
					</div>
					<div>
						<label className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.1em] mb-1 block">
							Path / URL
						</label>
						<Input
							value={path}
							onChange={(e) => setPath(e.target.value)}
							placeholder={type === 'url' ? 'https://...' : '/path/to/file'}
							autoFocus
						/>
					</div>
					<div>
						<label className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.1em] mb-1 block">
							Label (optional)
						</label>
						<Input
							value={label}
							onChange={(e) => setLabel(e.target.value)}
							placeholder="Descriptive label"
						/>
					</div>
					<div className="flex justify-end gap-2">
						<Button variant="outline" onClick={onClose}>
							Cancel
						</Button>
						<Button onClick={handleSubmit} disabled={!path.trim() || addResource.isPending}>
							{addResource.isPending ? 'Adding...' : 'Add Resource'}
						</Button>
					</div>
				</div>
			</div>
		</>
	)
}
