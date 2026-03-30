import { useCallback } from "react"
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"
import { api } from "@/lib/api"
import { fileContentQuery } from "@/features/files/files.queries"
import {
  parseInvitesYaml,
  serializeInvitesYaml,
  type InviteEntry,
  type InviteFormValues,
} from "./team-types"

export function useTeamInvites() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { enabled: _, ...inviteFileQuery } = fileContentQuery(".auth/invites.yaml")
  const { data: invitesContent } = useSuspenseQuery({
    ...inviteFileQuery,
    queryKey: [...queryKeys.team.detail("invites"), "content"],
  })

  const invites = invitesContent ? parseInvitesYaml(invitesContent) : []

  const saveMutation = useMutation({
    mutationFn: async (newInvites: InviteEntry[]) => {
      const yaml = serializeInvitesYaml(newInvites)
      const res = await api.api.files[":path{.+}"].$put({
        param: { path: ".auth/invites.yaml" },
        json: { content: yaml },
      })
      if (!res.ok) throw new Error("Failed to save invites")
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.team.root })
      void queryClient.invalidateQueries({ queryKey: queryKeys.files.root })
    },
    onError: (err) => toast.error((err as Error).message),
  })

  const handleAdd = useCallback(
    (values: InviteFormValues) => {
      const existing = invites.some((i) => i.email === values.email)
      if (existing) {
        toast.error(t("errors.email_already_in_list"))
        return
      }
      const newList = [...invites, { email: values.email, role: values.role }]
      saveMutation.mutate(newList, {
        onSuccess: () => toast.success(t("settings.team_invite_added")),
      })
    },
    [invites, saveMutation, t],
  )

  const handleRemove = useCallback(
    (email: string) => {
      const newList = invites.filter((i) => i.email !== email)
      saveMutation.mutate(newList, {
        onSuccess: () => toast.success(t("settings.team_invite_removed")),
      })
    },
    [invites, saveMutation, t],
  )

  return { invites, saveMutation, handleAdd, handleRemove }
}
