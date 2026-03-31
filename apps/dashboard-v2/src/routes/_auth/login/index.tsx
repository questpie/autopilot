import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmailVerificationPanel } from '@/features/auth/email-verification-panel'
import { authClient, getAppCallbackUrl } from '@/lib/auth'
import { useTranslation } from '@/lib/i18n'
import { EASING } from '@/lib/motion'
import { zodResolver } from '@hookform/resolvers/zod'
import { EyeIcon, EyeSlashIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
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

const screenTransition = {
	initial: { opacity: 0, y: 8 },
	animate: { opacity: 1, y: 0 },
	exit: { opacity: 0 },
	transition: { duration: 0.2, ease: EASING.enter },
}

function LoginPage() {
	'use no memo'
	const { t } = useTranslation()
	const router = useRouter()
	const search = Route.useSearch()
	const redirect = search.redirect

	const [state, dispatch] = useReducer(loginReducer, loginInitialState)
	const [verifyCredentials, setVerifyCredentials] = useState<{
		email: string
		password: string
	} | null>(null)

	const { showPassword, error, showError, failCount, rateLimitCountdown } = state
	const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
	const emailInputRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		emailInputRef.current?.focus()
	}, [])

	const form = useForm<LoginValues>({
		resolver: zodResolver(loginSchema),
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

		const result = await authClient.signIn.email({
			email: values.email,
			password: values.password,
			callbackURL: getAppCallbackUrl(isValidRedirect(redirect) ? redirect : '/'),
		})

		if (result.error) {
			const msg = result.error.message?.toLowerCase() ?? ''
			if (msg.includes('email') && msg.includes('verified')) {
				setVerifyCredentials({ email: values.email, password: values.password })
				return
			}

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

	const isRateLimited = rateLimitCountdown > 0

	return (
		<AnimatePresence mode="wait">
			{verifyCredentials ? (
				<m.div key="verify" {...screenTransition}>
					<EmailVerificationPanel
						email={verifyCredentials.email}
						password={verifyCredentials.password}
						onBack={() => setVerifyCredentials(null)}
						onVerified={async () => {
							await router.navigate({ to: isValidRedirect(redirect) ? redirect : '/' })
						}}
					/>
				</m.div>
			) : (
				<m.div key="login" {...screenTransition}>
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

						<FormProvider {...form}>
							<form
								onSubmit={form.handleSubmit(onSubmit)}
								className="flex flex-col gap-4"
								noValidate
							>
								<div className="flex flex-col gap-1.5">
									<Label htmlFor="email" className="font-heading text-xs font-medium">
										{t('auth.email')}
									</Label>
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
											<m.p
												initial={{ opacity: 0, y: -4 }}
												animate={{ opacity: 1, y: 0 }}
												exit={{ opacity: 0, y: -4 }}
												transition={{ duration: 0.15 }}
												className="text-xs text-destructive"
											>
												{form.formState.errors.email.message}
											</m.p>
										)}
									</AnimatePresence>
								</div>

								<div className="flex flex-col gap-1.5">
									<Label htmlFor="password" className="font-heading text-xs font-medium">
										{t('auth.password')}
									</Label>
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
											<m.p
												initial={{ opacity: 0, y: -4 }}
												animate={{ opacity: 1, y: 0 }}
												exit={{ opacity: 0, y: -4 }}
												transition={{ duration: 0.15 }}
												className="text-xs text-destructive"
											>
												{form.formState.errors.password.message}
											</m.p>
										)}
									</AnimatePresence>
								</div>

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
				</m.div>
			)}
		</AnimatePresence>
	)
}
