---
name: create-widget
description: |
  Step-by-step guide for creating dashboard widgets.
  Use when asked to add metrics, charts, or info cards to the dashboard.
license: MIT
metadata:
  author: QUESTPIE
  version: 1.0.0
  tags: [dashboard, widgets, ui, components]
  roles: [developer, design, meta]
---

# Create Widget

Widgets are small React components that display data on the dashboard. They live in `company/dashboard/widgets/{name}/` and consist of two files: `widget.yaml` (metadata) and `widget.tsx` (component).

---

## 1. Step-by-Step

1. Create directory: `company/dashboard/widgets/{name}/`
2. Create `widget.yaml` with metadata
3. Create `widget.tsx` with the React component
4. Add the widget to a layout section in `company/dashboard/overrides/layout.yaml`
5. Test: open the dashboard and verify the widget renders

---

## 2. Complete widget.yaml Template

```yaml
# Widget metadata — all fields documented
name: my-widget                # Unique identifier (kebab-case, must match directory name)
title: "My Widget"             # Display title shown in the widget header
description: "Short desc"      # Tooltip / accessibility description
size: medium                   # small (1 column) | medium (2 columns) | large (full width)
refresh: 30000                 # Auto-refresh interval in ms (0 = manual only)
position: overview             # Dashboard section ID where widget appears
created_by: designer           # Agent or human who created it
tags:                          # Optional categorization tags
  - metrics
  - sprint
```

### Size Options

| Size | Columns | Use Case |
|------|---------|----------|
| `small` | 1 column (~320px) | Single metric, counter, badge |
| `medium` | 2 columns (~640px) | Charts, progress bars, short lists |
| `large` | Full width | Tables, timelines, complex visualizations |

---

## 3. Complete widget.tsx Template

```tsx
import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { api } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import { Spinner, Warning } from "@phosphor-icons/react"

/**
 * Widget component — must be the default export.
 * Receives no props. Uses hooks for data fetching.
 */
export default function MyWidget() {
  const { t } = useTranslation()

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.tasks.list(),
    queryFn: async () => {
      const res = await api.tasks.$get()
      return res.json()
    },
    refetchInterval: 30_000,
  })

  // ── Loading state ──────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Spinner size={20} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────
  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 text-destructive">
        <Warning size={16} />
        <span className="font-heading text-xs">{t("common.error")}</span>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-2 p-4">
      <h3 className="font-heading text-[10px] uppercase tracking-widest text-muted-foreground">
        {t("dashboard.active_tasks")}
      </h3>
      <div className="text-3xl font-bold tabular-nums text-foreground">
        {data?.length ?? 0}
      </div>
    </div>
  )
}
```

---

## 4. API Query Patterns

### Using TanStack Query with the Hono client

```tsx
// List tasks with filters
const { data: tasks } = useQuery({
  queryKey: queryKeys.tasks.list({ status: "in_progress" }),
  queryFn: async () => {
    const res = await api.tasks.$get({ query: { status: "in_progress" } })
    return res.json()
  },
})

// Get a specific task
const { data: task } = useQuery({
  queryKey: queryKeys.tasks.detail(taskId),
  queryFn: async () => {
    const res = await api.tasks[":id"].$get({ param: { id: taskId } })
    return res.json()
  },
})

// List agents
const { data: agents } = useQuery({
  queryKey: queryKeys.agents.list(),
  queryFn: async () => {
    const res = await api.agents.$get()
    return res.json()
  },
})

// System status
const { data: status } = useQuery({
  queryKey: queryKeys.status.root,
  queryFn: async () => {
    const res = await api.status.$get()
    return res.json()
  },
})
```

### Real-time updates via SSE

```tsx
import { useRealtime } from "@/hooks/use-realtime"

// Subscribe to task events for live updates
useRealtime("tasks", () => {
  queryClient.invalidateQueries({ queryKey: queryKeys.tasks.root })
})
```

---

## 5. Example Widgets

### Metric Card (small)

```tsx
import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { api } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import { Spinner, TrendUp } from "@phosphor-icons/react"

export default function TaskMetric() {
  const { t } = useTranslation()
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.tasks.list(),
    queryFn: async () => {
      const res = await api.tasks.$get()
      return res.json()
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Spinner size={16} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  const total = data?.length ?? 0

  return (
    <div className="flex flex-col gap-1 p-4">
      <span className="font-heading text-[10px] uppercase tracking-widest text-muted-foreground">
        {t("dashboard.active_tasks")}
      </span>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums">{total}</span>
        <TrendUp size={14} className="text-green-500" />
      </div>
    </div>
  )
}
```

