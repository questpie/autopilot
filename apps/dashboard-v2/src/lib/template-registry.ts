export interface TemplateField {
  name: string
  type: "text" | "textarea" | "select" | "toggle"
  label: string
  placeholder?: string
  required?: boolean
  options?: Array<{ label: string; value: string }>
  defaultValue?: string
}

export interface FileTemplate {
  pattern: string
  label: string
  icon: string
  description?: string
  fields: TemplateField[]
  outputPath: (fields: Record<string, string>, currentDir: string) => string
  outputContent: (fields: Record<string, string>) => string
  aiAssist?: boolean
}

const WORKFLOW_TEMPLATE = `name: {name}
description: {description}
version: 1

steps:
  - id: start
    name: Start
    type: action
    agent: ceo
    transitions:
      - target: work
        condition: always

  - id: work
    name: Do the work
    type: action
    agent: auto
    transitions:
      - target: review
        condition: always

  - id: review
    name: Review
    type: gate
    approver: human
    transitions:
      - target: complete
        condition: approved
      - target: work
        condition: rejected

  - id: complete
    name: Complete
    type: end
`

const KNOWLEDGE_TEMPLATE = `---
title: {title}
created: {date}
---

# {title}

{topic}
`

const SKILL_TEMPLATE = `---
name: {name}
description: |
  {description}
license: MIT
metadata:
  author: QUESTPIE
  version: 1.0.0
  tags: []
  roles: [{roles}]
---

# {name}

{description}

---

## 1. When to Use

Describe the situations where this skill should be activated.

---

## 2. Steps

1. Step one
2. Step two
3. Step three

---

## 3. Rules

- Rule one
- Rule two
`

const WIDGET_YAML_TEMPLATE = `name: {name}
title: "{title}"
description: "{description}"
size: medium
refresh: 30000
position: overview
created_by: human
`

function toPascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join("")
}

const WIDGET_TSX_TEMPLATE = (name: string): string => {
  const componentName = toPascalCase(name) || "CustomWidget"
  return `import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { api } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import { SpinnerIcon, WarningIcon } from "@phosphor-icons/react"

export default function ${componentName}() {
  const { t } = useTranslation()

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.tasks.list(),
    queryFn: async () => {
      const res = await api.tasks.$get()
      return res.json()
    },
    refetchInterval: 30_000,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <SpinnerIcon size={20} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 text-destructive">
        <WarningIcon size={16} />
        <span className="font-heading text-xs">{t("common.error")}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      <h3 className="font-heading text-[10px] uppercase tracking-widest text-muted-foreground">
        ${componentName}
      </h3>
      <div className="text-3xl font-bold tabular-nums text-foreground">
        {data?.length ?? 0}
      </div>
    </div>
  )
}
`
}

const VIEW_YAML_TEMPLATE = `name: {name}
description: "{description}"
pattern: "*.{extension}"
priority: 1000
editable: true
icon: File
`

const VIEW_TSX_TEMPLATE = (name: string): string => {
  const componentName = toPascalCase(name) || "CustomView"
  return `import { useState, useCallback } from "react"
import { useTranslation } from "@/lib/i18n"
import { api } from "@/lib/api"
import { FloppyDiskIcon, PencilSimpleIcon, SpinnerIcon, WarningIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import type { FileViewProps } from "@/lib/view-registry"

export default function ${componentName}({ path, content }: FileViewProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(content)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const isDirty = draft !== content

  const handleSave = useCallback(async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const res = await api.api.files[":path{.+}"].$put({
        param: { path },
        json: { content: draft },
      })
      if (!res.ok) throw new Error(\`Save failed: \${res.status}\`)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t("common.error"))
    } finally {
      setSaving(false)
    }
  }, [path, draft, t])

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PencilSimpleIcon size={16} className="text-muted-foreground" />
          <span className="font-heading text-sm text-foreground">{path}</span>
          {isDirty && (
            <Badge variant="outline" className="rounded-none text-[9px]">
              {t("common.edit")}
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1 rounded-none"
          onClick={handleSave}
          disabled={saving || !isDirty}
        >
          {saving ? (
            <SpinnerIcon size={14} className="animate-spin" />
          ) : (
            <FloppyDiskIcon size={14} />
          )}
          {t("common.save")}
        </Button>
      </div>

      {saveError && (
        <div className="flex items-center gap-2 border border-destructive/50 bg-destructive/10 p-2 text-destructive">
          <WarningIcon size={14} />
          <span className="font-heading text-xs">{saveError}</span>
        </div>
      )}

      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="min-h-[400px] rounded-none font-sans text-sm"
        placeholder={t("common.empty")}
      />
    </div>
  )
}
`
}

