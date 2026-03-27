import { createFileRoute } from "@tanstack/react-router"
import { useTranslation } from "@/lib/i18n"
import { authClient } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { WarningCircleIcon, ShieldCheckIcon } from "@phosphor-icons/react"
import { useState, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"

export const Route = createFileRoute("/_auth/login/2fa")({
  component: TwoFactorPage,
})

function TwoFactorPage() {
  const { t } = useTranslation()

  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""])
  const [useBackup, setUseBackup] = useState(false)
  const [backupCode, setBackupCode] = useState("")
  const [trustDevice, setTrustDevice] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [failCount, setFailCount] = useState(0)

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const submitCode = useCallback(
    async (code: string) => {
      setIsSubmitting(true)
      setError(null)

      const result = await authClient.twoFactor.verifyTotp({
        code,
        trustDevice,
      })

      setIsSubmitting(false)

      if (result.error) {
        const newCount = failCount + 1
        setFailCount(newCount)
        setError(result.error.message ?? t("auth.error_2fa_invalid"))

        if (!useBackup) {
          setDigits(["", "", "", "", "", ""])
          inputRefs.current[0]?.focus()
        }
        return
      }

      window.location.href = "/"
    },
    [failCount, t, trustDevice, useBackup]
  )

  const handleDigitChange = useCallback(
    (index: number, value: string) => {
      if (!/^\d*$/.test(value)) return

      const newDigits = [...digits]
      newDigits[index] = value.slice(-1)
      setDigits(newDigits)

      // Auto-advance
      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus()
      }

      // Auto-submit when all filled
      if (value && index === 5) {
        const code = newDigits.join("")
        if (code.length === 6) {
          void submitCode(code)
        }
      }
    },
    [digits, submitCode]
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
      if (pasted.length === 0) return

      const newDigits = [...digits]
      for (let i = 0; i < pasted.length; i++) {
        newDigits[i] = pasted[i]
      }
      setDigits(newDigits)

      if (pasted.length === 6) {
        void submitCode(pasted)
      } else {
        inputRefs.current[pasted.length]?.focus()
      }
    },
    [digits, submitCode]
  )

  const handleBackupSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!backupCode.trim()) return
      void submitCode(backupCode.trim())
    },
    [backupCode, submitCode]
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col items-center gap-2">
        <ShieldCheckIcon className="size-8 text-primary" />
        <h2 className="font-heading text-lg font-semibold">
          {t("auth.two_factor_title")}
        </h2>
        <p className="text-center text-sm text-muted-foreground">
          {useBackup
            ? t("auth.two_factor_backup_placeholder")
            : t("auth.two_factor_description")}
        </p>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: [0, -6, 6, -4, 4, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Alert variant="destructive">
              <WarningCircleIcon className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prompt to use backup after 3 failures */}
      {failCount >= 3 && !useBackup && (
        <Alert>
          <WarningCircleIcon className="size-4" />
          <AlertDescription>
            {t("auth.two_factor_failed_attempts")}
          </AlertDescription>
        </Alert>
      )}

      {useBackup ? (
        /* Backup code input */
        <form onSubmit={handleBackupSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="backup-code" className="font-heading text-xs font-medium">
              {t("auth.two_factor_use_backup")}
            </Label>
            <Input
              id="backup-code"
              type="text"
              autoFocus
              placeholder="a1b2-c3d4"
              value={backupCode}
              onChange={(e) => setBackupCode(e.currentTarget.value)}
              disabled={isSubmitting}
              autoComplete="one-time-code"
            />
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={isSubmitting || !backupCode.trim()}>
            {isSubmitting ? (
              <>
                <Spinner size="sm" />
                {t("auth.verifying")}
              </>
            ) : (
              t("auth.verify")
            )}
          </Button>
        </form>
      ) : (
        /* TOTP 6-digit input */
        <div className="flex flex-col gap-4">
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
                disabled={isSubmitting}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleDigitKeyDown(i, e)}
                className="flex size-10 items-center justify-center border border-input bg-transparent text-center font-heading text-lg outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring/50 disabled:opacity-50"
                aria-label={t("a11y.digit_n", { n: i + 1 })}
              />
            ))}
          </div>

          {isSubmitting && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Spinner size="sm" />
              {t("auth.verifying")}
            </div>
          )}
        </div>
      )}

      {/* Trust device */}
      <div className="flex items-center gap-2">
        <Checkbox
          checked={trustDevice}
          onCheckedChange={(checked) => setTrustDevice(checked === true)}
          id="trust-device"
        />
        <Label htmlFor="trust-device" className="text-xs text-muted-foreground">
          {t("auth.two_factor_trust_device")}
        </Label>
      </div>

      {/* Toggle backup/totp */}
      <div className="text-center">
        <button
          type="button"
          className="text-xs text-primary hover:underline"
          onClick={() => {
            setUseBackup(!useBackup)
            setError(null)
          }}
        >
          {useBackup
            ? t("auth.two_factor_use_totp")
            : t("auth.two_factor_use_backup")}
        </button>
      </div>
    </div>
  )
}
