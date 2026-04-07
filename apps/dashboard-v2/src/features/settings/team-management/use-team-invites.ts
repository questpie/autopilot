import { api } from '@/lib/api'
import { useTranslation } from '@/lib/i18n'
import { queryKeys } from '@/lib/query-keys'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { toast } from 'sonner'
import type { InviteEntry, InviteFormValues } from './team-types'

function invitesQuery() {
	return {
		queryKey: [...queryKeys.team.detail('invites'), 'records'],
		queryFn: async () => {
			const res = await api.api.team.humans.invite.$get()
			if (!res.ok) throw new Error('Failed to load invites')
			return res.json() as Promise<InviteEntry[]>
		},
	}
}

interface CreateInviteResult {
	ok: true
	invite: InviteEntry
}

export function useTeamInvites() {
	const { t } = useTranslation()
	const queryClient = useQueryClient()

	const { data: invites } = useSuspenseQuery(invitesQuery())

	const saveMutation = useMutation({
		mutationFn: async (values: InviteFormValues) => {
			const res = await api.api.team.humans.invite.$post({
				json: values,
			})
			if (!res.ok) throw new Error('Failed to create invite')
			return res.json() as Promise<CreateInviteResult>
		},
		onSuccess: async (result) => {
			void queryClient.invalidateQueries({ queryKey: queryKeys.team.root })
			const inviteUrl = result.invite?.inviteUrl
			if (inviteUrl) {
				await navigator.clipboard.writeText(inviteUrl)
				toast.success(t('settings.team_invite_added'), {
					description: 'Invite link copied to clipboard.',
				})
			} else {
				toast.success(t('settings.team_invite_added'))
			}
		},
		onError: (err) => toast.error((err as Error).message),
	})

	const deleteMutation = useMutation({
		mutationFn: async (email: string) => {
			const res = await api.api.team.humans.invite.$delete({
				json: { email },
			})
			if (!res.ok) throw new Error('Failed to remove invite')
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: queryKeys.team.root })
			toast.success(t('settings.team_invite_removed'))
		},
		onError: (err) => toast.error((err as Error).message),
	})

	const handleAdd = useCallback(
		(values: InviteFormValues) => {
			const existing = invites.some((i) => i.email === values.email)
			if (existing) {
				toast.error(t('errors.email_already_in_list'))
				return
			}
			saveMutation.mutate(values)
		},
		[invites, saveMutation, t],
	)

	const handleRemove = useCallback(
		(email: string) => {
			deleteMutation.mutate(email)
		},
		[deleteMutation],
	)

	return { invites, saveMutation, deleteMutation, handleAdd, handleRemove }
}
