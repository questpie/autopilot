import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useDeploymentMode } from '@/hooks/use-deployment-mode'
import { api } from '@/lib/api'
import { authClient, getAppCallbackUrl } from '@/lib/auth'
import { useTranslation } from '@/lib/i18n'
import {
	ArrowCounterClockwiseIcon,
	EnvelopeSimpleIcon,
	TerminalWindowIcon,
	WarningCircleIcon,
} from '@phosphor-icons/react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'

interface EmailVerificationPanelProps {
	email: string
	password: string
	onVerified: () => Promise<void> | void
	onBack?: () => void
	backLabel?: string
}

export function EmailVerificationPanel({
	email,
	password,
	onVerified,
	onBack,
	backLabel,
}: EmailVerificationPanelProps) {
	const { t } = useTranslation()
	const { data: deploymentMode } = useDeploymentMode()

	const verificationStatus = useQuery({
		queryKey: ['email-verification-status', email],
		queryFn: async () => {
			const res = await api.api.setup['verification-status'].$get({
				query: { email },
			})
			if (!res.ok) throw new Error('Failed to check verification status')
			return res.json() as Promise<{ exists: boolean; verified: boolean }>
		},
		refetchInterval: 5000,
		retry: false,
	})

	const resend = useMutation({
		mutationFn: () =>
			authClient.sendVerificationEmail({ email, callbackURL: getAppCallbackUrl('/login') }),
		onSuccess: () => toast.success(t('setup.step_1_verify_resent')),
		onError: () => toast.error(t('setup.step_1_verify_resend_failed')),
	})

	const continueToApp = useMutation({
		mutationFn: async () => {
			const status = verificationStatus.data
			if (!status?.verified) {
				await verificationStatus.refetch()
				throw new Error('not_verified')
			}

			const result = await authClient.signIn.email({ email, password })
			if (result.error) {
				throw new Error(result.error.message ?? 'signin_failed')
			}
		},
		onSuccess: async () => {
			await onVerified()
		},
		onError: (error) => {
			const message = error instanceof Error ? error.message.toLowerCase() : ''
			if (message.includes('not_verified') || message.includes('email')) {
				toast.error(t('setup.step_1_verify_not_yet'))
				return
			}
			toast.error(t('auth.error_invalid_credentials'))
		},
	})

	const notYetVerified = verificationStatus.data && !verificationStatus.data.verified

	return (
		<div className="flex flex-col gap-6">
			<h2 className="font-heading text-xl font-semibold">{t('setup.step_1_verify_title')}</h2>

			<div className="flex flex-col items-center gap-4 py-6">
				<div className="flex size-16 items-center justify-center border border-primary/25 bg-primary/[0.08]">
					<EnvelopeSimpleIcon className="size-8 text-primary" />
				</div>
				<div className="text-center">
					<p className="text-sm text-muted-foreground">
						{t('setup.step_1_verify_sent_to', { email: '' })}
					</p>
					<p className="font-heading text-sm font-medium text-foreground">{email}</p>
				</div>
			</div>

			{notYetVerified && (
				<Alert variant="warning">
					<WarningCircleIcon className="size-4" />
					<AlertDescription>{t('setup.step_1_verify_not_yet')}</AlertDescription>
				</Alert>
			)}

			{deploymentMode && deploymentMode !== 'cloud' && (
				<Alert variant="info">
					<TerminalWindowIcon className="size-4" />
					<AlertDescription>{t('setup.step_1_verify_console_hint')}</AlertDescription>
				</Alert>
			)}

			<div className="flex gap-2">
				<Button
					type="button"
					variant="outline"
					size="lg"
					loading={resend.isPending}
					onClick={() => resend.mutate()}
				>
					<ArrowCounterClockwiseIcon className="size-4" />
					{t('setup.step_1_verify_resend')}
				</Button>
				<Button
					type="button"
					size="lg"
					className="flex-1"
					loading={continueToApp.isPending || verificationStatus.isFetching}
					onClick={() => continueToApp.mutate()}
				>
					{t('setup.step_1_verify_done')}
				</Button>
			</div>

			{onBack ? (
				<button
					type="button"
					className="text-xs text-muted-foreground hover:text-foreground"
					onClick={onBack}
				>
					{backLabel ?? t('auth.back_to_login')}
				</button>
			) : null}
		</div>
	)
}
