import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCreateChannel } from '@/hooks/use-channels'
import { useState } from 'react'

interface CreateChannelDialogProps {
	onClose: () => void
}

export function CreateChannelDialog({ onClose }: CreateChannelDialogProps) {
	const [name, setName] = useState('')
	const createChannel = useCreateChannel()

	const handleSubmit = () => {
		const trimmed = name
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9-]/g, '-')
		if (!trimmed) return
		createChannel.mutate(trimmed, { onSuccess: () => onClose() })
	}

	return (
		<>
			<div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
			<div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-background border border-border p-6">
				<h2 className="font-mono text-[13px] font-bold tracking-[-0.03em] mb-4">Create Channel</h2>
				<div className="space-y-4">
					<div>
						<label className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.1em] mb-1 block">
							Channel Name
						</label>
						<Input
							value={name}
							onChange={(e) => setName(e.target.value)}
							onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
							placeholder="project-pricing"
							autoFocus
						/>
					</div>
					<div className="flex justify-end gap-2">
						<Button variant="outline" onClick={onClose}>
							Cancel
						</Button>
						<Button onClick={handleSubmit} disabled={!name.trim() || createChannel.isPending}>
							{createChannel.isPending ? 'Creating...' : 'Create'}
						</Button>
					</div>
				</div>
			</div>
		</>
	)
}
