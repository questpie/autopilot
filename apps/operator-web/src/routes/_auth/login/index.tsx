import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldContent, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { authClient, getAppCallbackUrl } from '@/lib/auth'

import { useTranslation } from '@/lib/i18n'
import {
	ArrowCounterClockwiseIcon,
	EyeIcon,
	EyeSlashIcon,
	EnvelopeSimpleIcon,
	WarningCircleIcon,
} from '@phosphor-icons/react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { AnimatePresence, m } from 'framer-motion'
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { z } from 'zod/v4'

const loginSchema = z.object({
	email: z.email('Invalid email address'),
	password: z.string().min(1, 'Password is required'),
})

type LoginValues = z.infer<typeof loginSchema>

const loginSearchSchema = z.object({
	redirect: z
		.string()
		.refine((u) => u.startsWith('/') && !u.startsWith('//'), 'Invalid redirect')
		.optional(),
})

function isValidRedirect(url: string | undefined): url is string {
	if (!url) return false
	return url.startsWith('/') && !url.startsWith('//')
}

function isEmailVerificationError(message: string | null | undefined): boolean {
	return !!message && message.toLowerCase().includes('email not verified')
}

export const Route = createFileRoute('/_auth/login/')({
	component: LoginPage,
	validateSearch: loginSearchSchema,
})

type LoginState = {
	showPassword: boolean
	error: string | null
	showError: boolean
	failCount: number
	rateLimitCountdown: number
}

type LoginAction =
	| { type: 'TOGGLE_PASSWORD' }
	| { type: 'SUBMIT_START' }
	| { type: 'SUBMIT_FAIL'; error: string; rateLimit: boolean }
	| { type: 'COUNTDOWN_TICK' }

const loginInitialState: LoginState = {
	showPassword: false,
	error: null,
	showError: false,
	failCount: 0,
	rateLimitCountdown: 0,
}

function loginReducer(state: LoginState, action: LoginAction): LoginState {
	switch (action.type) {
		case 'TOGGLE_PASSWORD':
			return { ...state, showPassword: !state.showPassword }
		case 'SUBMIT_START':
			return { ...state, error: null, showError: false }
		case 'SUBMIT_FAIL': {
			const newCount = state.failCount + 1
			return {
				...state,
				failCount: newCount,
				error: action.error,
				showError: true,
				rateLimitCountdown: action.rateLimit ? 60 : state.rateLimitCountdown,
			}
		}
		case 'COUNTDOWN_TICK': {
			const next = state.rateLimitCountdown - 1
			if (next <= 0) {
				return { ...state, rateLimitCountdown: 0, failCount: 0 }
			}
			return { ...state, rateLimitCountdown: next }
		}
		default:
			return state
	}
}

