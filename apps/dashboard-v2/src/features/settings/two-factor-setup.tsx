import { useState, useRef, useCallback } from "react"
import {
  ShieldCheckIcon,
  ShieldSlashIcon,
  CopyIcon,
  DownloadSimpleIcon,
  ArrowsClockwiseIcon,
  TrashIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"
import { authClient } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { FormSection } from "@/components/forms"

type Phase = "status" | "password" | "qr" | "verify" | "backup"

/**
 * Two-factor authentication settings.
 * Shows current status, enable/disable flow, backup codes, trusted devices.
 */
export function TwoFactorSetup() {
  const { t } = useTranslation()
  const { data: session } = authClient.useSession()
  const is2FAEnabled = session?.user?.twoFactorEnabled ?? false

  const [phase, setPhase] = useState<Phase>("status")
  const [password, setPassword] = useState("")
  const [totpURI, setTotpURI] = useState<string | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""])
  const [savedBackup, setSavedBackup] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const handleEnable = useCallback(async () => {
    if (!password) return
    setIsLoading(true)
    setError(null)

    const result = await authClient.twoFactor.enable({ password })
    setIsLoading(false)

    if (result.error) {
      setError(result.error.message ?? t("errors.failed_enable_2fa"))
      return
    }

    if (result.data) {
      setTotpURI(result.data.totpURI ?? null)
      setBackupCodes(result.data.backupCodes ?? [])
      setPhase("qr")
    }
  }, [password])

  const handleDisable = useCallback(async () => {
    if (!password) return
    setIsLoading(true)
    setError(null)

    const result = await authClient.twoFactor.disable({ password })
    setIsLoading(false)

    if (result.error) {
      setError(result.error.message ?? t("errors.failed_disable_2fa"))
      return
    }

    toast.success(t("settings.tfa_disabled_success"))
    setPhase("status")
    setPassword("")
  }, [password, t])

  const handleDigitChange = useCallback(
    (index: number, value: string) => {
      if (!/^\d*$/.test(value)) return
      const newDigits = [...digits]
      newDigits[index] = value.slice(-1)
      setDigits(newDigits)
      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus()
      }
    },
    [digits],
  )

  const handleDigitKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && !digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus()
      }
    },
    [digits],
  )

  const handleDigitPaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault()
      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)
      if (!pasted.length) return
      const newDigits = [...digits]
      for (let i = 0; i < pasted.length; i++) newDigits[i] = pasted[i]
      setDigits(newDigits)
      if (pasted.length < 6) inputRefs.current[pasted.length]?.focus()
    },
    [digits],
  )

  const handleVerify = useCallback(async () => {
    const code = digits.join("")
    if (code.length !== 6) return

    setIsLoading(true)
    setError(null)

    const result = await authClient.twoFactor.verifyTotp({ code })
    setIsLoading(false)

    if (result.error) {
      setError(result.error.message ?? t("auth.error_2fa_invalid"))
      setDigits(["", "", "", "", "", ""])
      inputRefs.current[0]?.focus()
      return
    }

    setPhase("backup")
  }, [digits, t])

  const handleCopyAll = useCallback(() => {
    void navigator.clipboard.writeText(backupCodes.join("\n"))
    toast.success(t("common.copied"))
  }, [backupCodes, t])

  const handleDownload = useCallback(() => {
    const blob = new Blob([backupCodes.join("\n")], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "questpie-backup-codes.txt"
    a.click()
    URL.revokeObjectURL(url)
  }, [backupCodes])

  const manualKey = totpURI
    ? new URLSearchParams(totpURI.split("?")[1] ?? "").get("secret")
    : null

  // Status view
  if (phase === "status") {
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
                  onClick={() => {
                    setPhase("password")
                    setPassword("")
                    setError(null)
                  }}
                >
                  {t("settings.tfa_reconfigure")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    setPhase("password")
                    setPassword("")
                    setError(null)
                  }}
                >
                  {t("settings.tfa_disable")}
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={() => {
                  setPhase("password")
                  setPassword("")
                  setError(null)
                }}
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

  // Password confirmation
  if (phase === "password") {
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
            onChange={(e) => setPassword(e.currentTarget.value)}
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (is2FAEnabled) {
                  void handleDisable()
                } else {
                  void handleEnable()
                }
              }
            }}
          />
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPhase("status")}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!password || isLoading}
            onClick={() => {
              if (is2FAEnabled) {
                void handleDisable()
              } else {
                void handleEnable()
              }
            }}
          >
            {isLoading ? <Spinner size="sm" /> : t("common.continue")}
          </Button>
        </div>
      </div>
    )
  }

  // QR code display
  if (phase === "qr") {
    return (
      <div className="flex max-w-lg flex-col gap-4">
        {totpURI && (
          <div className="flex flex-col items-center gap-3">
            <div className="border border-border bg-white p-3">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(totpURI)}`}
                alt="2FA QR Code"
                width={180}
                height={180}
                className="block"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("setup.step_2_scan_qr")}
            </p>
          </div>
        )}

        {manualKey && (
          <div className="flex items-center justify-center gap-2">
            <code className="border border-border bg-muted px-2 py-1 font-heading text-xs">
              {manualKey}
            </code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(manualKey)
                toast.success(t("common.copied"))
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <CopyIcon className="size-3.5" />
            </button>
          </div>
        )}

        <Button
          type="button"
          size="sm"
          onClick={() => setPhase("verify")}
        >
          {t("common.continue")}
        </Button>
      </div>
    )
  }

  // Verify TOTP code
  if (phase === "verify") {
    return (
      <div className="flex max-w-lg flex-col gap-4">
        {error && (
          <Alert variant="destructive">
            <WarningCircleIcon className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-3">
          <Label className="font-heading text-xs font-medium">
            {t("setup.step_2_enter_code")}
          </Label>
          <div className="flex justify-center gap-2" onPaste={handleDigitPaste}>
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputRefs.current[i] = el
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                autoFocus={i === 0}
                disabled={isLoading}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleDigitKeyDown(i, e)}
                className="flex size-10 items-center justify-center border border-input bg-transparent text-center font-heading text-lg outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring/50 disabled:opacity-50"
                aria-label={t("a11y.digit_n", { n: i + 1 })}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setPhase("qr")}>
            {t("common.back")}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={digits.join("").length !== 6 || isLoading}
            onClick={() => void handleVerify()}
          >
            {isLoading ? <Spinner size="sm" /> : t("auth.verify")}
          </Button>
        </div>
      </div>
    )
  }

  // Backup codes
  return (
    <div className="flex max-w-lg flex-col gap-4">
      <Alert>
        <WarningCircleIcon className="size-4" />
        <AlertDescription>
          {t("setup.step_2_backup_warning")}
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-2 gap-2">
        {backupCodes.map((code, i) => (
          <code
            key={i}
            className="border border-border bg-muted px-2 py-1.5 text-center font-heading text-xs"
          >
            {code}
          </code>
        ))}
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleCopyAll}>
          <CopyIcon className="mr-1 size-3.5" />
          {t("setup.step_2_copy_all")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleDownload}>
          <DownloadSimpleIcon className="mr-1 size-3.5" />
          {t("setup.step_2_download")}
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          checked={savedBackup}
          onCheckedChange={(checked) => setSavedBackup(checked === true)}
          id="backup-saved-settings"
        />
        <Label htmlFor="backup-saved-settings" className="text-xs">
          {t("setup.step_2_backup_saved")}
        </Label>
      </div>

      <Button
        type="button"
        size="sm"
        disabled={!savedBackup}
        onClick={() => {
          setPhase("status")
          toast.success(t("settings.saved"))
        }}
      >
        {t("common.finish")}
      </Button>
    </div>
  )
}
