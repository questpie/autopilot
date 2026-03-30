import { LockIcon } from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"

interface FileLockIndicatorProps {
  lockedBy: string
  expiresAt: string
}

/**
 * Banner shown when viewing a locked file.
 * Displays who locked it and when the lock expires.
 */
export function FileLockIndicator({ lockedBy, expiresAt }: FileLockIndicatorProps) {
  const { t } = useTranslation()

  const expiresDate = new Date(expiresAt)
  const now = new Date()
  const remainingMs = expiresDate.getTime() - now.getTime()
  const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000))

  return (
    <div className="flex items-center gap-2 border-b border-warning/30 bg-warning/10 px-4 py-2">
      <LockIcon size={14} className="shrink-0 text-warning" />
      <span className="font-heading text-xs text-warning">
        {t("files.locked_by", { agent: lockedBy, seconds: remainingSeconds })}
      </span>
    </div>
  )
}
