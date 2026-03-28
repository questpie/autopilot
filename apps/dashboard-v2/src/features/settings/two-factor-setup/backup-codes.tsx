import { CopyIcon, DownloadSimpleIcon, WarningCircleIcon } from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface BackupCodesProps {
  backupCodes: string[]
  savedBackup: boolean
  onSavedBackupChange: (checked: boolean) => void
  onCopyAll: () => void
  onDownload: () => void
  onFinish: () => void
}

export function BackupCodes({
  backupCodes,
  savedBackup,
  onSavedBackupChange,
  onCopyAll,
  onDownload,
  onFinish,
}: BackupCodesProps) {
  const { t } = useTranslation()

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
        <Button type="button" variant="outline" size="sm" onClick={onCopyAll}>
          <CopyIcon className="mr-1 size-3.5" />
          {t("setup.step_2_copy_all")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onDownload}>
          <DownloadSimpleIcon className="mr-1 size-3.5" />
          {t("setup.step_2_download")}
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          checked={savedBackup}
          onCheckedChange={(checked) => onSavedBackupChange(checked === true)}
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
        onClick={onFinish}
      >
        {t("common.finish")}
      </Button>
    </div>
  )
}
