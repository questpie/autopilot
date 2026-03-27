---
name: create-file-view
description: |
  How to create custom file viewers for the dashboard file browser.
  Use when asked to add a viewer for a specific file type or extension.
license: MIT
metadata:
  author: QUESTPIE
  version: 1.0.0
  tags: [dashboard, files, viewer, customization]
  roles: [developer, design, meta]
---

# Create File View

Custom file views let you register rich viewers for specific file extensions or path patterns. When a user opens a file matching your pattern, the dashboard renders your custom component instead of the default text/code view.

---

## 1. How the View Registry Works

The dashboard resolves file viewers using a priority-based registry:

| Priority Range | Layer | Example |
|---|---|---|
| >= 1000 | Company custom views | Your custom viewers |
| 100-999 | Built-in specialized views | Workflow diagram, agent cards, secret view, skill detail |
| 1-99 | Built-in generic views | Markdown, YAML/JSON, code, image, PDF |
| 0 | Raw text fallback | Plain text display |

When a file is opened, the registry walks from highest to lowest priority and picks the first match. Company views always win over built-in views.

### Built-in specialized views

- `workflows/*.yaml` / `workflows/*.yml` — Workflow diagram renderer
- `agents.yaml` / `agents.yml` — Agent cards grid
- `company.yaml` / `company.yml` — Company settings form
- `secrets/**/*.yaml` / `secrets/**/*.yml` — Secret locked view (encrypted values hidden)
- `skills/**/SKILL.md` — Skill detail card with frontmatter badges

### Built-in generic views

- `*.md` — Markdown renderer with TOC
- `*.yaml`, `*.yml`, `*.json` — Structured data viewer (syntax-highlighted, collapsible)
- `*.png`, `*.jpg`, `*.jpeg`, `*.gif`, `*.svg` — Image viewer
- `*.pdf` — PDF viewer
- `*.ts`, `*.tsx`, `*.js`, `*.jsx`, `*.css`, `*.html` — Code viewer with syntax highlighting
- `*.txt`, `*.csv` — Plain text viewer

---

## 2. Creating a Custom View

### Step 1: Create the view directory

```
company/dashboard/views/{name}/
```

### Step 2: Create `view.yaml`

```yaml
name: social-post-editor
description: "Rich editor for .reel social media post files"
pattern: "*.reel"                # Glob pattern to match file paths
priority: 1000                   # Must be >= 1000 for company views
editable: true                   # Whether save-back is supported
icon: InstagramLogo              # Phosphor icon name for the view tab
```

#### Pattern syntax

| Pattern | Matches |
|---|---|
| `*.reel` | Any file ending in `.reel` |
| `*.invoice` | Any file ending in `.invoice` |
| `invoices/*.yaml` | YAML files in the `invoices/` directory |
| `reports/**/*.md` | Markdown files anywhere under `reports/` |
| `dashboard/widgets/*/widget.tsx` | Widget source files |

### Step 3: Create `view.tsx`

```tsx
import { useState, useCallback } from "react"
import { useTranslation } from "@/lib/i18n"
import { FloppyDisk, PencilSimple, Spinner, Warning } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import type { FileViewProps } from "@/lib/view-registry"

/**
 * Custom file view — must be the default export.
 * Receives { path, content } props.
 */
export default function SocialPostEditor({ path, content }: FileViewProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(content)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const handleSave = useCallback(async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/files/${encodeURIComponent(path)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream" },
        body: draft,
      })
      if (!res.ok) {
        throw new Error(`Save failed: ${res.status}`)
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t("common.error"))
    } finally {
      setSaving(false)
    }
  }, [path, draft, t])

  const isDirty = draft !== content

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PencilSimple size={16} className="text-muted-foreground" />
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
            <Spinner size={14} className="animate-spin" />
          ) : (
            <FloppyDisk size={14} />
          )}
          {t("common.save")}
        </Button>
      </div>

      {/* Error */}
      {saveError && (
        <div className="flex items-center gap-2 border border-destructive/50 bg-destructive/10 p-2 text-destructive">
          <Warning size={14} />
          <span className="font-heading text-xs">{saveError}</span>
        </div>
      )}

      {/* Editor area */}
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="min-h-[400px] rounded-none font-sans text-sm"
        placeholder={t("common.empty")}
      />
    </div>
  )
}
```

---

## 3. Props Documentation

The `FileViewProps` interface:

```typescript
interface FileViewProps {
  /** Relative path within company root, e.g. "knowledge/api-docs.md" */
  path: string
  /** Raw file content as a string (for text files) */
  content: string
}
```

