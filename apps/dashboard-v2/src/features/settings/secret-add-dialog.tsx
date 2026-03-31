import { FormField, FormSelect } from '@/components/forms'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { agentsQuery } from '@/features/team/team.queries'
import { api } from '@/lib/api'
import { useTranslation } from '@/lib/i18n'
import { queryKeys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import { zodResolver } from '@hookform/resolvers/zod'
import { EyeIcon, EyeSlashIcon, PlusIcon } from '@phosphor-icons/react'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { AnimatePresence, m } from 'framer-motion'
import { useState } from 'react'
import { Controller, FormProvider, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

const SECRET_TYPES = [
	{ value: 'api_token', label: 'API Token' },
	{ value: 'oauth', label: 'OAuth' },
	{ value: 'webhook', label: 'Webhook' },
	{ value: 'other', label: 'Other' },
]

const secretSchema = z.object({
	name: z
		.string()
		.min(1, 'Name is required')
		.regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, and hyphens only'),
	value: z.string().min(1, 'Value is required'),
	type: z.enum(['api_token', 'oauth', 'webhook', 'other']),
	agents: z.array(z.string()),
})

type SecretFormValues = z.infer<typeof secretSchema>

interface SecretAddDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
}

/**
 * Dialog for adding a new secret.
 * Collects name, value, type, and allowed agents.
 */
export function SecretAddDialog({ open, onOpenChange }: SecretAddDialogProps) {
	const { t } = useTranslation()
	const queryClient = useQueryClient()
	const [showValue, setShowValue] = useState(false)

	const { data: agents } = useSuspenseQuery(agentsQuery)

	const methods = useForm<SecretFormValues>({
		resolver: zodResolver(secretSchema),
		defaultValues: {
			name: '',
			value: '',
			type: 'api_token',
			agents: [],
		},
	})

	const saveMutation = useMutation({
		mutationFn: async (values: SecretFormValues) => {
			const res = await api.api.settings.secrets.$post({
				json: {
					name: values.name,
					value: values.value,
					type: values.type,
					allowed_agents: values.agents,
					usage: '',
				},
			})
			if (!res.ok) throw new Error('Failed to create secret')
		},
		onSuccess: () => {
			toast.success(t('settings.secret_added'))
			void queryClient.invalidateQueries({ queryKey: queryKeys.secrets.root })
			methods.reset()
			onOpenChange(false)
		},
		onError: (err) => toast.error((err as Error).message),
	})

	const agentList = agents ?? []

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="rounded-none sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="font-heading text-sm">{t('settings.secret_add')}</DialogTitle>
				</DialogHeader>

				<FormProvider {...methods}>
					<form
						onSubmit={methods.handleSubmit((v) => saveMutation.mutate(v))}
						className="flex flex-col gap-4"
					>
						<FormField name="name" label={t('settings.secret_name')} />

						{/* Value with visibility toggle */}
						<Controller
							control={methods.control}
							name="value"
							render={({ field, fieldState }) => (
								<div className="flex flex-col gap-1.5">
									<label className="font-heading text-xs font-medium text-foreground">
										{t('settings.secret_value')}
									</label>
									<div className="relative">
										<input
											{...field}
											type={showValue ? 'text' : 'password'}
											className={cn(
												'flex h-9 w-full rounded-none border border-input bg-transparent px-3 pr-8 py-1 text-sm transition-colors',
												'placeholder:text-muted-foreground',
												'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
												fieldState.error && 'border-destructive',
											)}
										/>
										<button
											type="button"
											onClick={() => setShowValue(!showValue)}
											className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
										>
											<AnimatePresence mode="wait" initial={false}>
												<m.span
													key={showValue ? 'hide' : 'show'}
													initial={{ opacity: 0, rotate: -90 }}
													animate={{ opacity: 1, rotate: 0 }}
													exit={{ opacity: 0, rotate: 90 }}
													transition={{ duration: 0.15 }}
												>
													{showValue ? <EyeSlashIcon size={14} /> : <EyeIcon size={14} />}
												</m.span>
											</AnimatePresence>
										</button>
									</div>
									<AnimatePresence>
										{fieldState.error && (
											<m.p
												initial={{ opacity: 0, y: -4 }}
												animate={{ opacity: 1, y: 0 }}
												exit={{ opacity: 0, y: -4 }}
												transition={{ duration: 0.15 }}
												className="text-xs text-destructive"
											>
												{fieldState.error.message}
											</m.p>
										)}
									</AnimatePresence>
								</div>
							)}
						/>

						<FormSelect name="type" label={t('settings.secret_type')} options={SECRET_TYPES} />

						{/* Agent checkboxes */}
						<Controller
							control={methods.control}
							name="agents"
							render={({ field }) => (
								<div className="flex flex-col gap-1.5">
									<label className="font-heading text-xs font-medium text-foreground">
										{t('settings.secret_allowed_agents')}
									</label>
									<div className="flex flex-wrap gap-3">
										{agentList.map((agent) => (
											<div key={agent.id} className="flex items-center gap-1.5">
												<Checkbox
													checked={field.value.includes(agent.id)}
													onCheckedChange={(checked) => {
														if (checked) {
															field.onChange([...field.value, agent.id])
														} else {
															field.onChange(field.value.filter((a: string) => a !== agent.id))
														}
													}}
													id={`agent-${agent.id}`}
												/>
												<Label htmlFor={`agent-${agent.id}`} className="text-xs">
													{agent.name ?? agent.id}
												</Label>
											</div>
										))}
									</div>
								</div>
							)}
						/>

						<DialogFooter>
							<Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
								{t('common.cancel')}
							</Button>
							<Button type="submit" size="sm" disabled={saveMutation.isPending} className="gap-1.5">
								<PlusIcon size={14} />
								{t('settings.secret_add')}
							</Button>
						</DialogFooter>
					</form>
				</FormProvider>
			</DialogContent>
		</Dialog>
	)
}
