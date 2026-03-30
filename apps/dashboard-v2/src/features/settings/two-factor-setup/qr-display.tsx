import { useState } from "react"
import { m, AnimatePresence } from "framer-motion"
import { CopyIcon, CheckIcon } from "@phosphor-icons/react"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"
import { Button } from "@/components/ui/button"

interface QrDisplayProps {
  totpURI: string | null
  manualKey: string | null
  onContinue: () => void
}

export function QrDisplay({ totpURI, manualKey, onContinue }: QrDisplayProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const handleCopyKey = () => {
    if (!manualKey) return
    void navigator.clipboard.writeText(manualKey)
    toast.success(t("common.copied"))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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
            onClick={handleCopyKey}
            className="text-muted-foreground hover:text-foreground"
          >
            <AnimatePresence mode="wait" initial={false}>
              <m.span
                key={copied ? "check" : "copy"}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                className="inline-flex"
              >
                {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
              </m.span>
            </AnimatePresence>
          </button>
        </div>
      )}

      <Button
        type="button"
        size="sm"
        onClick={onContinue}
      >
        {t("common.continue")}
      </Button>
    </div>
  )
}