- `path` — The file's relative path from the company root directory
- `content` — The full file content as a string, loaded by the file browser before rendering the view

---

## 4. Edit / Save Capability

To make a view editable:

1. Set `editable: true` in `view.yaml`
2. Use local state (`useState`) to track edits
3. Save via `PUT /api/files/{path}` with the raw content as body
4. Track dirty state by comparing draft to original content
5. Show saving indicator and error handling

### Save API

```typescript
// Save file content
const response = await fetch(`/api/files/${encodeURIComponent(path)}`, {
  method: "PUT",
  headers: { "Content-Type": "application/octet-stream" },
  body: newContent,
})

if (!response.ok) {
  // Handle conflict (409) or other errors
  const error = await response.json()
  console.error(error)
}
```

### Conflict handling

If another user/agent modified the file since it was loaded, the PUT may return `409 Conflict`. Display the conflict dialog and let the user choose:
- Keep mine (force overwrite)
- Keep theirs (discard edits)
- Merge manually

---

## 5. Example Views

### .reel Social Post Editor

A structured editor for social media posts stored as YAML.

**view.yaml:**
```yaml
name: reel-editor
description: "Visual editor for .reel social media posts"
pattern: "*.reel"
priority: 1000
editable: true
icon: InstagramLogo
```

**view.tsx:**
```tsx
import { useState, useMemo, useCallback } from "react"
import { useTranslation } from "@/lib/i18n"
import { FloppyDisk, Spinner, Warning, InstagramLogo, Eye } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import type { FileViewProps } from "@/lib/view-registry"

interface ReelData {
  platform: string
  caption: string
  hashtags: string[]
  scheduledAt: string
  status: string
}

function parseReel(content: string): ReelData {
  try {
    const lines = content.split("\n")
    const data: Record<string, string> = {}
    for (const line of lines) {
      const [key, ...rest] = line.split(":")
      if (key && rest.length) data[key.trim()] = rest.join(":").trim()
    }
    return {
      platform: data["platform"] ?? "instagram",
      caption: data["caption"] ?? "",
      hashtags: (data["hashtags"] ?? "").split(",").map((h) => h.trim()).filter(Boolean),
      scheduledAt: data["scheduled_at"] ?? "",
      status: data["status"] ?? "draft",
    }
  } catch {
    return { platform: "instagram", caption: "", hashtags: [], scheduledAt: "", status: "draft" }
  }
}

function serializeReel(reel: ReelData): string {
  return [
    `platform: ${reel.platform}`,
    `caption: ${reel.caption}`,
    `hashtags: ${reel.hashtags.join(", ")}`,
    `scheduled_at: ${reel.scheduledAt}`,
    `status: ${reel.status}`,
  ].join("\n")
}

export default function ReelEditor({ path, content }: FileViewProps) {
  const { t } = useTranslation()
  const initial = useMemo(() => parseReel(content), [content])
  const [reel, setReel] = useState(initial)
  const [saving, setSaving] = useState(false)

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await fetch(`/api/files/${encodeURIComponent(path)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream" },
        body: serializeReel(reel),
      })
    } finally {
      setSaving(false)
    }
  }, [path, reel])

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <InstagramLogo size={16} />
          <span className="font-heading text-sm">{path}</span>
          <Badge variant="outline" className="rounded-none text-[9px]">{reel.status}</Badge>
        </div>
        <Button size="sm" variant="outline" className="gap-1 rounded-none" onClick={handleSave} disabled={saving}>
          {saving ? <Spinner size={14} className="animate-spin" /> : <FloppyDisk size={14} />}
          {t("common.save")}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <label className="font-heading text-[10px] uppercase tracking-widest text-muted-foreground">
            Platform
          </label>
          <Input
            value={reel.platform}
            onChange={(e) => setReel((r) => ({ ...r, platform: e.target.value }))}
            className="rounded-none font-heading text-xs"
          />

          <label className="font-heading text-[10px] uppercase tracking-widest text-muted-foreground">
            Caption
          </label>
          <Textarea
            value={reel.caption}
            onChange={(e) => setReel((r) => ({ ...r, caption: e.target.value }))}
            className="min-h-[120px] rounded-none font-sans text-xs"
          />

          <label className="font-heading text-[10px] uppercase tracking-widest text-muted-foreground">
            Hashtags
          </label>
          <Input
            value={reel.hashtags.join(", ")}
            onChange={(e) =>
              setReel((r) => ({
                ...r,
                hashtags: e.target.value.split(",").map((h) => h.trim()).filter(Boolean),
              }))
            }
            className="rounded-none font-heading text-xs"
            placeholder="#launch, #product"
          />
        </div>

        <div className="flex flex-col gap-3 border border-border p-4">
          <div className="flex items-center gap-2">
            <Eye size={14} />
            <span className="font-heading text-[10px] uppercase tracking-widest text-muted-foreground">
              Preview
            </span>
          </div>
          <p className="font-sans text-sm leading-relaxed">{reel.caption}</p>
          <div className="flex flex-wrap gap-1">
            {reel.hashtags.map((tag) => (
              <Badge key={tag} variant="secondary" className="rounded-none text-[9px]">
                #{tag}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
```

### .invoice Form Editor

A form-based editor for invoice files.

**view.yaml:**
```yaml
name: invoice-editor
description: "Form editor for .invoice files"
pattern: "*.invoice"
priority: 1000
editable: true
icon: Receipt
```

**view.tsx:**
```tsx
import { useState, useMemo, useCallback } from "react"
import { useTranslation } from "@/lib/i18n"
import { FloppyDisk, Spinner, Receipt } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import type { FileViewProps } from "@/lib/view-registry"

interface InvoiceData {
  number: string
  client: string
  items: Array<{ description: string; amount: number }>
  currency: string
  status: string
}

function parseInvoice(content: string): InvoiceData {
  try {
    return JSON.parse(content) as InvoiceData
  } catch {
    return { number: "", client: "", items: [], currency: "USD", status: "draft" }
  }
}

export default function InvoiceEditor({ path, content }: FileViewProps) {
  const { t } = useTranslation()
  const initial = useMemo(() => parseInvoice(content), [content])
  const [invoice, setInvoice] = useState(initial)
  const [saving, setSaving] = useState(false)

  const total = invoice.items.reduce((sum, item) => sum + item.amount, 0)

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await fetch(`/api/files/${encodeURIComponent(path)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream" },
        body: JSON.stringify(invoice, null, 2),
      })
    } finally {
      setSaving(false)
    }
  }, [path, invoice])

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt size={16} />
          <span className="font-heading text-sm">{invoice.number || path}</span>
          <Badge variant="outline" className="rounded-none text-[9px]">{invoice.status}</Badge>
        </div>
        <Button size="sm" variant="outline" className="gap-1 rounded-none" onClick={handleSave} disabled={saving}>
          {saving ? <Spinner size={14} className="animate-spin" /> : <FloppyDisk size={14} />}
          {t("common.save")}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="font-heading text-[10px] uppercase tracking-widest text-muted-foreground">
            Invoice #
          </label>
          <Input
            value={invoice.number}
            onChange={(e) => setInvoice((inv) => ({ ...inv, number: e.target.value }))}
            className="rounded-none font-heading text-xs"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="font-heading text-[10px] uppercase tracking-widest text-muted-foreground">
            Client
          </label>
          <Input
            value={invoice.client}
            onChange={(e) => setInvoice((inv) => ({ ...inv, client: e.target.value }))}
            className="rounded-none font-heading text-xs"
          />
        </div>
      </div>

      <Separator />

      <div className="flex flex-col gap-2">
        {invoice.items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={item.description}
              onChange={(e) => {
                const items = [...invoice.items]
                items[i] = { ...items[i], description: e.target.value }
                setInvoice((inv) => ({ ...inv, items }))
              }}
              className="flex-1 rounded-none font-sans text-xs"
              placeholder="Item description"
            />
            <Input
              type="number"
              value={item.amount}
              onChange={(e) => {
                const items = [...invoice.items]
                items[i] = { ...items[i], amount: Number(e.target.value) }
                setInvoice((inv) => ({ ...inv, items }))
              }}
              className="w-28 rounded-none font-heading text-xs"
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-3">
        <span className="font-heading text-xs uppercase tracking-widest text-muted-foreground">
          Total
        </span>
        <span className="font-heading text-lg font-bold tabular-nums">
          {new Intl.NumberFormat(undefined, { style: "currency", currency: invoice.currency }).format(total)}
        </span>
      </div>
    </div>
  )
}
```

---

## 6. Rules

- **Default export required** — the view component must be `export default`
- **Pattern must be specific** — avoid overly broad patterns like `*` that override built-in views
- **Priority >= 1000** — company views must use priority 1000 or higher
- **Handle malformed content** — files may contain invalid/unexpected content; always use try/catch
- **Use `t()`** for all user-facing strings
- **Use Phosphor Icons** — no emojis
- **`border-radius: 0`** — brutalist brand
- **No `any` types** — TypeScript strict mode
