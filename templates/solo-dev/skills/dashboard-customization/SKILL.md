---
name: dashboard-customization
description: |
  How to customize the company dashboard — themes, widgets, layouts, pages, file views.
  Use when asked to modify the dashboard appearance, add new views, or extend functionality.
license: MIT
metadata:
  author: QUESTPIE
  version: 2.0.0
  tags: [dashboard, ui, customization, widgets, themes]
  roles: [design, developer, meta]
---

# Dashboard Customization

The Living Dashboard lives in `company/dashboard/`. You can customize the theme, add widgets, change the layout, create custom pages, and register custom file views. The core dashboard is an immutable npm package — your changes go into the company layer only.

---

## 1. Filesystem

```
company/dashboard/
├── .artifact.yaml            # Serve config (DO NOT edit or delete)
├── overrides/
│   ├── theme.css             # Custom CSS variables (OKLch colors, fonts, spacing)
│   ├── branding.tsx          # Custom logo, company name
│   └── layout.yaml           # Dashboard section layout, sidebar config
├── widgets/
│   ├── {name}/
│   │   ├── widget.tsx        # React component
│   │   └── widget.yaml       # Widget metadata
│   └── ...
├── pages/
│   ├── {name}/
│   │   └── page.tsx          # Custom page component
│   └── registry.yaml         # Page registry (routes, nav items)
├── views/
│   ├── {name}/
│   │   ├── view.tsx          # React viewer component
│   │   └── view.yaml         # View metadata (patterns, priority)
│   └── ...
├── locales/
│   ├── en.json               # English translations (reference)
│   ├── {lang}.json           # Additional language translations
│   └── ...
├── pins/                     # Data pins (DO NOT modify via this skill)
└── groups.yaml               # Pin group layout
```

---

## 2. Theme Overrides

Edit `company/dashboard/overrides/theme.css` to override CSS variables. All colors use the **OKLch** color space.

```css
:root {
  /* ── Brand colors (OKLch) ────────────────────────────── */
  --primary: oklch(0.6 0.2 250);
  --primary-foreground: oklch(0.98 0.005 250);
  --ring: oklch(0.6 0.2 250);

  /* ── Accents ─────────────────────────────────────────── */
  --accent: oklch(0.55 0.15 300);
  --accent-foreground: oklch(0.98 0.005 300);

  /* ── Semantic ────────────────────────────────────────── */
  --destructive: oklch(0.55 0.22 27);
  --muted: oklch(0.25 0.01 260);
  --muted-foreground: oklch(0.65 0.015 260);

  /* ── Background / card ───────────────────────────────── */
  --background: oklch(0.13 0.005 260);
  --card: oklch(0.16 0.005 260);
  --border: oklch(0.28 0.01 260);

  /* ── Fonts ───────────────────────────────────────────── */
  --font-heading: 'JetBrains Mono', monospace; /* nav, labels, buttons, headings, code */
  --font-sans: 'Geist Sans', system-ui, sans-serif;  /* body content */

  /* ── Border radius (0 = brutalist) ───────────────────── */
  --radius: 0;
}

/* Component-level overrides */
.sidebar {
  width: 280px;
}

.task-card {
  border-left: 3px solid var(--primary);
}
```

**OKLch format:** `oklch(lightness chroma hue)`
- Lightness: 0 (black) to 1 (white)
- Chroma: 0 (gray) to ~0.37 (max saturation)
- Hue: 0-360 degrees (0=red, 120=green, 250=blue, 300=purple)

The theme file is loaded after default styles, so your values override the defaults.

---

## 3. Creating a Widget

### Step 1: Create the directory

```
company/dashboard/widgets/{name}/
```

### Step 2: Create `widget.yaml`

```yaml
name: sprint-progress
title: "Sprint Progress"
description: "Burndown chart for current sprint"
size: medium              # small (1col) | medium (2col) | large (full width)
refresh: 30000            # auto-refresh interval in milliseconds (0 = no refresh)
position: overview        # dashboard section where it appears
created_by: designer
```

### Step 3: Create `widget.tsx`

```tsx
import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { api } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import { Spinner, Warning } from "@phosphor-icons/react"

export default function SprintProgress() {
  const { t } = useTranslation()
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.tasks.list({ status: "in_progress" }),
    queryFn: async () => {
      const res = await api.tasks.$get({ query: { status: "in_progress" } })
      return res.json()
    },
    refetchInterval: 30_000,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Spinner size={20} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 text-destructive">
        <Warning size={16} />
        <span className="font-heading text-xs">{t("common.error")}</span>
      </div>
    )
  }

  const done = data?.filter((task: { status: string }) => task.status === "done").length ?? 0
  const total = data?.length ?? 0

  return (
    <div className="p-4 border border-border">
      <h3 className="font-heading text-xs uppercase tracking-wider text-muted-foreground mb-2">
        {t("dashboard.active_tasks")}
      </h3>
      <div className="text-3xl font-bold text-foreground">
        {done}/{total}
      </div>
    </div>
  )
}
```

### Step 4: Add to layout

In `overrides/layout.yaml`, add the widget to a section:

```yaml
dashboard:
  sections:
    - id: overview
      title: "Overview"
      widgets: [sprint-progress]
      layout: grid
      columns: 3
      position: 0
```

---

## 4. Creating a Custom Page

### Step 1: Create the page component

```
company/dashboard/pages/{name}/page.tsx
```

```tsx
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "@/lib/i18n"
import { ChartBar, Spinner } from "@phosphor-icons/react"

export default function ReportsPage() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-2">
        <ChartBar size={20} weight="bold" />
        <h1 className="font-heading text-lg font-bold">{t("nav.dashboard")}</h1>
      </div>
      {/* Page content */}
    </div>
  )
}
```

