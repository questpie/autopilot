import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"
import { API_BASE } from "@/lib/api"
import type { TeamMember } from "./team-types"

export function useTeamMembers() {
  return useQuery({
    queryKey: queryKeys.team.list(),
    queryFn: async (): Promise<TeamMember[]> => {
      const res = await fetch(`${API_BASE}/api/auth/admin/list-users`, { credentials: "include" })
      if (!res.ok) return []
      const data = (await res.json()) as { users?: TeamMember[] }
      return data.users ?? []
    },
    staleTime: 30_000,
  })
}

export function useBanMutation() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, ban }: { userId: string; ban: boolean }) => {
      const endpoint = ban ? "ban-user" : "unban-user"
      const res = await fetch(`${API_BASE}/api/auth/admin/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) throw new Error(`Failed to ${ban ? "ban" : "unban"} user`)
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
      const res = await fetch(`${API_BASE}/api/auth/admin/set-role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId, role }),
      })
      if (!res.ok) throw new Error("Failed to change role")
    },
    onSuccess: () => {
      toast.success(t("settings.team_role_changed"))
      void queryClient.invalidateQueries({ queryKey: queryKeys.team.root })
    },
    onError: (err) => toast.error((err as Error).message),
  })
}
