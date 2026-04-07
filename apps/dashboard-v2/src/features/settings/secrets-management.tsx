import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { useTranslation } from '@/lib/i18n'
import { queryKeys } from '@/lib/query-keys'
import { InfoIcon, KeyIcon, TrashIcon } from '@phosphor-icons/react'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { SecretAddDialog } from './secret-add-dialog'

interface SecretEntry {
	name: string
	service: string
	type: string
	allowed_agents: string[]
	created_at: string
	created_by: string
	usage: string
	encrypted: boolean
	hasValue: boolean
}

/**
 * Secrets management — list, add, delete.
 * Values are never displayed.
 */
export function SecretsManagement() {
	const { t } = useTranslation()
	const queryClient = useQueryClient()
	const [addDialogOpen, setAddDialogOpen] = useState(false)

	const { data: secrets } = useSuspenseQuery({
		queryKey: queryKeys.secrets.list(),
		queryFn: async (): Promise<SecretEntry[]> => {
			const res = await api.api.settings.secrets.$get()
			if (!res.ok) throw new Error('Failed to load secrets')
			return res.json() as Promise<SecretEntry[]>
		},
		staleTime: 30_000,
	})

	const deleteMutation = useMutation({
		mutationFn: async (secretName: string) => {
			const res = await api.api.settings.secrets[':name'].$delete({
				param: { name: secretName },
			})
			if (!res.ok) throw new Error('Failed to delete secret')
		},
		onSuccess: () => {
			toast.success(t('settings.secret_deleted'))
			void queryClient.invalidateQueries({ queryKey: queryKeys.secrets.root })
		},
		onError: (err) => toast.error((err as Error).message),
	})

	const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col gap-2">
				{secrets.length === 0 ? (
					<p className="text-xs text-muted-foreground">{t('common.empty')}</p>
				) : (
					secrets.map((secret) => (
						<div key={secret.name} className="flex flex-col gap-2 border border-border p-4">
							<div className="flex items-start justify-between">
								<div className="flex items-center gap-2">
									<KeyIcon size={16} className="text-primary" />
									<span className="font-heading text-sm font-medium">{secret.name}</span>
								</div>
								<div className="flex items-center gap-1">
									<Button
										variant="ghost"
										size="sm"
										className="h-7 gap-1 text-[10px] text-muted-foreground hover:text-destructive"
										onClick={() => {
											if (deleteConfirm === secret.name) {
												deleteMutation.mutate(secret.name)
												setDeleteConfirm(null)
											} else {
												setDeleteConfirm(secret.name)
											}
										}}
									>
										<TrashIcon size={12} />
										{deleteConfirm === secret.name
											? t('common.confirm')
											: t('settings.secret_delete')}
									</Button>
								</div>
							</div>
							<div className="flex flex-wrap items-center gap-2">
								<Badge variant="outline" className="rounded-none text-[10px]">
									{secret.type}
								</Badge>
								{secret.allowed_agents.length > 0 && (
									<span className="text-[10px] text-muted-foreground">
										{secret.allowed_agents.join(', ')}
									</span>
								)}
								{secret.created_at && (
									<span className="text-[10px] text-muted-foreground">{secret.created_at}</span>
								)}
							</div>
						</div>
					))
				)}
			</div>

			{/* Encryption notice */}
			<div className="flex items-start gap-2 border border-border bg-muted/20 p-3">
				<InfoIcon size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
				<p className="text-[10px] text-muted-foreground">{t('settings.secret_encrypted_notice')}</p>
			</div>

			<SecretAddDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
		</div>
	)
}
