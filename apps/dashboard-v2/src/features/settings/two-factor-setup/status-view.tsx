import {
  ShieldCheckIcon,
  ShieldSlashIcon,
  ArrowsClockwiseIcon,
  TrashIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FormSection } from "@/components/forms"

interface StatusViewProps {
  is2FAEnabled: boolean
  onGoToPassword: () => void
}

export function StatusView({ is2FAEnabled, onGoToPassword }: StatusViewProps) {
  const { t } = useTranslation()

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <FormSection title={t("auth.two_factor_title")}>
        <div className="flex items-center gap-3">
          {is2FAEnabled ? (
            <Badge variant="secondary" className="gap-1.5 rounded-none text-xs text-green-400">
              <ShieldCheckIcon size={14} />
              {t("settings.tfa_enabled")}
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1.5 rounded-none text-xs text-muted-foreground">
              <ShieldSlashIcon size={14} />
              {t("settings.tfa_disabled")}
            </Badge>
          )}
        </div>

        {is2FAEnabled && (
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span>{t("settings.tfa_method")}: {t("settings.tfa_method_totp")}</span>
            <span>{t("settings.tfa_issuer")}: {t("settings.tfa_issuer_value")}</span>
          </div>
        )}

        <div className="flex gap-2">
          {is2FAEnabled ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onGoToPassword}
              >
                {t("settings.tfa_reconfigure")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={onGoToPassword}
              >
                {t("settings.tfa_disable")}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={onGoToPassword}
            >
              {t("settings.tfa_enable")}
            </Button>
          )}
        </div>
      </FormSection>

      {is2FAEnabled && (
        <>
          <FormSection title={t("settings.tfa_backup_codes")}>
            <p className="text-xs text-muted-foreground">
              {t("settings.tfa_backup_single_use")}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                {t("settings.tfa_view_backup")}
              </Button>
              <Button variant="outline" size="sm">
                <ArrowsClockwiseIcon size={14} className="mr-1" />
                {t("settings.tfa_regenerate_backup")}
              </Button>
            </div>
          </FormSection>

          <FormSection title={t("settings.tfa_trusted_devices")}>
            <p className="text-xs text-muted-foreground">
              {t("settings.tfa_trusted_desc")}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => toast.success(t("settings.tfa_revoked_success"))}
            >
              <TrashIcon size={14} className="mr-1" />
              {t("settings.tfa_revoke_all")}
            </Button>
          </FormSection>
        </>
      )}
    </div>
  )
}
