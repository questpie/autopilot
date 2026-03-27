import { useCallback } from "react"
import { useForm, FormProvider } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  UserCircleIcon,
  ShieldCheckIcon,
  ShieldSlashIcon,
  TrashIcon,
  PlusIcon,
  ProhibitIcon,
  CheckCircleIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
// Dialog imports available if needed for confirmation flows
import { FormField, FormSelect, FormSection } from "@/components/forms"
import { fileContentQuery } from "@/features/files/files.queries"
import { api, API_BASE } from "@/lib/api"

const ROLES = ["owner", "admin", "member", "viewer"] as const
type Role = (typeof ROLES)[number]

const ROLE_OPTIONS = ROLES.map((r) => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) }))

interface InviteEntry {
  email: string
  role: Role
}

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  banned: boolean
  twoFactorEnabled: boolean
}

const inviteSchema = z.object({
  email: z.string().email("Valid email required"),
  role: z.enum(ROLES),
})

type InviteFormValues = z.infer<typeof inviteSchema>

function parseInvitesYaml(content: string): InviteEntry[] {
  const invites: InviteEntry[] = []
  const lines = content.split("\n")
  let currentEmail = ""

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith("- email:")) {
      currentEmail = trimmed.slice(8).trim().replace(/['"]/g, "")
    } else if (trimmed.startsWith("role:") && currentEmail) {
      const role = trimmed.slice(5).trim().replace(/['"]/g, "") as Role
      invites.push({ email: currentEmail, role })
      currentEmail = ""
    }
  }

  return invites
}

function serializeInvitesYaml(invites: InviteEntry[]): string {
  if (invites.length === 0) return "invites: []\n"
  const lines = ["invites:"]
  for (const inv of invites) {
    lines.push(`  - email: ${inv.email}`)
    lines.push(`    role: ${inv.role}`)
  }
  return lines.join("\n") + "\n"
}

/**
 * Team management: members list, invite list, roles, ban/unban.
 */
export function TeamManagement() {
  return (
    <div className="flex flex-col gap-8">
      <MembersList />
      <InviteSection />
      <RolesReference />
    </div>
  )
}

function MembersList() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data: members, isLoading } = useQuery({
    queryKey: queryKeys.team.list(),
    queryFn: async (): Promise<TeamMember[]> => {
      const res = await fetch(`${API_BASE}/api/auth/admin/list-users`, { credentials: "include" })
      if (!res.ok) return []
      const data = (await res.json()) as { users?: TeamMember[] }
      return data.users ?? []
    },
    staleTime: 30_000,
  })

  const banMutation = useMutation({
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

  const roleMutation = useMutation({
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

  if (isLoading) {
    return (
      <FormSection title={t("settings.team_members")}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </FormSection>
    )
  }

  const active = members?.filter((m) => !m.banned) ?? []
  const banned = members?.filter((m) => m.banned) ?? []

  return (
    <>
      <FormSection title={`${t("settings.team_members")} (${active.length})`}>
        {active.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("common.empty")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {active.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between border border-border p-3"
              >
                <div className="flex items-center gap-3">
                  <UserCircleIcon size={24} className="shrink-0 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="font-heading text-xs font-medium">{member.name}</span>
                    <span className="text-[10px] text-muted-foreground">{member.email}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="rounded-none text-[10px]">
                    {member.role || "member"}
                  </Badge>
                  {member.twoFactorEnabled ? (
                    <Badge variant="secondary" className="gap-1 rounded-none text-[10px]">
                      <ShieldCheckIcon size={10} />
                      {t("settings.team_2fa_enabled")}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 rounded-none text-[10px] text-muted-foreground">
                      <ShieldSlashIcon size={10} />
                      {t("settings.team_2fa_disabled")}
                    </Badge>
                  )}
                  <select
                    value={member.role || "member"}
                    onChange={(e) => roleMutation.mutate({ userId: member.id, role: e.target.value })}
                    className="h-7 border border-input bg-transparent px-2 font-heading text-[10px]"
                    disabled={roleMutation.isPending}
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-[10px] text-muted-foreground hover:text-destructive"
                    onClick={() => banMutation.mutate({ userId: member.id, ban: true })}
                    disabled={banMutation.isPending}
                  >
                    <ProhibitIcon size={12} />
                    {t("settings.team_ban")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </FormSection>

      <FormSection title={t("settings.team_banned")}>
        {banned.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("settings.team_no_banned")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {banned.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between border border-border p-3 opacity-60"
              >
                <div className="flex items-center gap-3">
                  <UserCircleIcon size={24} className="shrink-0 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="font-heading text-xs">{member.name}</span>
                    <span className="text-[10px] text-muted-foreground">{member.email}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-[10px]"
                  onClick={() => banMutation.mutate({ userId: member.id, ban: false })}
                  disabled={banMutation.isPending}
                >
                  <CheckCircleIcon size={12} />
                  {t("settings.team_unban")}
                </Button>
              </div>
            ))}
          </div>
        )}
      </FormSection>
    </>
  )
}

function InviteSection() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data: invitesContent } = useQuery({
    ...fileContentQuery(".auth/invites.yaml"),
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

  const methods = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", role: "member" },
  })

  return (
    <>
      <FormSection title={t("settings.team_invited")}>
        {invites.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("settings.team_no_invites")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {invites.map((inv) => (
              <div
                key={inv.email}
                className="flex items-center justify-between border border-border p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="font-heading text-xs">{inv.email}</span>
                  <Badge variant="outline" className="rounded-none text-[10px]">{inv.role}</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-[10px] text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemove(inv.email)}
                  disabled={saveMutation.isPending}
                >
                  <TrashIcon size={12} />
                  {t("settings.team_remove_invite")}
                </Button>
              </div>
            ))}
          </div>
        )}
      </FormSection>

      <FormSection
        title={t("settings.team_invite")}
        description={t("settings.team_invite_hint")}
      >
        <FormProvider {...methods}>
          <form
            onSubmit={methods.handleSubmit((v) => {
              handleAdd(v)
              methods.reset()
            })}
            className="flex flex-col gap-3"
          >
            <div className="flex gap-3">
              <div className="flex-1">
                <FormField name="email" label={t("settings.team_invite_email")} type="email" />
              </div>
              <div className="w-32">
                <FormSelect name="role" label={t("settings.team_invite_role")} options={ROLE_OPTIONS} />
              </div>
            </div>
            <div>
              <Button
                type="submit"
                size="sm"
                disabled={saveMutation.isPending}
                className="gap-1.5"
              >
                <PlusIcon size={14} />
                {t("settings.team_invite")}
              </Button>
            </div>
          </form>
        </FormProvider>
      </FormSection>
    </>
  )
}

function RolesReference() {
  const { t } = useTranslation()

  const roles = [
    { key: "owner", label: t("settings.team_role_owner"), desc: t("settings.team_role_owner_desc") },
    { key: "admin", label: t("settings.team_role_admin"), desc: t("settings.team_role_admin_desc") },
    { key: "member", label: t("settings.team_role_member"), desc: t("settings.team_role_member_desc") },
    { key: "viewer", label: t("settings.team_role_viewer"), desc: t("settings.team_role_viewer_desc") },
  ]

  return (
    <FormSection title={t("settings.team_roles")}>
      <div className="flex flex-col gap-1">
        {roles.map((role) => (
          <div key={role.key} className="flex items-baseline gap-3 py-1">
            <Badge variant="outline" className="w-16 justify-center rounded-none text-[10px]">
              {role.label}
            </Badge>
            <span className="text-xs text-muted-foreground">{role.desc}</span>
          </div>
        ))}
      </div>
    </FormSection>
  )
}
