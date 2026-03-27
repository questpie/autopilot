import { useTranslation } from "@/lib/i18n"
import { authClient } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import {
  WarningCircleIcon,
  CopyIcon,
  DownloadSimpleIcon,
  ArrowLeftIcon,
} from "@phosphor-icons/react"
import { useState, useRef, useCallback } from "react"
import { useWizardState } from "./use-wizard-state"
import { toast } from "sonner"

interface WizardStep2Props {
  onComplete: () => void
  onBack: () => void
}

export function WizardStep2({ onComplete, onBack }: WizardStep2Props) {
  const { t } = useTranslation()
  const { completeStep } = useWizardState()

  // Phase: "password" -> "qr" -> "verify" -> "backup"
  const [phase, setPhase] = useState<"password" | "qr" | "verify" | "backup">("password")
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
    [digits]
  )

  const handleDigitKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && !digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus()
      }
    },
    [digits]
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
    [digits]
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

  const handleComplete = useCallback(() => {
    completeStep(2)
    onComplete()
  }, [completeStep, onComplete])

  // Extract manual key from TOTP URI
  const manualKey = totpURI
    ? new URLSearchParams(totpURI.split("?")[1] ?? "").get("secret")
    : null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-heading text-lg font-semibold">
          {t("setup.step_2_title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("setup.step_2_description")}
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <WarningCircleIcon className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {phase === "password" && (
        <>
          <p className="text-sm text-muted-foreground">
            {t("settings.tfa_enable_confirm")}
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
                if (e.key === "Enter") void handleEnable()
              }}
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="lg" onClick={onBack}>
              <ArrowLeftIcon className="size-4" />
              {t("common.back")}
            </Button>
            <Button
              type="button"
              size="lg"
              className="flex-1"
              disabled={!password || isLoading}
              onClick={() => void handleEnable()}
            >
              {isLoading ? <Spinner size="sm" /> : t("common.continue")}
            </Button>
          </div>
        </>
      )}

      {phase === "qr" && (
        <>
          {/* QR Code */}
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

          {/* Manual key */}
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
            size="lg"
            className="w-full"
            onClick={() => setPhase("verify")}
          >
            {t("common.continue")}
          </Button>
        </>
      )}

      {phase === "verify" && (
        <>
          {/* 6-digit verification */}
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
            <Button type="button" variant="outline" size="lg" onClick={() => setPhase("qr")}>
              <ArrowLeftIcon className="size-4" />
              {t("common.back")}
            </Button>
            <Button
              type="button"
              size="lg"
              className="flex-1"
              disabled={digits.join("").length !== 6 || isLoading}
              onClick={() => void handleVerify()}
            >
              {isLoading ? (
                <>
                  <Spinner size="sm" />
                  {t("auth.verifying")}
                </>
              ) : (
                t("auth.verify")
              )}
            </Button>
          </div>
        </>
      )}

      {phase === "backup" && (
        <>
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
              <CopyIcon className="size-3.5" />
              {t("setup.step_2_copy_all")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleDownload}>
              <DownloadSimpleIcon className="size-3.5" />
              {t("setup.step_2_download")}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              checked={savedBackup}
              onCheckedChange={(checked) => setSavedBackup(checked === true)}
              id="backup-saved"
            />
            <Label htmlFor="backup-saved" className="text-xs">
              {t("setup.step_2_backup_saved")}
            </Label>
          </div>

          {/* CLI hint */}
          <p className="text-xs text-muted-foreground/60">
            {t("setup.cli_hint")}: autopilot auth 2fa enable
          </p>

          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={!savedBackup}
            onClick={handleComplete}
          >
            {t("common.continue")}
          </Button>
        </>
      )}
    </div>
  )
}
