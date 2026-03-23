import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface RejectDialogProps {
	onSubmit: (reason: string) => void
	onClose: () => void
	isLoading?: boolean
}

export function RejectDialog({ onSubmit, onClose, isLoading }: RejectDialogProps) {
	const [reason, setReason] = useState('')

	const handleSubmit = () => {
		const trimmed = reason.trim()
		if (!trimmed) return
		onSubmit(trimmed)
	}

	return (
		<>
			<div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
			<div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-background border border-border p-6">
				<h2 className="font-mono text-[13px] font-bold tracking-[-0.03em] mb-1">
					Reject Task
				</h2>
				<p className="text-sm text-muted-foreground mb-4">
					Describe what needs to change.
				</p>
				<Textarea
					value={reason}
					onChange={(e) => setReason(e.target.value)}
					placeholder="Describe what needs to change..."
					className="mb-4"
					rows={4}
					autoFocus
				/>
				<div className="flex justify-end gap-2">
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button
						variant="destructive"
						onClick={handleSubmit}
						disabled={!reason.trim() || isLoading}
					>
						{isLoading ? 'Rejecting...' : 'Reject'}
					</Button>
				</div>
			</div>
		</>
	)
}
