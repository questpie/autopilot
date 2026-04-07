import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { api } from '@/lib/api'
import { authClient, getAppCallbackUrl } from '@/lib/auth'
import { useTranslation } from '@/lib/i18n'
import { zodResolver } from '@hookform/resolvers/zod'
import { EyeIcon, EyeSlashIcon, ShieldWarningIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { zxcvbnAsync, zxcvbnOptions } from '@zxcvbn-ts/core'
import * as zxcvbnCommonPkg from '@zxcvbn-ts/language-common'
import * as zxcvbnEnPkg from '@zxcvbn-ts/language-en'
import { AnimatePresence, m } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { z } from 'zod/v4'

// Initialize zxcvbn
zxcvbnOptions.setOptions({
	translations: zxcvbnEnPkg.translations,
	graphs: zxcvbnCommonPkg.adjacencyGraphs,
	dictionary: {
		...zxcvbnCommonPkg.dictionary,
		...zxcvbnEnPkg.dictionary,
	},
})

const signupSchema = z.object({
	name: z.string().min(1, 'Name is required'),
	password: z
		.string()
		.min(12, 'Password must be at least 12 characters')
		.regex(/[0-9]/, 'Must contain at least 1 digit')
		.regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Must contain at least 1 special character'),
})

type SignupValues = z.infer<typeof signupSchema>

export const Route = createFileRoute('/_auth/signup')({
	component: SignupPage,
	validateSearch: (search: Record<string, unknown>) => ({
		token: (search.token as string) || undefined,
		email: (search.email as string) || undefined,
	}),
})

function PasswordStrengthMeter({ score }: { score: number }) {
	const { t } = useTranslation()

	const labels = [
		t('auth.password_strength_weak'),
		t('auth.password_strength_weak'),
		t('auth.password_strength_fair'),
		t('auth.password_strength_good'),
		t('auth.password_strength_strong'),
	] as const

	const colors = [
		'bg-destructive',
		'bg-destructive',
		'bg-amber-500',
		'bg-success',
		'bg-success',
	] as const

	return (
		<div className="flex flex-col gap-1">
			<div className="flex gap-1">
				{(['s0', 's1', 's2', 's3'] as const).map((id, i) => (
					<div
						key={id}
						className={`h-1 flex-1 transition-colors ${
							i <= score - 1 ? colors[score] : 'bg-muted'
						}`}
					/>
				))}
			</div>
			<span className="text-xs text-muted-foreground">{labels[score]}</span>
		</div>
	)
}

function SignupPage() {
	'use no memo'
	const { t } = useTranslation()
	const router = useRouter()
	const { token, email } = Route.useSearch()

	const [showPassword, setShowPassword] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [passwordScore, setPasswordScore] = useState(0)

	const hasInviteLink = !!token
	const nameInputRef = useRef<HTMLInputElement>(null)

	const inviteQuery = useQuery({
		queryKey: ['signup-invite', token, email],
		queryFn: async () => {
			if (!token) return null
			const res = await api.api.setup.invite.$get({
				query: {
					token,
					...(email ? { email } : {}),
				},
			})
			if (!res.ok) throw new Error('Failed to validate invite')
			return res.json() as Promise<{
				valid: boolean
				email: string | null
				role: string | null
				expiresAt: string | null
			}>
		},
		enabled: !!token,
		retry: false,
	})

	const resolvedInvite = inviteQuery.data?.valid ? inviteQuery.data : null
	const invitedEmail = resolvedInvite?.email ?? null
	const hasInvite = !!invitedEmail

	useEffect(() => {
		nameInputRef.current?.focus()
	}, [])

	const form = useForm<SignupValues>({
		resolver: zodResolver(signupSchema),
		defaultValues: { name: '', password: '' },
	})

	const watchedPassword = form.watch('password')

	// Update password strength when password changes
	useEffect(() => {
		if (!watchedPassword) {
			setPasswordScore(0)
			return
		}
		void zxcvbnAsync(watchedPassword).then((result) => {
			setPasswordScore(result.score)
		})
	}, [watchedPassword])

	const onSubmit = async (values: SignupValues) => {
		if (!hasInvite) return

		setError(null)

		const result = await authClient.signUp.email({
			email: invitedEmail,
			password: values.password,
			name: values.name,
			callbackURL: getAppCallbackUrl('/login'),
		})

		if (result.error) {
			setError(result.error.message ?? t('auth.error_signup_failed'))
			return
		}

		await router.invalidate()
		await router.navigate({ to: '/' })
	}

	if (hasInviteLink && inviteQuery.isLoading) {
		return (
			<div className="flex flex-col items-center gap-4 py-8 text-center">
				<Spinner size="sm" />
				<p className="text-sm text-muted-foreground">Validating invite...</p>
			</div>
		)
	}

	// No invite token -- show invite-only message
	if (!hasInvite) {
		return (
			<div className="flex flex-col items-center gap-6 text-center">
				<ShieldWarningIcon className="size-10 text-muted-foreground" />
				<div>
					<h2 className="font-heading text-xl font-semibold">{t('auth.sign_up')}</h2>
					<p className="mt-2 text-sm text-muted-foreground">
						{hasInviteLink ? 'This invite link is invalid or expired.' : t('auth.invite_only')}
					</p>
				</div>
				<a href="/login" className="text-xs text-primary hover:underline">
					{t('auth.sign_in')}
				</a>
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-6">
			{/* Title */}
			<div>
				<h2 className="font-heading text-xl font-semibold">{t('auth.create_account')}</h2>
			</div>

			{/* Invited email */}
			<div className="flex flex-col gap-1 border border-border p-3">
				<span className="text-xs text-muted-foreground">{t('auth.invited_as')}</span>
				<span className="font-heading text-sm font-medium">{invitedEmail}</span>
			</div>

			{/* Error */}
			<AnimatePresence>
				{error && (
					<m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
						<Alert variant="destructive">
							<WarningCircleIcon className="size-4" />
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					</m.div>
				)}
			</AnimatePresence>

			{/* Form */}
			<FormProvider {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
					{/* Name */}
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="name" className="font-heading text-xs font-medium">
							{t('auth.full_name')}
						</Label>
						<Input
							id="name"
							type="text"
							autoComplete="name"
							disabled={form.formState.isSubmitting}
							aria-invalid={!!form.formState.errors.name}
							{...form.register('name')}
							ref={(el) => {
								form.register('name').ref(el)
								nameInputRef.current = el
							}}
						/>
						{form.formState.errors.name && (
							<p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
						)}
					</div>

					{/* Password */}
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="password" className="font-heading text-xs font-medium">
							{t('auth.password')}
						</Label>
						<div className="relative">
							<Input
								id="password"
								type={showPassword ? 'text' : 'password'}
								autoComplete="new-password"
								disabled={form.formState.isSubmitting}
								aria-invalid={!!form.formState.errors.password}
								className="pr-9"
								{...form.register('password')}
							/>
							<button
								type="button"
								tabIndex={-1}
								className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
								onClick={() => setShowPassword(!showPassword)}
								aria-label={showPassword ? t('a11y.hide_password') : t('a11y.show_password')}
							>
								{showPassword ? (
									<EyeSlashIcon className="size-4" />
								) : (
									<EyeIcon className="size-4" />
								)}
							</button>
						</div>

						{/* Strength meter */}
						{watchedPassword && <PasswordStrengthMeter score={passwordScore} />}

						{/* Requirements hint */}
						<p className="text-xs text-muted-foreground">{t('auth.password_requirements')}</p>

						{form.formState.errors.password && (
							<p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
						)}
					</div>

					{/* Submit */}
					<Button type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting}>
						{form.formState.isSubmitting ? (
							<>
								<Spinner size="sm" />
								{t('auth.creating_account')}
							</>
						) : (
							t('auth.create_account')
						)}
					</Button>
				</form>
			</FormProvider>

			{/* Sign in link */}
			<div className="text-center text-xs text-muted-foreground">
				{t('auth.already_have_account')}{' '}
				<a href="/login" className="text-primary hover:underline">
					{t('auth.sign_in')}
				</a>
			</div>
		</div>
	)
}
