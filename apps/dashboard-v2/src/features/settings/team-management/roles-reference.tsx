import { useTranslation } from "@/lib/i18n"
import { Badge } from "@/components/ui/badge"
import { FormSection } from "@/components/forms"

export function RolesReference() {
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