### Step 2: Register in `registry.yaml`

```yaml
pages:
  - id: reports
    title: "Weekly Reports"
    path: /reports
    icon: chart-bar          # Phosphor icon name (lowercase, kebab-case)
    file: reports/page.tsx
    nav: true                # show in sidebar navigation
    position: 5              # ordering in the nav
```

---

## 5. Creating a Custom File View

Register a custom viewer for specific file extensions or path patterns.

### Step 1: Create the view directory

```
company/dashboard/views/{name}/
```

### Step 2: Create `view.yaml`

```yaml
name: social-post-editor
description: "Rich editor for .reel social media post files"
pattern: "*.reel"            # Glob pattern to match files
priority: 1000               # Company views: >= 1000
editable: true               # Whether save-back is enabled
```

### Step 3: Create `view.tsx`

```tsx
import { useState, useCallback } from "react"
import { useTranslation } from "@/lib/i18n"
import { FloppyDisk, PencilSimple } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { FileViewProps } from "@/lib/view-registry"

export default function SocialPostEditor({ path, content }: FileViewProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(content)
  const [saving, setSaving] = useState(false)

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await fetch(`/api/files/${encodeURIComponent(path)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream" },
        body: draft,
      })
    } finally {
      setSaving(false)
    }
  }, [path, draft])

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PencilSimple size={16} />
          <span className="font-heading text-sm">{path}</span>
        </div>
        <Button size="sm" variant="outline" onClick={handleSave} disabled={saving}>
          <FloppyDisk size={14} className="mr-1" />
          {t("common.save")}
        </Button>
      </div>
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="min-h-[300px] rounded-none font-sans text-sm"
      />
    </div>
  )
}
```

The view receives `path` (relative file path) and `content` (raw string content) as props via the `FileViewProps` interface.

---

## 6. Modifying groups.yaml

The `groups.yaml` file controls how pinned items are organized on the dashboard.

```yaml
groups:
  - id: active-sprint
    title: "Active Sprint"
    icon: lightning
    position: 0
    collapsed: false

  - id: blockers
    title: "Blockers"
    icon: warning-circle
    position: 1
    collapsed: false

  - id: metrics
    title: "Metrics"
    icon: chart-line-up
    position: 2
    collapsed: true
```

Each group has:
- `id` — unique identifier, referenced when agents pin items
- `title` — display name on the dashboard
- `icon` — Phosphor icon name (lowercase, kebab-case)
- `position` — sort order (lower = higher)
- `collapsed` — initial collapse state

---

## 7. Available Components and Hooks

### shadcn/ui Components

All shadcn components are available. Add new ones with:

```bash
bunx --bun shadcn@latest add <component>
```

Commonly used: `Button`, `Card`, `Badge`, `Input`, `Textarea`, `Select`, `Dialog`, `DropdownMenu`, `Tabs`, `Tooltip`, `Separator`, `ScrollArea`, `Skeleton`.

### Available Hooks / Queries

| Hook / Import | Purpose |
|---|---|
| `useQuery` / `useMutation` from `@tanstack/react-query` | Data fetching and mutations |
| `queryKeys` from `@/lib/query-keys` | Type-safe query key factory |
| `api` from `@/lib/api` | Hono RPC client (type-safe API calls) |
| `useTranslation` from `@/lib/i18n` | i18n `t()` function |
| `useRealtime` from `@/hooks/use-realtime` | SSE event subscriptions |

### API Endpoints (via `api`)

```typescript
api.tasks.$get()              // List tasks
api.agents.$get()             // List agents
api.channels.$get()           // List channels
api.files[":path"].$get()     // Read file
api.files[":path"].$put()     // Write file
api.artifacts.$get()          // List artifacts
api.status.$get()             // System status
```

### Phosphor Icons

Always import from `@phosphor-icons/react`. Use `size` and `weight` props:

```tsx
import { House, Robot, ChartBar } from "@phosphor-icons/react"

<House size={20} weight="bold" />
```

---

## 8. Dos and Don'ts

### DO

- Use `useQuery` with `queryKeys` factory for all data fetching
- Use `useTranslation()` and `t()` for all user-facing text
- Use Phosphor Icons only (`@phosphor-icons/react`)
- Handle loading, error, and empty states in every component
- Keep widgets under 100 lines of code
- Use `border-radius: 0` (brutalist brand) — no rounded corners
- Use `font-heading` (JetBrains Mono) for labels, headings, and UI chrome
- Use `font-sans` (Geist Sans) for body text content
- Wrap components in error boundaries
- Make widgets responsive across all three sizes (small/medium/large)
- Use CSS `prefers-reduced-motion` — degrade animations to instant

### DON'T

- **DO NOT** manipulate the DOM directly — always use React
- **DO NOT** use React Context for state — use TanStack Query for server state, Zustand for UI
- **DO NOT** edit anything in `apps/dashboard-v2/` (the core package)
- **DO NOT** delete `.artifact.yaml`
- **DO NOT** use `fetch()` with raw URLs — use the `api` client from `@/lib/api`
- **DO NOT** use raw query key strings — use `queryKeys` factory
- **DO NOT** use emojis in the UI — use Phosphor Icons
- **DO NOT** hardcode strings — use `t()` from i18n
- **DO NOT** use `any` types — TypeScript strict mode is enforced
- **DO NOT** use other icon libraries — Phosphor only
- **DO NOT** create god components with many conditional props — compose smaller pieces
