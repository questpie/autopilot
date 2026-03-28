import { type MutableRefObject } from "react"
import { WarningCircleIcon } from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"

interface VerifyCodeProps {
  digits: string[]
  error: string | null
  isLoading: boolean
  inputRefs: MutableRefObject<(HTMLInputElement | null)[]>
  onDigitChange: (index: number, value: string) => void
  onDigitKeyDown: (index: number, e: React.KeyboardEvent<HTMLInputElement>) => void
  onDigitPaste: (e: React.ClipboardEvent) => void
  onVerify: () => void
  onBack: () => void
}

export function VerifyCode({
  digits,
  error,
  isLoading,
  inputRefs,
  onDigitChange,
  onDigitKeyDown,
  onDigitPaste,
  onVerify,
  onBack,
}: VerifyCodeProps) {
  const { t } = useTranslation()

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
        <div className="flex justify-center gap-2" onPaste={onDigitPaste}>
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
              onChange={(e) => onDigitChange(i, e.target.value)}
              onKeyDown={(e) => onDigitKeyDown(i, e)}
              className="flex size-10 items-center justify-center border border-input bg-transparent text-center font-heading text-lg outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring/50 disabled:opacity-50"
              aria-label={t("a11y.digit_n", { n: i + 1 })}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onBack}>
          {t("common.back")}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={digits.join("").length !== 6 || isLoading}
          onClick={onVerify}
        >
          {isLoading ? <Spinner size="sm" /> : t("auth.verify")}
        </Button>
      </div>
    </div>
  )
}