**widget.yaml:**
```yaml
name: task-metric
title: "Active Tasks"
size: small
refresh: 60000
position: overview
```

### Progress Bar (medium)

```tsx
import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { api } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import { Spinner, Warning } from "@phosphor-icons/react"

export default function SprintProgress() {
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

  const tasks = data ?? []
  const done = tasks.filter((task: { status: string }) => task.status === "done").length
  const total = tasks.length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <span className="font-heading text-[10px] uppercase tracking-widest text-muted-foreground">
          Sprint Progress
        </span>
        <span className="font-heading text-xs tabular-nums text-foreground">
          {done}/{total}
        </span>
      </div>
      <div className="h-2 w-full bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-heading text-[10px] tabular-nums text-muted-foreground">
        {pct}%
      </span>
    </div>
  )
}
```

**widget.yaml:**
```yaml
name: sprint-progress
title: "Sprint Progress"
size: medium
refresh: 30000
position: overview
```

### Chart Widget (medium)

```tsx
import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { api } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import { Spinner, Warning } from "@phosphor-icons/react"
import { BarChart, Bar, XAxis, ResponsiveContainer, Cell } from "recharts"

export default function TasksByStatus() {
  const { t } = useTranslation()
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.tasks.list(),
    queryFn: async () => {
      const res = await api.tasks.$get()
      return res.json()
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
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

  const tasks = data ?? []
  const statuses = ["backlog", "in_progress", "review", "done"]
  const chartData = statuses.map((status) => ({
    status,
    count: tasks.filter((task: { status: string }) => task.status === status).length,
  }))

  const COLORS = [
    "oklch(0.65 0.015 260)",
    "oklch(0.6 0.2 250)",
    "oklch(0.6 0.15 50)",
    "oklch(0.6 0.2 145)",
  ]

  return (
    <div className="flex flex-col gap-3 p-4">
      <span className="font-heading text-[10px] uppercase tracking-widest text-muted-foreground">
        {t("tasks.filter_status")}
      </span>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={chartData}>
          <XAxis
            dataKey="status"
            tick={{ fontSize: 9, fontFamily: "JetBrains Mono" }}
            axisLine={false}
            tickLine={false}
          />
          <Bar dataKey="count" radius={0}>
            {chartData.map((_entry, idx) => (
              <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

**widget.yaml:**
```yaml
name: tasks-by-status
title: "Tasks by Status"
size: medium
refresh: 60000
position: overview
```

### Recent Activity List (large)

```tsx
import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { api } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import { Spinner, Warning, Clock } from "@phosphor-icons/react"

export default function RecentActivity() {
  const { t } = useTranslation()
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.activity.list({ limit: 10 }),
    queryFn: async () => {
      const res = await api.activity.$get({ query: { limit: "10" } })
      return res.json()
    },
    refetchInterval: 15_000,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
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

  const items = data ?? []

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 p-6 text-center text-muted-foreground">
        <Clock size={24} />
        <span className="font-heading text-xs">{t("dashboard.no_activity")}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      {items.map((item: { id: string; summary: string; timestamp: string; agent: string }) => (
        <div key={item.id} className="flex items-center gap-3 px-4 py-2">
          <span className="font-heading text-[10px] text-muted-foreground">
            {item.agent}
          </span>
          <span className="flex-1 truncate font-sans text-xs text-foreground">
            {item.summary}
          </span>
          <span className="font-heading text-[10px] tabular-nums text-muted-foreground">
            {new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "numeric" }).format(
              new Date(item.timestamp),
            )}
          </span>
        </div>
      ))}
    </div>
  )
}
```

**widget.yaml:**
```yaml
name: recent-activity
title: "Recent Activity"
size: large
refresh: 15000
position: activity
```

---

## 6. Rules

- **Default export required** — the widget component must be `export default`
- **Under 100 LOC** — keep widgets focused; split complex widgets into sub-components
- **Use `queryKeys`** — never use raw string query keys
- **Use `api`** — never use `fetch()` with hardcoded URLs
- **Use `t()`** — all user-facing text must go through i18n
- **Use Phosphor Icons** — no emojis, no other icon libraries
- **Handle all states** — loading, error, and empty
- **`border-radius: 0`** — brutalist brand, no rounded corners
- **`font-heading`** for labels/headings, **`font-sans`** for body content
- **Responsive** — widgets must work at small, medium, and large viewport sizes
- **No direct DOM** — use React, no `document.querySelector` etc.
- **No React Context** — TanStack Query for server state, Zustand for ephemeral UI only
