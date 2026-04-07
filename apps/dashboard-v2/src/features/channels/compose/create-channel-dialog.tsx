import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useTranslation } from '@/lib/i18n'
import { useCreateChannel } from '../data/channels.mutations'

interface CreateChannelDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
}

const CHANNEL_NAME_REGEX = /^[a-z0-9][a-z0-9-]*$/
const MIN_LENGTH = 2
const MAX_LENGTH = 50

function normalizeChannelName(input: string): string {
	return input
		.toLowerCase()
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9-]/g, '')
		.replace(/-+/g, '-')
}

export function CreateChannelDialog({
	open,
	onOpenChange,
}: CreateChannelDialogProps): React.JSX.Element {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const [name, setName] = useState('')
	const [error, setError] = useState<string | null>(null)
	const createChannel = useCreateChannel()

	const normalized = normalizeChannelName(name)

	const validate = (value: string): string | null => {
		if (value.length < MIN_LENGTH) return t('channels.name_too_short')
		if (value.length > MAX_LENGTH) return t('channels.name_too_long')
		if (!CHANNEL_NAME_REGEX.test(value)) return t('channels.name_invalid')
		return null
	}

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault()
		const validationError = validate(normalized)
		if (validationError) {
			setError(validationError)
			return
		}

		try {
			const channel = await createChannel.mutateAsync({ name: normalized })
			onOpenChange(false)
			setName('')
			setError(null)
			void navigate({ to: '/c/$channelId', params: { channelId: channel.id } })
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to create channel'
			if (message.includes('already exists') || message.includes('UNIQUE')) {
				setError(t('channels.name_taken'))
			} else {
				toast.error(message)
			}
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-sm">
				<DialogHeader>
					<DialogTitle>{t('channels.create_channel')}</DialogTitle>
				</DialogHeader>

				<form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
					<div>
						<Input
							value={name}
							onChange={(event) => {
								setName(event.target.value)
								setError(null)
							}}
							placeholder="e.g. marketing"
							autoFocus
							maxLength={MAX_LENGTH}
						/>
						{normalized && normalized !== name.toLowerCase() ? (
							<p className="mt-1 text-xs text-muted-foreground">
								Will be created as <span className="font-mono">#{normalized}</span>
							</p>
						) : null}
						{error ? (
							<p className="mt-1 text-xs text-destructive">{error}</p>
						) : null}
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="ghost"
							onClick={() => onOpenChange(false)}
						>
							{t('common.cancel')}
						</Button>
						<Button
							type="submit"
							disabled={createChannel.isPending || normalized.length < MIN_LENGTH}
						>
							{t('channels.create_channel')}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
