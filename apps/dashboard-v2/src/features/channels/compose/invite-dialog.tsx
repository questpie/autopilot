import { useState } from 'react'
import { EnvelopeIcon } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { useTranslation } from '@/lib/i18n'
import { useCreateInvite } from '../data/channels.mutations'

interface InviteDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
}

const ROLE_OPTIONS = [
	{ value: 'member', label: 'Member' },
	{ value: 'admin', label: 'Admin' },
	{ value: 'viewer', label: 'Viewer' },
] as const

export function InviteDialog({ open, onOpenChange }: InviteDialogProps): React.JSX.Element {
	const { t } = useTranslation()
	const [email, setEmail] = useState('')
	const [role, setRole] = useState<'member' | 'admin' | 'viewer'>('member')
	const createInvite = useCreateInvite()

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault()
		const trimmed = email.trim().toLowerCase()
		if (!trimmed) return

		try {
			await createInvite.mutateAsync({ email: trimmed, role })
			toast.success(t('channels.invite_sent'))
			setEmail('')
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to send invite')
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>{t('channels.invite_people')}</DialogTitle>
				</DialogHeader>

				<form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
					<div className="flex gap-2">
						<Input
							type="email"
							placeholder="email@example.com"
							value={email}
							onChange={(event) => setEmail(event.target.value)}
							className="flex-1"
							autoFocus
						/>
						<Select value={role} onValueChange={(val) => setRole(val as typeof role)}>
							<SelectTrigger size="sm" className="w-28">
								{ROLE_OPTIONS.find((r) => r.value === role)?.label ?? 'Member'}
							</SelectTrigger>
							<SelectContent>
								{ROLE_OPTIONS.map((opt) => (
									<SelectItem key={opt.value} value={opt.value}>
										{opt.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Button type="submit" size="sm" disabled={createInvite.isPending || !email.trim()}>
							<EnvelopeIcon size={14} />
							{t('channels.invite')}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	)
}