const LANGUAGE_TEMPLATE = `{
  "app": {
    "name": "QUESTPIE Autopilot",
    "version": "v2"
  },
  "nav": {
    "dashboard": "",
    "tasks": "",
    "team": "",
    "chat": "",
    "files": "",
    "artifacts": "",
    "skills": "",
    "inbox": "",
    "settings": "",
    "more": "",
    "activity": "",
    "sessions": "",
    "search": ""
  },
  "common": {
    "loading": "",
    "error": "",
    "retry": "",
    "cancel": "",
    "save": "",
    "delete": "",
    "edit": "",
    "create": "",
    "confirm": "",
    "close": "",
    "back": "",
    "next": "",
    "skip": "",
    "continue": "",
    "finish": "",
    "search": "",
    "no_results": "",
    "empty": "",
    "copy": "",
    "copied": "",
    "or": "",
    "optional": ""
  }
}
`

const SECRET_TEMPLATE = `service: {name}
type: api_key
value: ""
allowed_agents: [ceo]
usage: |
  Authorization: Bearer {value}
  Base URL: https://api.example.com/
`

const PAGE_TEMPLATE = (name: string): string => {
  const componentName = toPascalCase(name) || "CustomPage"
  return `import { useTranslation } from "@/lib/i18n"

export default function ${componentName}() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="font-heading text-lg font-bold">${componentName}</h1>
      <p className="font-sans text-sm text-muted-foreground">
        {t("common.empty")}
      </p>
    </div>
  )
}
`
}