function LoginPage() {
	'use no memo'
	const { t } = useTranslation()
	const router = useRouter()
	const search = Route.useSearch()
	const redirect = search.redirect

	const [state, dispatch] = useReducer(loginReducer, loginInitialState)
	const [verificationState, setVerificationState] = useState<{
		status: 'idle' | 'sending' | 'success' | 'error'
		message: string | null
	}>({
		status: 'idle',
		message: null,
	})

	const { showPassword, error, showError, failCount, rateLimitCountdown } = state
	const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
	const emailInputRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		emailInputRef.current?.focus()
	}, [])

	const form = useForm<LoginValues>({
		resolver: (values, _context, _options) => {
			const result = loginSchema.safeParse(values)
			if (result.success) {
				return { values: result.data, errors: {} }
			}
			return {
				values: {},
				errors: Object.fromEntries(
					result.error.issues.map((issue) => [
						issue.path.join('.'),
						{ type: 'validation', message: issue.message },
					]),
				),
			}
		},
		defaultValues: { email: '', password: '' },
	})

	const startRateLimitCountdown = useCallback(() => {
		if (countdownRef.current) clearInterval(countdownRef.current)
		let ticks = 60
		countdownRef.current = setInterval(() => {
			ticks--
			dispatch({ type: 'COUNTDOWN_TICK' })
			if (ticks <= 0 && countdownRef.current) {
				clearInterval(countdownRef.current)
				countdownRef.current = null
			}
		}, 1000)
	}, [])

	const onSubmit = async (values: LoginValues) => {
		if (rateLimitCountdown > 0) return

		dispatch({ type: 'SUBMIT_START' })
		setVerificationState({ status: 'idle', message: null })

		const result = await authClient.signIn.email({
			email: values.email,
			password: values.password,
			callbackURL: getAppCallbackUrl(isValidRedirect(redirect) ? redirect : '/'),
		})

		if (result.error) {
			const shouldRateLimit = failCount + 1 >= 10
			dispatch({
				type: 'SUBMIT_FAIL',
				error: shouldRateLimit
					? t('auth.error_too_many_attempts', { seconds: 60 })
					: (result.error.message ?? t('auth.error_invalid_credentials')),
				rateLimit: shouldRateLimit,
			})
			if (shouldRateLimit) {
				startRateLimitCountdown()
			}
			return
		}

		// 2FA redirect is handled globally by twoFactorClient({ onTwoFactorRedirect })
		// If we get here, sign-in is complete — navigate to dashboard
		await router.navigate({ to: isValidRedirect(redirect) ? redirect : '/' })
	}

	const onResendVerification = async () => {
		const email = form.getValues('email')?.trim()
		if (!email) return

		setVerificationState({ status: 'sending', message: null })
		const result = await authClient.sendVerificationEmail({
			email,
			callbackURL: getAppCallbackUrl('/login'),
		})

		if (result.error) {
			setVerificationState({
				status: 'error',
				message: result.error.message ?? t('setup.step_1_verify_resend_failed'),
			})
			return
		}

		setVerificationState({
			status: 'success',
			message: `${t('setup.step_1_verify_resent')} ${t('setup.step_1_verify_console_hint')}`,
		})
	}

	const isRateLimited = rateLimitCountdown > 0
	const showVerificationActions = isEmailVerificationError(error)
	const verificationEmail = form.watch('email')?.trim()

	return (
		<div className="flex flex-col gap-6">
			<h2 className="font-heading text-xl font-semibold">{t('auth.sign_in')}</h2>

			<AnimatePresence>
				{showError && error && (
					<m.div
						initial={{ opacity: 0, x: -10 }}
						animate={{ opacity: 1, x: [0, -6, 6, -4, 4, 0] }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.3, x: { type: 'spring', stiffness: 300, damping: 15 } }}
					>
						<Alert variant="destructive">
							<WarningCircleIcon className="size-4" />
							<AlertDescription>
								{isRateLimited
									? t('auth.error_too_many_attempts', { seconds: rateLimitCountdown })
									: error}
							</AlertDescription>
						</Alert>
					</m.div>
				)}
			</AnimatePresence>

			<AnimatePresence>
				{showVerificationActions && verificationEmail ? (
					<m.div
						initial={{ opacity: 0, y: -6 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -6 }}
						transition={{ duration: 0.15 }}
						className="flex flex-col gap-3"
					>
						<Alert variant="info">
							<EnvelopeSimpleIcon className="size-4" />
							<AlertDescription>
								{t('setup.step_1_verify_sent_to', { email: verificationEmail })}
							</AlertDescription>
						</Alert>
						<div className="flex flex-wrap gap-2">
							<Button
								type="button"
								variant="outline"
								loading={verificationState.status === 'sending'}
								disabled={form.formState.isSubmitting || isRateLimited}
								onClick={onResendVerification}
							>
								<ArrowCounterClockwiseIcon className="size-4" />
								{t('setup.step_1_verify_resend')}
							</Button>
						</div>
						{verificationState.message ? (
							<Alert
								variant={verificationState.status === 'success' ? 'success' : 'warning'}
							>
								<AlertDescription>{verificationState.message}</AlertDescription>
							</Alert>
						) : null}
					</m.div>
				) : null}
			</AnimatePresence>

			<FormProvider {...form}>
				<form
					onSubmit={form.handleSubmit(onSubmit)}
					className="flex flex-col gap-4"
					noValidate
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="email" className="font-mono text-xs font-medium">
								{t('auth.email')}
							</FieldLabel>
							<FieldContent>
								<Input
									id="email"
									type="email"
									autoComplete="email"
									placeholder="you@company.com"
									disabled={form.formState.isSubmitting || isRateLimited}
									aria-invalid={!!form.formState.errors.email}
									{...form.register('email')}
									ref={(el) => {
										form.register('email').ref(el)
										emailInputRef.current = el
									}}
								/>
								<AnimatePresence>
									{form.formState.errors.email && (
										<m.div
											initial={{ opacity: 0, y: -4 }}
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0, y: -4 }}
											transition={{ duration: 0.15 }}
										>
											<FieldError>{form.formState.errors.email.message}</FieldError>
										</m.div>
									)}
								</AnimatePresence>
							</FieldContent>
						</Field>

						<Field>
							<div className="flex items-center justify-between">
								<FieldLabel htmlFor="password" className="font-mono text-xs font-medium">
									{t('auth.password')}
								</FieldLabel>
								<Link
									to="/forgot-password"
									className="text-xs text-muted-foreground hover:text-primary"
								>
									{t('auth.forgot_password')}
								</Link>
							</div>
							<FieldContent>
								<div className="relative">
									<Input
										id="password"
										type={showPassword ? 'text' : 'password'}
										autoComplete="current-password"
										disabled={form.formState.isSubmitting || isRateLimited}
										aria-invalid={!!form.formState.errors.password}
										className="pr-9"
										{...form.register('password')}
									/>
									<button
										type="button"
										tabIndex={-1}
										className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
										onClick={() => dispatch({ type: 'TOGGLE_PASSWORD' })}
										aria-label={showPassword ? t('a11y.hide_password') : t('a11y.show_password')}
									>
										<AnimatePresence mode="wait" initial={false}>
											<m.span
												key={showPassword ? 'hide' : 'show'}
												initial={{ opacity: 0, rotate: -90 }}
												animate={{ opacity: 1, rotate: 0 }}
												exit={{ opacity: 0, rotate: 90 }}
												transition={{ duration: 0.15 }}
											>
												{showPassword ? (
													<EyeSlashIcon className="size-4" />
												) : (
													<EyeIcon className="size-4" />
												)}
											</m.span>
										</AnimatePresence>
									</button>
								</div>
								<AnimatePresence>
									{form.formState.errors.password && (
										<m.div
											initial={{ opacity: 0, y: -4 }}
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0, y: -4 }}
											transition={{ duration: 0.15 }}
										>
											<FieldError>{form.formState.errors.password.message}</FieldError>
										</m.div>
									)}
								</AnimatePresence>
							</FieldContent>
						</Field>
					</FieldGroup>

					<Button
						type="submit"
						size="lg"
						className="w-full"
						disabled={form.formState.isSubmitting || isRateLimited}
						loading={form.formState.isSubmitting}
					>
						{t('auth.sign_in')}
					</Button>
				</form>
			</FormProvider>
		</div>
	)
}
