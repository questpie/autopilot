import { createFileRoute, Link } from "@tanstack/react-router"
import {
  ShieldCheckIcon,
  KeyIcon,
  ArrowRightIcon,
} from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { authClient } from "@/lib/auth"
import { Badge } from "@/components/ui/badge"
import { SettingsPageHeader } from "@/features/settings/settings-page-header"

export const Route = createFileRoute("/_app/settings/security/")({
  component: SettingsSecurityPage,
})

function SettingsSecurityPage() {
  const { t } = useTranslation()
  const { data: session } = authClient.useSession()
  const is2FA = session?.user?.twoFactorEnabled ?? false

  return (
    <div className="flex flex-1 flex-col">
      <SettingsPageHeader
        title={t("settings.security")}
        description={t("settings.security_description")}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex max-w-lg flex-col gap-4">
          {/* 2FA link */}
          <Link
            to="/settings/security/2fa"
            className="flex items-center justify-between border border-border p-4 transition-colors hover:bg-muted/30"
          >
            <div className="flex items-center gap-3">
              <ShieldCheckIcon size={20} className="text-primary" />
              <div className="flex flex-col gap-0.5">
                <span className="font-heading text-sm font-medium">
                  {t("settings.two_factor")}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {t("settings.security_2fa_link")}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {is2FA ? (
                <Badge variant="secondary" className="rounded-none text-[10px] text-success">
                  {t("settings.tfa_enabled")}
                </Badge>
              ) : (
                <Badge variant="outline" className="rounded-none text-[10px] text-muted-foreground">
                  {t("settings.tfa_disabled")}
                </Badge>
              )}
              <ArrowRightIcon size={14} className="text-muted-foreground" />
            </div>
          </Link>

          {/* Secrets link */}
          <Link
            to="/settings/security/secrets"
            className="flex items-center justify-between border border-border p-4 transition-colors hover:bg-muted/30"
          >
            <div className="flex items-center gap-3">
              <KeyIcon size={20} className="text-primary" />
              <div className="flex flex-col gap-0.5">
                <span className="font-heading text-sm font-medium">
                  {t("settings.secrets")}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {t("settings.security_secrets_link")}
                </span>
              </div>
            </div>
            <ArrowRightIcon size={14} className="text-muted-foreground" />
          </Link>
        </div>
      </div>
    </div>
  )
}
