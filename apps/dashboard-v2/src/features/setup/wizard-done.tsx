import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { useTranslation } from '@/lib/i18n'
import { ArrowRightIcon, CheckCircleIcon } from '@phosphor-icons/react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useWizardState } from './use-wizard-state'

interface WizardDoneProps {
	onFinish: () => void
}

export function WizardDone({ onFinish }: WizardDoneProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const { accountData, providerChoice, isStepComplete, reset } = useWizardState()

	const completeSetup = useMutation({
		mutationFn: async () => {
			const res = await api.api.setup.complete.$post()
			if (!res.ok) throw new Error('Failed to complete setup')
		},
		onError: () => toast.error('Failed to finalize setup.'),
	})

	const handleOpenDashboard = async () => {
		await completeSetup.mutateAsync()
		reset()
		onFinish()
		await navigate({ to: '/' })
	}

	const summaryItems = [
		{
			label: 'Owner',
			value: accountData ? `${accountData.name} (${accountData.email})` : 'Configured',
		},
		{
			label: '2FA',
			value: isStepComplete(2) ? 'Enabled' : 'Skipped',
		},
		{
			label: 'Provider',
			value: providerChoice ? 'OpenRouter' : 'Not configured',
		},
	]

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col items-center gap-3 text-center">
				<CheckCircleIcon className="size-10 text-success" weight="fill" />
				<h2 className="font-heading text-xl font-semibold">{t('setup.done_title')}</h2>
			</div>

			{/* Summary */}
			<div className="flex flex-col gap-1 border border-border p-3">
				{summaryItems.map((item) => (
					<div key={item.label} className="flex justify-between py-0.5">
						<span className="text-xs text-muted-foreground">{item.label}</span>
						<span className="font-heading text-xs font-medium">{item.value}</span>
					</div>
				))}
			</div>

			{/* First intent input */}
			<div className="flex flex-col gap-2">
				<Input placeholder={t('setup.done_ask')} className="text-sm" />
				<div className="flex flex-col gap-1">
					<span className="text-xs text-muted-foreground/60">{t('setup.done_example_1')}</span>
					<span className="text-xs text-muted-foreground/60">{t('setup.done_example_2')}</span>
					<span className="text-xs text-muted-foreground/60">{t('setup.done_example_3')}</span>
				</div>
			</div>

			<Button
				type="button"
				size="lg"
				className="w-full"
				onClick={() => void handleOpenDashboard()}
				loading={completeSetup.isPending}
			>
				{t('setup.done_open_dashboard')}
				<ArrowRightIcon className="size-4" />
			</Button>
		</div>
	)
}
