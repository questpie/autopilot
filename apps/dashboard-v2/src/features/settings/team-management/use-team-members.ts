import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"
import { authClient } from "@/lib/auth"
import type { TeamMember } from "./team-types"

export function useTeamMembers() {
  return useSuspenseQuery({
    queryKey: queryKeys.team.list(),
    queryFn: async (): Promise<TeamMember[]> => {
      const { data, error } = await authClient.admin.listUsers({
        query: { limit: 100 },
      })
      if (error) return []
      return (data?.users as TeamMember[] | undefined) ?? []
    },
    staleTime: 30_000,
  })
}

export function useBanMutation() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, ban }: { userId: string; ban: boolean }) => {
      const result = ban
        ? await authClient.admin.banUser({ userId })
        : await authClient.admin.unbanUser({ userId })
      if (result.error) throw new Error(`Failed to ${ban ? "ban" : "unban"} user`)
    },
    onSuccess: (_, vars) => {
      toast.success(vars.ban ? t("settings.team_user_banned") : t("settings.team_user_unbanned"))
      void queryClient.invalidateQueries({ queryKey: queryKeys.team.root })
    },
    onError: (err) => toast.error((err as Error).message),
  })
}

export function useRoleMutation() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await authClient.admin.setRole({ userId, role })
      if (error) throw new Error("Failed to change role")
    },
    onSuccess: () => {
      toast.success(t("settings.team_role_changed"))
      void queryClient.invalidateQueries({ queryKey: queryKeys.team.root })
    },
    onError: (err) => toast.error((err as Error).message),
  })
}
