import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useState, useCallback } from "react"
import { useMutation } from "@tanstack/react-query"
import {
  DownloadSimpleIcon,
  ArrowCounterClockwiseIcon,
  TrashIcon,
  WarningIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { FormSection } from "@/components/forms"
import { SettingsPageHeader } from "@/features/settings/settings-page-header"
import { api } from "@/lib/api"

export const Route = createFileRoute("/_app/settings/danger")({
  component: SettingsDangerPage,
})

function SettingsDangerPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const deleteInputRef = useCallback((el: HTMLInputElement | null) => {
    el?.focus()
  }, [])

  const exportMutation = useMutation({
    mutationFn: async () => {
      const res = await api.api.export.$post()
      if (!res.ok) throw new Error(t("errors.export_not_available"))
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `questpie-export-${new Date().toISOString().slice(0, 10)}.zip`
      a.click()
      URL.revokeObjectURL(url)
    },
    onSuccess: () => toast.success(t("settings.export_downloaded")),
    onError: (err) => toast.error((err as Error).message),
  })

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await api.api.reset.$post({ json: { confirm: true } })
      if (!res.ok) throw new Error(t("errors.reset_not_available"))
    },
    onSuccess: () => {
      toast.success(t("settings.danger_reset_success"))
      setResetDialogOpen(false)
    },
    onError: (err) => toast.error((err as Error).message),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await api.api["delete-company"].$post({ json: { confirm: "DELETE" as const } })
      if (!res.ok) throw new Error(t("errors.delete_not_available"))
    },
    onSuccess: () => {
      void router.invalidate().then(() => router.navigate({ to: "/" }))
    },
    onError: (err) => toast.error((err as Error).message),
  })

  return (
    <div className="flex flex-1 flex-col">
      <SettingsPageHeader
        title={t("settings.danger")}
        description={t("settings.danger_description")}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex max-w-lg flex-col gap-6">
          {/* Export */}
          <FormSection title={t("settings.danger_export")}>
            <p className="text-xs text-muted-foreground">
              {t("settings.danger_export_desc")}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending}
            >
              <DownloadSimpleIcon size={14} />
              {exportMutation.isPending
                ? t("settings.danger_exporting")
                : t("settings.danger_export_button")}
            </Button>
          </FormSection>

          {/* Reset */}
          <FormSection title={t("settings.danger_reset")}>
            <p className="text-xs text-muted-foreground">
              {t("settings.danger_reset_desc")}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-warning/30 text-warning hover:bg-warning/10 hover:text-warning"
              onClick={() => setResetDialogOpen(true)}
            >
              <ArrowCounterClockwiseIcon size={14} />
              {t("settings.danger_reset_button")}
            </Button>
          </FormSection>

          {/* Delete */}
          <FormSection title={t("settings.danger_delete")}>
            <p className="text-xs text-muted-foreground">
              {t("settings.danger_delete_desc")}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <TrashIcon size={14} />
              {t("settings.danger_delete_button")}
            </Button>
          </FormSection>
        </div>
      </div>

      {/* Reset confirmation */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="rounded-none sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-heading text-sm">
              <WarningIcon size={16} className="text-warning" />
              {t("settings.danger_reset_button")}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t("settings.danger_reset_confirm")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setResetDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending}
            >
              {resetMutation.isPending
                ? t("settings.danger_resetting")
                : t("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="rounded-none sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-heading text-sm">
              <WarningIcon size={16} className="text-destructive" />
              {t("settings.danger_delete_button")}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t("settings.danger_delete_confirm")}
            </DialogDescription>
          </DialogHeader>
          <Input
            ref={deleteInputRef}
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.currentTarget.value)}
            placeholder={t("settings.danger_delete_placeholder")}
          />
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDeleteDialogOpen(false)
                setDeleteConfirmText("")
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteConfirmText !== "DELETE" || deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              {t("settings.danger_delete_button")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
