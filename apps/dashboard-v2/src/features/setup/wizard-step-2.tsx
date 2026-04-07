import { QrCodeImage } from '@/components/qr-code-image'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '@/lib/auth'
import { useTranslation } from '@/lib/i18n'
import {
	ArrowLeftIcon,
	CheckIcon,
	CopyIcon,
	DownloadSimpleIcon,
	WarningCircleIcon,
} from '@phosphor-icons/react'
import { AnimatePresence, m } from 'framer-motion'
import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useWizardState } from './use-wizard-state'
import { WizardStepLayout } from './wizard-step-layout'

interface WizardStep2Props {
	onComplete: () => void
	onBack: () => void
}

export function WizardStep2({ onComplete, onBack }: WizardStep2Props) {
	const { t } = useTranslation()
	const { completeStep } = useWizardState()

	const [phase, setPhase] = useState<'password' | 'qr' | 'verify' | 'backup'>('password')
	const [password, setPassword] = useState('')
	const [totpURI, setTotpURI] = useState<string | null>(null)
	const [backupCodes, setBackupCodes] = useState<string[]>([])
	const [digits, setDigits] = useState<string[]>(['', '', '', '', '', ''])
	const [savedBackup, setSavedBackup] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [copiedKey, setCopiedKey] = useState(false)

	const inputRefs = useRef<(HTMLInputElement | null)[]>([])

	const handleEnable = useCallback(async () => {
		if (!password) return
		setIsLoading(true)
		setError(null)

		const result = await authClient.twoFactor.enable({ password })
		setIsLoading(false)

		if (result.error) {
			setError(result.error.message ?? t('errors.failed_enable_2fa'))
			return
		}

		if (result.data) {
			setTotpURI(result.data.totpURI ?? null)
			setBackupCodes(result.data.backupCodes ?? [])
			setPhase('qr')
		}
	}, [password])

	const handleDigitChange = useCallback(
		(index: number, value: string) => {
			if (!/^\d*$/.test(value)) return
			const newDigits = [...digits]
			newDigits[index] = value.slice(-1)
			setDigits(newDigits)
			if (value && index < 5) {
				inputRefs.current[index + 1]?.focus()
			}
		},
		[digits],
	)

	const handleDigitKeyDown = useCallback(
		(index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === 'Backspace' && !digits[index] && index > 0) {
				inputRefs.current[index - 1]?.focus()
			}
		},
		[digits],
	)

	const handleDigitPaste = useCallback(
		(e: React.ClipboardEvent) => {
			e.preventDefault()
			const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
			if (!pasted.length) return
			const newDigits = [...digits]
			for (let i = 0; i < pasted.length; i++) newDigits[i] = pasted[i]
			setDigits(newDigits)
			if (pasted.length < 6) inputRefs.current[pasted.length]?.focus()
		},
		[digits],
	)

	const handleVerify = useCallback(async () => {
		const code = digits.join('')
		if (code.length !== 6) return

		setIsLoading(true)
		setError(null)

		const result = await authClient.twoFactor.verifyTotp({ code })
		setIsLoading(false)

		if (result.error) {
			setError(result.error.message ?? t('auth.error_2fa_invalid'))
			setDigits(['', '', '', '', '', ''])
			inputRefs.current[0]?.focus()
			return
		}

		setPhase('backup')
	}, [digits, t])

	const handleCopyAll = useCallback(() => {
		void navigator.clipboard.writeText(backupCodes.join('\n'))
		toast.success(t('common.copied'))
	}, [backupCodes, t])

	const handleDownload = useCallback(() => {
		const blob = new Blob([backupCodes.join('\n')], { type: 'text/plain' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = 'questpie-backup-codes.txt'
		a.click()
		URL.revokeObjectURL(url)
	}, [backupCodes])

	const handleComplete = useCallback(() => {
		completeStep(2)
		onComplete()
	}, [completeStep, onComplete])

	const manualKey = totpURI ? new URLSearchParams(totpURI.split('?')[1] ?? '').get('secret') : null

	const headerBlock = (
		<div>
			<h2 className="font-heading text-xl font-semibold">{t('setup.step_2_title')}</h2>
			<p className="mt-1 text-sm text-muted-foreground">{t('setup.step_2_description')}</p>
			{error && (
				<div className="mt-4">
					<Alert variant="destructive">
						<WarningCircleIcon className="size-4" />
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				</div>
			)}
		</div>
	)

	if (phase === 'password') {
		return (
			<WizardStepLayout
				header={headerBlock}
				footer={
					<div className="flex gap-2">
						<Button type="button" variant="outline" size="lg" onClick={onBack}>
							<ArrowLeftIcon className="size-4" />
							{t('common.back')}
						</Button>
						<Button
							type="button"
							size="lg"
							className="flex-1"
							disabled={!password || isLoading}
							onClick={() => void handleEnable()}
							loading={isLoading}
						>
							{t('common.continue')}
						</Button>
					</div>
				}
			>
				<div className="flex w-full flex-col gap-4">
					<p className="text-sm text-muted-foreground">{t('settings.tfa_enable_confirm')}</p>
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="2fa-password" className="font-heading text-xs font-medium">
							{t('auth.password')}
						</Label>
						<Input
							id="2fa-password"
							type="password"
							autoFocus
							value={password}
							onChange={(e) => setPassword(e.currentTarget.value)}
							disabled={isLoading}
							onKeyDown={(e) => {
								if (e.key === 'Enter') void handleEnable()
							}}
						/>
					</div>
				</div>
			</WizardStepLayout>
		)
	}

	if (phase === 'qr') {
		return (
			<WizardStepLayout
				header={headerBlock}
				footer={
					<Button type="button" size="lg" className="w-full" onClick={() => setPhase('verify')}>
						{t('common.continue')}
					</Button>
				}
			>
				<div className="flex flex-col items-center gap-4">
					{totpURI && (
						<div className="border border-border bg-white p-2">
							<QrCodeImage value={totpURI} size={160} alt="2FA QR Code" />
						</div>
					)}
					<p className="text-xs text-muted-foreground">{t('setup.step_2_scan_qr')}</p>
					{manualKey && (
						<div className="flex items-center gap-2">
							<code className="border border-border bg-muted px-2 py-1 font-heading text-xs">
								{manualKey}
							</code>
							<button
								type="button"
								onClick={() => {
									void navigator.clipboard.writeText(manualKey)
									toast.success(t('common.copied'))
									setCopiedKey(true)
									setTimeout(() => setCopiedKey(false), 2000)
								}}
								className="text-muted-foreground hover:text-foreground"
							>
								<AnimatePresence mode="wait" initial={false}>
									<m.span
										key={copiedKey ? 'check' : 'copy'}
										initial={{ opacity: 0, scale: 0.8 }}
										animate={{ opacity: 1, scale: 1 }}
										exit={{ opacity: 0, scale: 0.8 }}
										transition={{ duration: 0.15 }}
										className="inline-flex"
									>
										{copiedKey ? (
											<CheckIcon className="size-3.5" />
										) : (
											<CopyIcon className="size-3.5" />
										)}
									</m.span>
								</AnimatePresence>
							</button>
						</div>
					)}
				</div>
			</WizardStepLayout>
		)
	}

	if (phase === 'verify') {
		return (
			<WizardStepLayout
				header={headerBlock}
				footer={
					<div className="flex gap-2">
						<Button type="button" variant="outline" size="lg" onClick={() => setPhase('qr')}>
							<ArrowLeftIcon className="size-4" />
							{t('common.back')}
						</Button>
						<Button
							type="button"
							size="lg"
							className="flex-1"
							disabled={digits.join('').length !== 6 || isLoading}
							onClick={() => void handleVerify()}
							loading={isLoading}
						>
							{t('auth.verify')}
						</Button>
					</div>
				}
			>
				<div className="flex flex-col items-center gap-3">
					<Label className="font-heading text-xs font-medium">{t('setup.step_2_enter_code')}</Label>
					<div className="flex justify-center gap-2.5" onPaste={handleDigitPaste}>
						{digits.map((digit, i) => (
							<input
								key={i}
								ref={(el) => {
									inputRefs.current[i] = el
								}}
								type="text"
								inputMode="numeric"
								maxLength={1}
								value={digit}
								autoFocus={i === 0}
								disabled={isLoading}
								onChange={(e) => handleDigitChange(i, e.target.value)}
								onKeyDown={(e) => handleDigitKeyDown(i, e)}
								className="flex size-12 items-center justify-center border border-input bg-transparent text-center font-heading text-xl outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring/50 focus:bg-secondary/50 disabled:opacity-50"
								aria-label={t('a11y.digit_n', { n: i + 1 })}
							/>
						))}
					</div>
				</div>
			</WizardStepLayout>
		)
	}

	// phase === "backup"
	return (
		<WizardStepLayout
			header={headerBlock}
			footer={
				<>
					<div className="flex items-center gap-2">
						<Checkbox
							checked={savedBackup}
							onCheckedChange={(checked) => setSavedBackup(checked === true)}
							id="backup-saved"
						/>
						<Label htmlFor="backup-saved" className="text-xs">
							{t('setup.step_2_backup_saved')}
						</Label>
					</div>
					<Button
						type="button"
						size="lg"
						className="w-full"
						disabled={!savedBackup}
						onClick={handleComplete}
					>
						{t('common.continue')}
					</Button>
				</>
			}
		>
			<div className="flex w-full flex-col gap-4">
				<Alert>
					<WarningCircleIcon className="size-4" />
					<AlertDescription>{t('setup.step_2_backup_warning')}</AlertDescription>
				</Alert>

				<div className="grid grid-cols-2 gap-2">
					{backupCodes.map((code, i) => (
						<code
							key={i}
							className="border border-border bg-muted px-2 py-1.5 text-center font-heading text-xs"
						>
							{code}
						</code>
					))}
				</div>

				<div className="flex gap-2">
					<Button type="button" variant="outline" size="sm" onClick={handleCopyAll}>
						<CopyIcon className="size-3.5" />
						{t('setup.step_2_copy_all')}
					</Button>
					<Button type="button" variant="outline" size="sm" onClick={handleDownload}>
						<DownloadSimpleIcon className="size-3.5" />
						{t('setup.step_2_download')}
					</Button>
				</div>

				<p className="text-xs text-muted-foreground/60">
					{t('setup.cli_hint')}: autopilot auth 2fa enable
				</p>
			</div>
		</WizardStepLayout>
	)
}
