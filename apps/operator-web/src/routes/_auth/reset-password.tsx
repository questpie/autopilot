import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { authClient } from '@/lib/auth'
import { useTranslation } from '@/lib/i18n'
import {
	CheckCircleIcon,
	EyeIcon,
	EyeSlashIcon,
	ShieldWarningIcon,
	WarningCircleIcon,
} from '@phosphor-icons/react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { AnimatePresence, m } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod/v4'

const resetPasswordSchema = z
	.object({
		password: z.string().min(8, 'auth.error_password_min_length'),
		confirmPassword: z.string().min(1, 'auth.error_password_required'),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: 'auth.password_mismatch',
		path: ['confirmPassword'],
	})

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>

const resetPasswordSearchSchema = z.object({
	token: z.string().optional(),
})

export const Route = createFileRoute('/_auth/reset-password')({
	component: ResetPasswordPage,
	validateSearch: resetPasswordSearchSchema,
})

function ResetPasswordPage() {
	'use no memo'
	const { t } = useTranslation()
	const search = Route.useSearch()
	const token = search.token

	const [isSuccess, setIsSuccess] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [showPassword, setShowPassword] = useState(false)
	const [showConfirm, setShowConfirm] = useState(false)
	const passwordInputRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		if (token) {
			passwordInputRef.current?.focus()
		}
	}, [token])

	const form = useForm<ResetPasswordValues>({
		resolver: (values, _context, _options) => {
			const result = resetPasswordSchema.safeParse(values)
			if (result.success) {
				return { values: result.data, errors: {} }
			}
			return {
				values: {},
				errors: Object.fromEntries(
					result.error.issues.map((issue) => [
						issue.path.join('.'),
						{ type: 'validation', message: t(issue.message) },
					]),
				),
			}
		},
		defaultValues: { password: '', confirmPassword: '' },
	})

	const passwordValue = useWatch({ control: form.control, name: 'password' })

	const onSubmit = async (values: ResetPasswordValues) => {
		setError(null)

		const result = await authClient.resetPassword({
			newPassword: values.password,
			token,
		})

		if (result.error) {
			setError(result.error.message ?? t('auth.error_invalid_credentials'))
			return
		}

		setIsSuccess(true)
	}

	// No token guard
	if (!token) {
		return (
			<div className="flex flex-col items-center gap-6 text-center">
				<div className="flex size-12 items-center justify-center bg-destructive/[0.08]">
					<ShieldWarningIcon className="size-6 text-destructive" />
				</div>
				<div className="flex flex-col gap-2">
					<h2 className="font-heading text-xl font-semibold">
						{t('auth.reset_password_title')}
					</h2>
					<p className="text-sm text-muted-foreground">
						{t('auth.reset_password_invalid_token')}
					</p>
				</div>
				<Link to="/forgot-password" className="text-xs text-primary hover:underline">
					{t('auth.send_reset_link')}
				</Link>
			</div>
		)
	}

	if (isSuccess) {
		return (
			<div className="flex flex-col items-center gap-6 text-center">
				<div className="flex size-12 items-center justify-center bg-primary/[0.08]">
					<CheckCircleIcon className="size-6 text-primary" />
				</div>
				<div className="flex flex-col gap-2">
					<h2 className="font-heading text-xl font-semibold">
						{t('auth.reset_password_success_title')}
					</h2>
					<p className="text-sm text-muted-foreground">
						{t('auth.reset_password_success_description')}
					</p>
				</div>
				<Link to="/login" className="text-xs text-primary hover:underline">
					{t('auth.sign_in')}
				</Link>
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col gap-1">
				<h2 className="font-heading text-xl font-semibold">
					{t('auth.reset_password_title')}
				</h2>
				<p className="text-sm text-muted-foreground">
					{t('auth.reset_password_description')}
				</p>
			</div>

			<AnimatePresence>
				{error && (
					<m.div
						initial={{ opacity: 0, x: -10 }}
						animate={{ opacity: 1, x: [0, -6, 6, -4, 4, 0] }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.3, x: { type: 'spring', stiffness: 300, damping: 15 } }}
					>
						<Alert variant="destructive">
							<WarningCircleIcon className="size-4" />
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					</m.div>
				)}
			</AnimatePresence>

			<form
				onSubmit={form.handleSubmit(onSubmit)}
				className="flex flex-col gap-4"
				noValidate
			>
				<FieldGroup>
					<Field>
						<FieldLabel
							htmlFor="password"
							className="font-mono text-xs font-medium"
						>
							{t('auth.new_password')}
						</FieldLabel>
						<FieldContent>
							<div className="relative">
								<Input
									id="password"
									type={showPassword ? 'text' : 'password'}
									autoComplete="new-password"
									className="pr-9"
									disabled={form.formState.isSubmitting}
									aria-invalid={!!form.formState.errors.password}
									{...form.register('password')}
									ref={(el) => {
										form.register('password').ref(el)
										passwordInputRef.current = el
									}}
								/>
								<button
									type="button"
									tabIndex={-1}
									className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
									onClick={() => setShowPassword((v) => !v)}
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
							<FieldDescription>{t('auth.password_min_length')}</FieldDescription>
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

					<Field>
						<FieldLabel
							htmlFor="confirmPassword"
							className="font-mono text-xs font-medium"
						>
							{t('auth.confirm_new_password')}
						</FieldLabel>
						<FieldContent>
							<div className="relative">
								<Input
									id="confirmPassword"
									type={showConfirm ? 'text' : 'password'}
									autoComplete="new-password"
									className="pr-9"
									disabled={form.formState.isSubmitting}
									aria-invalid={!!form.formState.errors.confirmPassword}
									{...form.register('confirmPassword', {
										validate: (value) =>
											value === passwordValue || t('auth.password_mismatch'),
									})}
								/>
								<button
									type="button"
									tabIndex={-1}
									className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
									onClick={() => setShowConfirm((v) => !v)}
									aria-label={showConfirm ? t('a11y.hide_password') : t('a11y.show_password')}
								>
									<AnimatePresence mode="wait" initial={false}>
										<m.span
											key={showConfirm ? 'hide' : 'show'}
											initial={{ opacity: 0, rotate: -90 }}
											animate={{ opacity: 1, rotate: 0 }}
											exit={{ opacity: 0, rotate: 90 }}
											transition={{ duration: 0.15 }}
										>
											{showConfirm ? (
												<EyeSlashIcon className="size-4" />
											) : (
												<EyeIcon className="size-4" />
											)}
										</m.span>
									</AnimatePresence>
								</button>
							</div>
							<AnimatePresence>
								{form.formState.errors.confirmPassword && (
									<m.div
										initial={{ opacity: 0, y: -4 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -4 }}
										transition={{ duration: 0.15 }}
									>
										<FieldError>
											{form.formState.errors.confirmPassword.message}
										</FieldError>
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
					disabled={form.formState.isSubmitting}
					loading={form.formState.isSubmitting}
				>
					{form.formState.isSubmitting
						? t('auth.reset_password_submitting')
						: t('auth.reset_password_submit')}
				</Button>
			</form>

			<p className="text-center text-xs text-muted-foreground">
				<Link to="/login" className="text-primary hover:underline">
					{t('auth.back_to_login')}
				</Link>
			</p>
		</div>
	)
}
