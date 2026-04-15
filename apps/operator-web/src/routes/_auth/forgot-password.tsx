import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldContent, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { authClient } from '@/lib/auth'
import { useTranslation } from '@/lib/i18n'
import { CheckCircleIcon, EnvelopeSimpleIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { AnimatePresence, m } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod/v4'

const forgotPasswordSchema = z.object({
	email: z.email('auth.error_invalid_email'),
})

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>

export const Route = createFileRoute('/_auth/forgot-password')({
	component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
	'use no memo'
	const { t } = useTranslation()
	const [isSuccess, setIsSuccess] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const emailInputRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		emailInputRef.current?.focus()
	}, [])

	const form = useForm<ForgotPasswordValues>({
		resolver: (values, _context, _options) => {
			const result = forgotPasswordSchema.safeParse(values)
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
		defaultValues: { email: '' },
	})

	const onSubmit = async (values: ForgotPasswordValues) => {
		setError(null)

		// @ts-expect-error better-auth types don't expose forgetPassword but it exists at runtime
		const result = await authClient.forgetPassword({
			email: values.email,
			redirectTo: '/reset-password',
		})

		if (result.error) {
			setError(result.error.message ?? t('auth.error_invalid_credentials'))
			return
		}

		setIsSuccess(true)
	}

	if (isSuccess) {
		return (
			<div className="flex flex-col items-center gap-6 text-center">
				<div className="flex size-12 items-center justify-center bg-primary/[0.08]">
					<CheckCircleIcon className="size-6 text-primary" />
				</div>
				<div className="flex flex-col gap-2">
					<h2 className="font-heading text-xl font-semibold">
						{t('auth.forgot_password_success_title')}
					</h2>
					<p className="text-sm text-muted-foreground">
						{t('auth.forgot_password_success_description')}
					</p>
				</div>
				<Link to="/login" className="text-xs text-primary hover:underline">
					{t('auth.back_to_login')}
				</Link>
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col gap-1">
				<h2 className="font-heading text-xl font-semibold">
					{t('auth.forgot_password_title')}
				</h2>
				<p className="text-sm text-muted-foreground">
					{t('auth.forgot_password_description')}
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
							htmlFor="email"
							className="font-mono text-xs font-medium"
						>
							{t('auth.email')}
						</FieldLabel>
						<FieldContent>
							<div className="relative">
								<EnvelopeSimpleIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									id="email"
									type="email"
									autoComplete="email"
									placeholder="you@company.com"
									className="pl-8"
									disabled={form.formState.isSubmitting}
									aria-invalid={!!form.formState.errors.email}
									{...form.register('email')}
									ref={(el) => {
										form.register('email').ref(el)
										emailInputRef.current = el
									}}
								/>
							</div>
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
				</FieldGroup>

				<Button
					type="submit"
					size="lg"
					className="w-full"
					disabled={form.formState.isSubmitting}
					loading={form.formState.isSubmitting}
				>
					{form.formState.isSubmitting
						? t('auth.sending_reset_link')
						: t('auth.send_reset_link')}
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
