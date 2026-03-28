import {
  UserCircleIcon,
  ShieldCheckIcon,
  ShieldSlashIcon,
  ProhibitIcon,
  CheckCircleIcon,
} from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { FormSection } from "@/components/forms"
import { ROLE_OPTIONS } from "./team-types"
import { useTeamMembers, useBanMutation, useRoleMutation } from "./use-team-members"

export function MembersList() {
  const { t } = useTranslation()
  const { data: members, isLoading } = useTeamMembers()
  const banMutation = useBanMutation()
  const roleMutation = useRoleMutation()

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
