---
name: dashboard-customization
description: |
  How to customize the company dashboard — themes, widgets, layouts, pages.
  Use when asked to modify the dashboard appearance or add new views.
license: MIT
metadata:
  author: QUESTPIE
  version: 1.0.0
  tags: [dashboard, ui, customization]
  roles: [design, developer, meta]
---

# Dashboard Customization

The Living Dashboard lives in `company/dashboard/`. You can customize the theme, add widgets, change the layout, and create custom pages. The core dashboard is an immutable npm package — your changes go into the company layer only.

---

## 1. Filesystem

```
company/dashboard/
├── .artifact.yaml            # Serve config (DO NOT edit or delete)
├── overrides/
│   ├── theme.css             # Custom CSS variables (colors, fonts, spacing)
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
├── pins/                     # Data pins (DO NOT modify via this skill)
└── groups.yaml               # Pin group layout (DO NOT modify via this skill)
```

---

## 2. Theme

Edit `company/dashboard/overrides/theme.css` to override CSS variables.

```css
:root {
  /* Override primary accent color */
  --primary: oklch(0.6 0.2 250);
  --ring: oklch(0.6 0.2 250);

  /* Custom font */
  --font-sans: 'CustomFont', 'Inter', sans-serif;

  /* Border radius (0 = brutalist, 0.5rem = rounded) */
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

The theme file is loaded after default styles, so your values override the defaults.

---

## 3. Widget

To create a custom widget:

1. Create directory: `company/dashboard/widgets/{name}/`
2. Create `widget.yaml` with metadata
3. Create `widget.tsx` with the React component
4. Add the widget to a layout section in `overrides/layout.yaml`

### widget.yaml format

```yaml
name: sprint-progress
title: "Sprint Progress"
description: "Burndown chart for current sprint"
size: medium              # small (1col) | medium (2col) | large (full)
refresh: 30000            # auto-refresh interval in milliseconds
position: overview        # dashboard section where it appears
created_by: designer
```

### widget.tsx format

```tsx
export default function SprintProgress() {
  const { data } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => fetch('/api/tasks').then(r => r.json()),
    refetchInterval: 30000,
  })

  const done = data?.filter(t => t.status === 'done').length ?? 0
  const total = data?.length ?? 0

  return (
    <div className="p-4 border border-border">
      <h3 className="font-ui text-xs uppercase tracking-wider text-muted-foreground mb-2">
        Sprint Progress
      </h3>
      <div className="text-3xl font-bold text-foreground">
        {done}/{total}
      </div>
    </div>
  )
}
```

### Rules for widgets
- Keep under 100 lines of code
- Use `fetch('/api/...')` for data — no direct filesystem access
- Use shadcn/ui classes for styling (Tailwind CSS)
- Handle errors gracefully — show a fallback message if data fails to load
- Make it responsive — test at small, medium, and large sizes

---

## 4. Layout

Edit `company/dashboard/overrides/layout.yaml` to define sections and widget placement.

```yaml
dashboard:
  sections:
    - id: overview
      title: "Overview"
      widgets: [sprint-progress, team-velocity]
      layout: grid
      columns: 3
      position: 0

    - id: tasks
      title: "Active Work"
      component: task-list       # core component
      position: 1

    - id: activity
      title: "Activity"
      component: activity-feed   # core component
      position: 2

sidebar:
  items:
    - id: dashboard
      icon: house
      label: Dashboard
    - id: agents
      icon: robot
      label: Agents
    - id: reports
      icon: chart-bar
      label: Reports
```

---

## 5. Custom Pages

1. Create `company/dashboard/pages/{name}/page.tsx`
2. Register in `company/dashboard/pages/registry.yaml`

### registry.yaml format

```yaml
pages:
  - id: reports
    title: "Weekly Reports"
    path: /reports
    icon: chart-bar
    file: reports/page.tsx
    nav: true                    # show in sidebar navigation
```

### page.tsx format

```tsx
export default function ReportsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Weekly Reports</h1>
      {/* Page content */}
    </div>
  )
}
```

---

## 6. What You MUST NOT Do

- **DO NOT** edit anything in `apps/dashboard/` (the core npm package)
- **DO NOT** delete `.artifact.yaml` — it configures how the dashboard is served
- **DO NOT** modify `pins/` or `groups.yaml` through this skill (use pin management instead)
- **DO NOT** modify API endpoints or server code

---

## 7. Best Practices

- **Under 100 LOC** per widget or page — keep components focused
- **Error handling** — always handle fetch failures gracefully with fallback UI
- **Responsive** — widgets must work at all three sizes (small/medium/large)
- **Use API hooks** — `useQuery` with `fetch('/api/...')` for data
- **shadcn classes** — use the design system, don't write custom CSS unless necessary
- **Test visually** — run `autopilot dashboard dev` to see changes live with HMR
