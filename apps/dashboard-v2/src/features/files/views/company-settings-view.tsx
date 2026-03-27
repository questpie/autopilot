import { useMemo, useState, useCallback } from "react"
import { FloppyDiskIcon } from "@phosphor-icons/react"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useUpdateFile } from "../files.mutations"
import type { FileViewProps } from "@/lib/view-registry"

interface CompanyConfig {
  name: string
  description: string
  timezone: string
  language: string
  [key: string]: string
}

/**
 * Basic YAML parser for company.yaml key-value pairs.
 */
function parseCompanyYaml(content: string): CompanyConfig {
  const config: Record<string, string> = {}
  const lines = content.split("\n")

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const colonIdx = trimmed.indexOf(":")
    if (colonIdx === -1) continue

    const key = trimmed.slice(0, colonIdx).trim()
    let value = trimmed.slice(colonIdx + 1).trim()
    // Remove quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    config[key] = value
  }

  return config as CompanyConfig
}

function serializeToYaml(config: CompanyConfig): string {
  return Object.entries(config)
    .map(([key, value]) => {
      if (value.includes("\n") || value.includes(":")) {
        return `${key}: "${value}"`
      }
      return `${key}: ${value}`
    })
    .join("\n") + "\n"
}

const FIELD_LABELS: Record<string, { labelKey: string; type: "text" | "textarea" }> = {
  name: { labelKey: "files.company_name", type: "text" },
  description: { labelKey: "files.company_description", type: "textarea" },
  timezone: { labelKey: "files.company_timezone", type: "text" },
  language: { labelKey: "files.company_language", type: "text" },
}

/**
 * Company settings view for company.yaml.
 * Renders an editable form that saves back to the file.
 */
function CompanySettingsView({ path, content }: FileViewProps) {
  const { t } = useTranslation()
  const updateFile = useUpdateFile()
  const initialConfig = useMemo(() => parseCompanyYaml(content), [content])
  const [config, setConfig] = useState<CompanyConfig>(initialConfig)

  const handleChange = useCallback((key: string, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = useCallback(() => {
    const yaml = serializeToYaml(config)
    updateFile.mutate(
      { path, content: yaml },
      {
        onSuccess: () => toast.success(t("settings.saved")),
        onError: (err) => toast.error(err.message),
      },
    )
  }, [config, path, updateFile, t])

  const fields = Object.keys(config)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-bold text-foreground">
          {t("files.company_settings")}
        </h2>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={updateFile.isPending}
          className="gap-1 rounded-none font-heading text-[10px]"
        >
          <FloppyDiskIcon size={12} />
          {t("settings.save")}
        </Button>
      </div>

      <div className="flex max-w-lg flex-col gap-4">
        {fields.map((key) => {
          const fieldConfig = FIELD_LABELS[key]
          const label = fieldConfig ? t(fieldConfig.labelKey) : key
          const inputType = fieldConfig?.type ?? "text"

          return (
            <div key={key} className="flex flex-col gap-1.5">
              <label className="font-heading text-[10px] uppercase tracking-widest text-muted-foreground">
                {label}
              </label>
              {inputType === "textarea" ? (
                <Textarea
                  value={config[key] ?? ""}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className="rounded-none font-sans text-xs"
                  rows={3}
                />
              ) : (
                <Input
                  value={config[key] ?? ""}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className="rounded-none font-heading text-xs"
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default CompanySettingsView
