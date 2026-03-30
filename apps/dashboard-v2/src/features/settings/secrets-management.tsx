import { useState } from "react"
import { useQuery, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  KeyIcon,
  TrashIcon,
  InfoIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { SecretAddDialog } from "./secret-add-dialog"
import { directoryQuery } from "@/features/files/files.queries"
import { api } from "@/lib/api"

interface SecretEntry {
  name: string
  type: string
  agents: string[]
  created: string
}

function parseSecretYaml(content: string): SecretEntry {
  const entry: SecretEntry = { name: "", type: "api_token", agents: [], created: "" }
  const lines = content.split("\n")

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith("name:")) {
      entry.name = trimmed.slice(5).trim().replace(/['"]/g, "")
    } else if (trimmed.startsWith("type:")) {
      entry.type = trimmed.slice(5).trim().replace(/['"]/g, "")
    } else if (trimmed.startsWith("created:")) {
      entry.created = trimmed.slice(8).trim().replace(/['"]/g, "")
    } else if (trimmed.startsWith("- ") && lines.some((l) => l.trim() === "agents:")) {
      entry.agents.push(trimmed.slice(2).trim().replace(/['"]/g, ""))
    }
  }

  return entry
}

/**
 * Secrets management — list, add, delete.
 * Values are never displayed.
 */
export function SecretsManagement() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [addDialogOpen, setAddDialogOpen] = useState(false)

  const { data: secretFiles } = useSuspenseQuery({
    ...directoryQuery("secrets"),
    queryKey: [...queryKeys.secrets.list(), "directory"],
  })

  const { data: secretContents } = useQuery({
    queryKey: queryKeys.secrets.list({ contents: true }),
    queryFn: async (): Promise<SecretEntry[]> => {
      if (!secretFiles || secretFiles.length === 0) return []
      const entries: SecretEntry[] = []
      for (const file of secretFiles) {
        if (file.type !== "file" || !file.name.endsWith(".yaml")) continue
        try {
          const res = await api.api.fs[":path{.+}"].$get({ param: { path: `secrets/${file.name}` } })
          if (res.ok) {
            const content = await res.text()
            const entry = parseSecretYaml(content)
            if (!entry.name) entry.name = file.name.replace(".yaml", "")
            entries.push(entry)
          }
        } catch {
          // Skip unreadable secrets
        }
      }
      return entries
    },
    enabled: !!secretFiles && secretFiles.length > 0,
    staleTime: 30_000,
  })

  const deleteMutation = useMutation({
    mutationFn: async (secretName: string) => {
      const res = await api.api.files[":path{.+}"].$delete({
        param: { path: `secrets/${secretName}.yaml` },
      })
      if (!res.ok) throw new Error("Failed to delete secret")
    },
    onSuccess: () => {
      toast.success(t("settings.secret_deleted"))
      void queryClient.invalidateQueries({ queryKey: queryKeys.secrets.root })
    },
    onError: (err) => toast.error((err as Error).message),
  })

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const secrets = secretContents ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        {secrets.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("common.empty")}</p>
        ) : (
          secrets.map((secret) => (
            <div
              key={secret.name}
              className="flex flex-col gap-2 border border-border p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <KeyIcon size={16} className="text-primary" />
                  <span className="font-heading text-sm font-medium">{secret.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-[10px] text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (deleteConfirm === secret.name) {
                        deleteMutation.mutate(secret.name)
                        setDeleteConfirm(null)
                      } else {
                        setDeleteConfirm(secret.name)
                      }
                    }}
                  >
                    <TrashIcon size={12} />
                    {deleteConfirm === secret.name
                      ? t("common.confirm")
                      : t("settings.secret_delete")}
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-none text-[10px]">
                  {secret.type}
                </Badge>
                {secret.agents.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {secret.agents.join(", ")}
                  </span>
                )}
                {secret.created && (
                  <span className="text-[10px] text-muted-foreground">
                    {secret.created}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Encryption notice */}
      <div className="flex items-start gap-2 border border-border bg-muted/20 p-3">
        <InfoIcon size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
        <p className="text-[10px] text-muted-foreground">
          {t("settings.secret_encrypted_notice")}
        </p>
      </div>

      <SecretAddDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
      />
    </div>
  )
}
