import { useMemo } from "react"
import { LockIcon, ShieldCheckIcon, EyeIcon } from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import type { FileViewProps } from "@/lib/view-registry"

interface SecretEntry {
  key: string
  metadata: string
}

/**
 * Parse a secrets YAML file — only extracts key names and metadata,
 * never actual secret values.
 */
function parseSecretsYaml(content: string): SecretEntry[] {
  const entries: SecretEntry[] = []
  const lines = content.split("\n")
  let currentKey = ""

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    if (trimmed.startsWith("- name:") || trimmed.startsWith("- key:")) {
      const colonIdx = trimmed.indexOf(":")
      currentKey = trimmed.slice(colonIdx + 1).trim()
      entries.push({ key: currentKey, metadata: "" })
    } else if (trimmed.startsWith("type:") && entries.length > 0) {
      entries[entries.length - 1].metadata = trimmed.slice(5).trim()
    }
  }

  // If no structured entries found, list top-level keys
  if (entries.length === 0) {
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const colonIdx = trimmed.indexOf(":")
      if (colonIdx > 0 && !trimmed.startsWith(" ")) {
        entries.push({ key: trimmed.slice(0, colonIdx).trim(), metadata: "" })
      }
    }
  }

  return entries
}

/**
 * Secret locked view — shows only secret names and metadata,
 * values are always hidden. Read-only view with lock indicator.
 */
function SecretLockedView({ content }: FileViewProps) {
  const { t } = useTranslation()
  const secrets = useMemo(() => parseSecretsYaml(content), [content])

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* LockIcon banner */}
      <div className="flex items-center gap-3 border border-warning/30 bg-warning/5 p-4">
        <LockIcon size={20} className="shrink-0 text-warning" />
        <div className="flex flex-col gap-0.5">
          <span className="font-heading text-xs font-medium text-warning">
            {t("files.secret_locked_title")}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {t("files.secret_locked_description")}
          </span>
        </div>
      </div>

      {/* Secret entries */}
      <div className="flex flex-col gap-2">
        <h3 className="font-heading text-sm font-medium text-foreground">
          {t("files.secret_entries", { count: secrets.length })}
        </h3>

        {secrets.map((secret) => (
          <div
            key={secret.key}
            className="flex items-center gap-3 border border-border p-3"
          >
            <ShieldCheckIcon size={16} className="shrink-0 text-success" />
            <div className="flex flex-1 flex-col gap-0.5">
              <span className="font-mono text-xs font-medium text-foreground">
                {secret.key}
              </span>
              {secret.metadata && (
                <span className="text-[10px] text-muted-foreground">
                  {secret.metadata}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-muted-foreground/50">
              <EyeIcon size={12} />
              <span className="font-heading text-[9px]">{t("files.secret_hidden")}</span>
            </div>
          </div>
        ))}

        {secrets.length === 0 && (
          <p className="text-xs text-muted-foreground">{t("files.no_secrets")}</p>
        )}
      </div>
    </div>
  )
}

export default SecretLockedView
