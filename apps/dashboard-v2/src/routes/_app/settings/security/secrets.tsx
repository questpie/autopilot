import { createFileRoute } from "@tanstack/react-router"
import { PlusIcon } from "@phosphor-icons/react"
import { useState } from "react"
import { useTranslation } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { SettingsPageHeader } from "@/features/settings/settings-page-header"
import { SecretsManagement } from "@/features/settings/secrets-management"
import { SecretAddDialog } from "@/features/settings/secret-add-dialog"

export const Route = createFileRoute("/_app/settings/security/secrets")({
  component: SettingsSecretsPage,
})

function SettingsSecretsPage() {
  const { t } = useTranslation()
  const [addOpen, setAddOpen] = useState(false)

  return (
    <div className="flex flex-1 flex-col">
      <SettingsPageHeader
        title={t("settings.secrets")}
        actions={
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setAddOpen(true)}
          >
            <PlusIcon size={14} />
            {t("settings.secret_add")}
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl">
          <SecretsManagement />
        </div>
      </div>
      <SecretAddDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  )
}
