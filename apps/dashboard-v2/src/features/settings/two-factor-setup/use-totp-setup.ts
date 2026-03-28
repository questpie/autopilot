import { useState, useRef, useCallback } from "react"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"
import { authClient } from "@/lib/auth"

export type Phase = "status" | "password" | "qr" | "verify" | "backup"

export function useTotpSetup() {
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

  const goToPassword = useCallback(() => {
    setPhase("password")
    setPassword("")
    setError(null)
  }, [])

  const goToStatus = useCallback(() => {
    setPhase("status")
  }, [])

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
  }, [password, t])

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

  const handleFinish = useCallback(() => {
    setPhase("status")
    toast.success(t("settings.saved"))
  }, [t])

  const manualKey = totpURI
    ? new URLSearchParams(totpURI.split("?")[1] ?? "").get("secret")
    : null

  return {
    // state
    phase,
    password,
    totpURI,
    backupCodes,
    digits,
    savedBackup,
    error,
    isLoading,
    is2FAEnabled,
    manualKey,
    inputRefs,

    // setters
    setPassword,
    setSavedBackup,
    setPhase,

    // navigation
    goToPassword,
    goToStatus,

    // handlers
    handleEnable,
    handleDisable,
    handleDigitChange,
    handleDigitKeyDown,
    handleDigitPaste,
    handleVerify,
    handleCopyAll,
    handleDownload,
    handleFinish,
  }
}

export type TotpSetup = ReturnType<typeof useTotpSetup>
