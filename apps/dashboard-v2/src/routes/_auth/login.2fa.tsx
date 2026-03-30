import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useTranslation } from "@/lib/i18n"
import { authClient } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { WarningCircleIcon } from "@phosphor-icons/react"
import { useReducer, useRef, useCallback } from "react"
import { m, AnimatePresence } from "framer-motion"

export const Route = createFileRoute("/_auth/login/2fa")({
  component: TwoFactorPage,
})

type TwoFactorState = {
  digits: string[]
  useBackup: boolean
  backupCode: string
  trustDevice: boolean
  error: string | null
  isSubmitting: boolean
  failCount: number
}

type TwoFactorAction =
  | { type: "SET_DIGITS"; digits: string[] }
  | { type: "SET_USE_BACKUP"; useBackup: boolean }
  | { type: "SET_BACKUP_CODE"; backupCode: string }
  | { type: "SET_TRUST_DEVICE"; trustDevice: boolean }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_FAIL"; error: string; resetDigits: boolean }
  | { type: "CLEAR_ERROR" }

const initialState: TwoFactorState = {
  digits: ["", "", "", "", "", ""],
  useBackup: false,
  backupCode: "",
  trustDevice: false,
  error: null,
  isSubmitting: false,
  failCount: 0,
}

function twoFactorReducer(state: TwoFactorState, action: TwoFactorAction): TwoFactorState {
  switch (action.type) {
    case "SET_DIGITS":
      return { ...state, digits: action.digits }
    case "SET_USE_BACKUP":
      return { ...state, useBackup: action.useBackup, error: null }
    case "SET_BACKUP_CODE":
      return { ...state, backupCode: action.backupCode }
    case "SET_TRUST_DEVICE":
      return { ...state, trustDevice: action.trustDevice }
    case "SUBMIT_START":
      return { ...state, isSubmitting: true, error: null }
    case "SUBMIT_FAIL":
      return {
        ...state,
        isSubmitting: false,
        failCount: state.failCount + 1,
        error: action.error,
        digits: action.resetDigits ? ["", "", "", "", "", ""] : state.digits,
      }
    case "CLEAR_ERROR":
      return { ...state, error: null }
    default:
      return state
  }
}

function TwoFactorPage() {
  const { t } = useTranslation()
  const router = useRouter()

  const [state, dispatch] = useReducer(twoFactorReducer, initialState)
  const { digits, useBackup, backupCode, trustDevice, error, isSubmitting, failCount } = state

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const backupInputRef = useRef<HTMLInputElement>(null)

  const handleToggleBackup = useCallback(() => {
    const nextUseBackup = !useBackup
    dispatch({ type: "SET_USE_BACKUP", useBackup: nextUseBackup })
    // Focus the appropriate input after React re-renders
    requestAnimationFrame(() => {
      if (nextUseBackup) {
        backupInputRef.current?.focus()
      } else {
        inputRefs.current[0]?.focus()
      }
    })
  }, [useBackup])

  const submitCode = useCallback(
    async (code: string) => {
      dispatch({ type: "SUBMIT_START" })

      const result = await authClient.twoFactor.verifyTotp({
        code,
        trustDevice,
      })

      if (result.error) {
        dispatch({
          type: "SUBMIT_FAIL",
          error: result.error.message ?? t("auth.error_2fa_invalid"),
          resetDigits: !useBackup,
        })

        if (!useBackup) {
          inputRefs.current[0]?.focus()
        }
        return
      }

      await router.invalidate()
      await router.navigate({ to: "/" })
    },
    [router, t, trustDevice, useBackup]
  )

  const handleDigitChange = useCallback(
    (index: number, value: string) => {
      if (!/^\d*$/.test(value)) return

      const newDigits = [...digits]
      newDigits[index] = value.slice(-1)
      dispatch({ type: "SET_DIGITS", digits: newDigits })

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
      dispatch({ type: "SET_DIGITS", digits: newDigits })

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
      <div className="flex flex-col gap-2">
        <h2 className="font-heading text-xl font-semibold">
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
          <m.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: [0, -6, 6, -4, 4, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Alert variant="destructive">
              <WarningCircleIcon className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </m.div>
        )}
      </AnimatePresence>

      {/* Prompt to use backup after 3 failures */}
      {failCount >= 3 && !useBackup && (
        <Alert variant="warning">
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
              ref={backupInputRef}
              placeholder="a1b2-c3d4"
              value={backupCode}
              onChange={(e) => dispatch({ type: "SET_BACKUP_CODE", backupCode: e.currentTarget.value })}
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
          <div className="flex justify-center gap-2.5" onPaste={handleDigitPaste}>
            {digits.map((digit, i) => (
              <input
                key={`totp-slot-${["a", "b", "c", "d", "e", "f"][i]}`}
                ref={(el) => {
                  inputRefs.current[i] = el
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                disabled={isSubmitting}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleDigitKeyDown(i, e)}
                className="flex size-12 items-center justify-center border border-input bg-transparent text-center font-heading text-xl outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring/50 focus:bg-secondary/50 disabled:opacity-50"
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
          onCheckedChange={(checked) => dispatch({ type: "SET_TRUST_DEVICE", trustDevice: checked === true })}
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
          onClick={handleToggleBackup}
        >
          {useBackup
            ? t("auth.two_factor_use_totp")
            : t("auth.two_factor_use_backup")}
        </button>
      </div>
    </div>
  )
}
