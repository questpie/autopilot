import { useForm, FormProvider } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { TrashIcon, PlusIcon } from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FormField, FormSelect, FormSection } from "@/components/forms"
import { inviteSchema, ROLE_OPTIONS, type InviteFormValues } from "./team-types"
import { useTeamInvites } from "./use-team-invites"

export function InviteSection() {
  const { t } = useTranslation()
  const { invites, saveMutation, handleAdd, handleRemove } = useTeamInvites()

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
