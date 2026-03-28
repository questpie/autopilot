import { WarningCircleIcon } from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"

interface PasswordConfirmProps {
  is2FAEnabled: boolean
  password: string
  error: string | null
  isLoading: boolean
  onPasswordChange: (value: string) => void
  onSubmit: () => void
  onCancel: () => void
}

export function PasswordConfirm({
  is2FAEnabled,
  password,
  error,
  isLoading,
  onPasswordChange,
  onSubmit,
  onCancel,
}: PasswordConfirmProps) {
  const { t } = useTranslation()

  return (
    <div className="flex max-w-lg flex-col gap-4">
      {error && (
        <Alert variant="destructive">
          <WarningCircleIcon className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <p className="text-sm text-muted-foreground">
        {is2FAEnabled ? t("settings.tfa_disable_confirm") : t("settings.tfa_enable_confirm")}
      </p>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="2fa-password" className="font-heading text-xs font-medium">
          {t("auth.password")}
        </Label>
        <Input
          id="2fa-password"
          type="password"
          autoFocus
          value={password}
          onChange={(e) => onPasswordChange(e.currentTarget.value)}
          disabled={isLoading}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSubmit()
            }
          }}
        />
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
        >
          {t("common.cancel")}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!password || isLoading}
          onClick={onSubmit}
        >
          {isLoading ? <Spinner size="sm" /> : t("common.continue")}
        </Button>
      </div>
    </div>
  )
}