export const builtInTemplates: FileTemplate[] = [
  {
    pattern: "workflows",
    label: "files.new_workflow",
    icon: "ArrowsClockwise",
    description: "files.new_workflow_desc",
    fields: [
      { name: "name", type: "text", label: "files.workflow_name", placeholder: "content-review", required: true },
      { name: "description", type: "textarea", label: "files.workflow_description", placeholder: "files.workflow_description_placeholder" },
    ],
    outputPath: (f) => `workflows/${f.name}.yaml`,
    outputContent: (f) =>
      WORKFLOW_TEMPLATE
        .replace(/{name}/g, f.name ?? "")
        .replace(/{description}/g, f.description ?? ""),
    aiAssist: true,
  },
  {
    pattern: "knowledge/**",
    label: "files.new_document",
    icon: "FileText",
    description: "files.new_document_desc",
    fields: [
      { name: "title", type: "text", label: "files.document_title", required: true },
      { name: "topic", type: "textarea", label: "files.document_topic" },
    ],
    outputPath: (f, dir) => `${dir}/${f.title}.md`,
    outputContent: (f) =>
      KNOWLEDGE_TEMPLATE
        .replace(/{title}/g, f.title ?? "")
        .replace(/{topic}/g, f.topic ?? "")
        .replace(/{date}/g, new Date().toISOString().split("T")[0] ?? ""),
    aiAssist: true,
  },
  {
    pattern: "skills",
    label: "files.new_skill",
    icon: "Wrench",
    fields: [
      { name: "name", type: "text", label: "files.skill_name", required: true },
      { name: "roles", type: "text", label: "files.skill_roles", placeholder: "developer, reviewer" },
      { name: "description", type: "textarea", label: "files.skill_description" },
    ],
    outputPath: (f) => `skills/${f.name}/SKILL.md`,
    outputContent: (f) =>
      SKILL_TEMPLATE
        .replace(/{name}/g, f.name ?? "")
        .replace(/{roles}/g, f.roles ?? "")
        .replace(/{description}/g, f.description ?? ""),
    aiAssist: true,
  },
  {
    pattern: "dashboard/widgets",
    label: "files.new_widget",
    icon: "SquaresFour",
    description: "files.new_widget_desc",
    fields: [
      { name: "name", type: "text", label: "files.widget_name", placeholder: "sprint-progress", required: true },
      {
        name: "size",
        type: "select",
        label: "files.widget_size",
        options: [
          { label: "Small (1 col)", value: "small" },
          { label: "Medium (2 col)", value: "medium" },
          { label: "Large (full)", value: "large" },
        ],
        defaultValue: "medium",
      },
      { name: "description", type: "textarea", label: "files.widget_description" },
    ],
    outputPath: (f) => `dashboard/widgets/${f.name}/widget.tsx`,
    outputContent: (f) => WIDGET_TSX_TEMPLATE(f.name ?? "custom-widget"),
    aiAssist: true,
  },
  {
    pattern: "dashboard/views",
    label: "files.new_view",
    icon: "Eye",
    description: "files.new_view_desc",
    fields: [
      { name: "name", type: "text", label: "files.view_name", placeholder: "invoice-editor", required: true },
      { name: "extension", type: "text", label: "files.view_extension", placeholder: "invoice", required: true },
      { name: "description", type: "textarea", label: "files.view_description" },
    ],
    outputPath: (f) => `dashboard/views/${f.name}/view.tsx`,
    outputContent: (f) => VIEW_TSX_TEMPLATE(f.name ?? "custom-view"),
    aiAssist: true,
  },
  {
    pattern: "dashboard/pages",
    label: "files.new_page",
    icon: "Browser",
    description: "files.new_page_desc",
    fields: [
      { name: "name", type: "text", label: "files.page_name", placeholder: "reports", required: true },
    ],
    outputPath: (f) => `dashboard/pages/${f.name}/page.tsx`,
    outputContent: (f) => PAGE_TEMPLATE(f.name ?? "custom-page"),
    aiAssist: true,
  },
  {
    pattern: "dashboard/locales",
    label: "files.new_language",
    icon: "Translate",
    description: "files.new_language_desc",
    fields: [
      { name: "lang", type: "text", label: "files.language_code", placeholder: "sk", required: true },
    ],
    outputPath: (f) => `dashboard/locales/${f.lang}.json`,
    outputContent: () => LANGUAGE_TEMPLATE,
    aiAssist: true,
  },
  {
    pattern: "secrets",
    label: "files.new_secret",
    icon: "LockKey",
    description: "files.new_secret_desc",
    fields: [
      { name: "name", type: "text", label: "files.secret_service_name", placeholder: "github", required: true },
    ],
    outputPath: (f) => `secrets/${f.name}.yaml`,
    outputContent: (f) =>
      SECRET_TEMPLATE.replace(/{name}/g, f.name ?? ""),
    aiAssist: false,
  },
]

export function getWidgetYamlContent(fields: Record<string, string>): string {
  return WIDGET_YAML_TEMPLATE
    .replace(/{name}/g, fields.name ?? "")
    .replace(/{title}/g, toPascalCase(fields.name ?? "").replace(/([A-Z])/g, " $1").trim())
    .replace(/{description}/g, fields.description ?? "")
}

export function getViewYamlContent(fields: Record<string, string>): string {
  return VIEW_YAML_TEMPLATE
    .replace(/{name}/g, fields.name ?? "")
    .replace(/{description}/g, fields.description ?? "")
    .replace(/{extension}/g, fields.extension ?? "")
}

function matchPattern(pattern: string, dirPath: string): boolean {
  const normPattern = pattern.replace(/^\/+/, "").replace(/\/+$/, "")
  const normPath = dirPath.replace(/^\/+/, "").replace(/\/+$/, "")

  if (normPattern === normPath) return true

  if (normPattern.endsWith("/**")) {
    const prefix = normPattern.slice(0, -3)
    return normPath === prefix || normPath.startsWith(prefix + "/")
  }

  return false
}

export function getTemplatesForDirectory(dirPath: string): FileTemplate[] {
  return builtInTemplates.filter((t) => matchPattern(t.pattern, dirPath))
}

export const genericFileTemplate: FileTemplate = {
  pattern: "**",
  label: "files.new_file",
  icon: "FilePlus",
  fields: [
    { name: "filename", type: "text", label: "files.filename", placeholder: "README.md", required: true },
  ],
  outputPath: (f, dir) => `${dir}/${f.filename}`,
  outputContent: () => "",
}
