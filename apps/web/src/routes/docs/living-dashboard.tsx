import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/CodeBlock'
import { seoHead } from '@/lib/seo'

export const Route = createFileRoute('/docs/living-dashboard')({
	head: () => ({ ...seoHead({ title: 'Living Dashboard', description: 'Dashboard as code in the company filesystem. Custom widgets, theme overrides, layout configuration, and custom pages.', path: '/docs/living-dashboard', ogImage: 'https://autopilot.questpie.com/og-living-dashboard.png' }) }),
	component: LivingDashboard,
})

function LivingDashboard() {
	return (
		<article className="prose-autopilot">
			<h1 className="font-sans text-3xl font-black text-white mb-2">
				Living Dashboard
			</h1>
			<p className="text-muted text-lg mb-8">
				Dashboard as code in the company filesystem. Agents edit it.
				Changes are instant. No deploys needed.
			</p>

			{/* ── Concept ────────────────────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Concept
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				The dashboard is not a static build. It is a React app living
				in the company filesystem. The orchestrator serves it via the
				artifact router. Agents can edit components, layout, and theme.
				You see changes instantly via HMR.
			</p>
			<CodeBlock title="comparison">
				{`Traditional SaaS:   Build → Deploy → Users see changes (hours/days)
Living Dashboard:   Agent edits file → Vite HMR → User sees change (seconds)`}
			</CodeBlock>

			{/* ── Immutable Core vs Company Layer ─────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Immutable Core vs Customizable Layer
			</h2>
			<CodeBlock title="architecture">
				{`┌─────────────────────────────────────────────────┐
│  IMMUTABLE CORE (npm package)                    │
│  @questpie/autopilot-dashboard                   │
│  Base components, hooks, API client, router      │
│  Agent CANNOT edit — always resettable           │
└──────────────────────┬──────────────────────────┘
                       │ imports
┌──────────────────────▼──────────────────────────┐
│  COMPANY LAYER (in company FS)                   │
│  company/dashboard/                              │
│  ├── overrides/     Custom CSS, theme, branding  │
│  ├── widgets/       Custom dashboard widgets     │
│  ├── pages/         Custom pages                 │
│  ├── layouts/       Custom layout config         │
│  └── .artifact.yaml Serve config                 │
│                                                  │
│  Agent CAN edit — company customization          │
└──────────────────────┬──────────────────────────┘
                       │ served by
┌──────────────────────▼──────────────────────────┐
│  ARTIFACT ROUTER                                 │
│  Cold-start Vite dev server on port 3100+        │
│  HMR — changes appear instantly                  │
└─────────────────────────────────────────────────┘`}
			</CodeBlock>
			<p className="text-ghost leading-relaxed mb-4">
				The core provides base components, router, API client, and
				default pages (Dashboard, Agents, Chat, Files, Settings). It
				ships as an npm package and agents cannot modify it. If
				customizations break anything,{' '}
				<code className="font-mono text-xs text-purple">
					autopilot dashboard reset
				</code>{' '}
				restores the default state.
			</p>

			{/* ── Widgets ────────────────────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Widgets
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Widgets are custom React components rendered inside the
				dashboard. Each widget is a directory with a{' '}
				<code className="font-mono text-xs text-purple">widget.tsx</code>{' '}
				component and{' '}
				<code className="font-mono text-xs text-purple">widget.yaml</code>{' '}
				metadata file.
			</p>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				widget.yaml format
			</h3>
			<CodeBlock title="company/dashboard/widgets/sprint-progress/widget.yaml">
				{`name: sprint-progress
title: "Sprint Progress"
description: "Burndown chart for current sprint"
size: medium              # small (1col) | medium (2col) | large (full)
refresh: 30000            # auto-refresh interval in milliseconds
position: overview        # dashboard section where it appears
created_by: designer`}
			</CodeBlock>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				widget.tsx example
			</h3>
			<CodeBlock title="company/dashboard/widgets/sprint-progress/widget.tsx">
				{`export default function SprintProgress() {
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
      <div className="mt-2 h-2 bg-muted">
        <div
          className="h-full bg-primary"
          style={{ width: \`\${total > 0 ? (done / total) * 100 : 0}%\` }}
        />
      </div>
    </div>
  )
}`}
			</CodeBlock>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				Error Boundary
			</h3>
			<p className="text-ghost leading-relaxed mb-4">
				Every widget runs inside an error boundary and a Suspense
				wrapper. If a widget crashes, the rest of the dashboard keeps
				working. A "Widget Error" card appears with a retry button. If
				a widget takes longer than 5 seconds to render, it times out
				with a fallback message.
			</p>

			{/* ── Theme Overrides ────────────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Theme Overrides
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Override design tokens by editing{' '}
				<code className="font-mono text-xs text-purple">
					company/dashboard/overrides/theme.css
				</code>
				. The file is loaded after default styles, so your values win.
				Colors use OKLCH for perceptual uniformity.
			</p>
			<CodeBlock title="company/dashboard/overrides/theme.css">
				{`:root {
  /* Change accent from purple to blue */
  --primary: oklch(0.6 0.2 250);
  --ring: oklch(0.6 0.2 250);

  /* Custom company font */
  --font-sans: 'CustomFont', 'Inter', sans-serif;

  /* Rounded corners instead of brutalist */
  --radius: 0.5rem;
}

/* Component-level overrides */
.sidebar {
  width: 280px;
}

.task-card {
  border-left: 3px solid var(--primary);
}`}
			</CodeBlock>

			{/* ── Layout Configuration ───────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Layout Configuration
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Control which widgets appear where and in what order by editing{' '}
				<code className="font-mono text-xs text-purple">
					company/dashboard/overrides/layout.yaml
				</code>
				. Sections support three layout modes:{' '}
				<code className="font-mono text-xs text-purple">grid</code>,{' '}
				<code className="font-mono text-xs text-purple">stack</code>,
				and{' '}
				<code className="font-mono text-xs text-purple">tabs</code>.
			</p>
			<CodeBlock title="company/dashboard/overrides/layout.yaml">
				{`dashboard:
  sections:
    - id: alerts
      title: "Needs Attention"
      widgets: [inbox-summary]
      layout: stack
      position: 0

    - id: overview
      title: "Overview"
      widgets: [sprint-progress, team-velocity, budget-tracker]
      layout: grid
      columns: 3
      position: 1

    - id: tasks
      title: "Active Work"
      component: task-list           # core component
      position: 2

    - id: activity
      title: "Activity"
      component: activity-feed       # core component
      position: 3

sidebar:
  items:
    - id: dashboard
      icon: house
      label: Dashboard
    - id: inbox
      icon: tray
      label: Inbox
      badge: pending_count
    - id: agents
      icon: robot
      label: Agents
    - id: chat
      icon: chat-dots
      label: Chat
    - id: files
      icon: folder
      label: Files
    - id: reports                     # custom page
      icon: chart-bar
      label: Reports
    - id: artifacts
      icon: cube
      label: Artifacts
    - id: settings
      icon: gear
      label: Settings`}
			</CodeBlock>

			{/* ── Custom Pages ───────────────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Custom Pages
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Add entirely new pages to the dashboard. Create a{' '}
				<code className="font-mono text-xs text-purple">page.tsx</code>{' '}
				in a subdirectory and register it in{' '}
				<code className="font-mono text-xs text-purple">
					registry.yaml
				</code>
				. The page appears in the sidebar and router automatically.
			</p>
			<CodeBlock title="company/dashboard/pages/registry.yaml">
				{`pages:
  - id: reports
    title: "Weekly Reports"
    path: /reports
    icon: chart-bar
    file: reports/page.tsx
    nav: true                    # show in sidebar navigation

  - id: team-standup
    title: "Standup Notes"
    path: /standup
    icon: users
    file: standup/page.tsx
    nav: true`}
			</CodeBlock>
			<CodeBlock title="company/dashboard/pages/reports/page.tsx">
				{`export default function ReportsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Weekly Reports</h1>
      {/* Custom content — fetch data from /api/* */}
    </div>
  )
}`}
			</CodeBlock>

			{/* ── Dev vs Prod Mode ───────────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Dev vs Prod Mode
			</h2>
			<div className="overflow-x-auto mb-4">
				<table className="w-full text-sm border-collapse">
					<thead>
						<tr className="border-b border-border">
							<th className="text-left text-ghost font-mono text-xs py-2 pr-4">
								Feature
							</th>
							<th className="text-left text-ghost font-mono text-xs py-2 pr-4">
								Dev Mode
							</th>
							<th className="text-left text-ghost font-mono text-xs py-2">
								Prod Mode
							</th>
						</tr>
					</thead>
					<tbody className="text-ghost">
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs text-fg">Server</td>
							<td className="py-2 pr-4 text-xs">Vite dev server with HMR</td>
							<td className="py-2 text-xs">Static build via Bun.serve</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs text-fg">Changes</td>
							<td className="py-2 pr-4 text-xs">Instant via HMR</td>
							<td className="py-2 text-xs">Auto-build on file change</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs text-fg">RAM</td>
							<td className="py-2 pr-4 text-xs">~200MB (Vite)</td>
							<td className="py-2 text-xs">~20MB (static files)</td>
						</tr>
						<tr>
							<td className="py-2 pr-4 text-xs text-fg">Use case</td>
							<td className="py-2 pr-4 text-xs">Agent editing dashboard</td>
							<td className="py-2 text-xs">Default — always-on</td>
						</tr>
					</tbody>
				</table>
			</div>
			<p className="text-ghost leading-relaxed mb-4">
				Prod mode is the default. When an agent edits dashboard files,
				a watcher triggers{' '}
				<code className="font-mono text-xs text-purple">vite build</code>{' '}
				automatically with zero-downtime swap. Dev mode is activated
				explicitly for interactive editing sessions.
			</p>

			{/* ── CLI Commands ───────────────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				CLI Commands
			</h2>
			<CodeBlock title="terminal">
				{`autopilot dashboard              # Open in browser
autopilot dashboard dev          # Start dev mode (HMR)
autopilot dashboard build        # Build for prod
autopilot dashboard reset        # Reset to default (deletes overrides/, widgets/, pages/)
autopilot dashboard widgets      # List custom widgets
autopilot dashboard pages        # List custom pages`}
			</CodeBlock>

			{/* ── Agent Interaction ──────────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Asking Agents to Customize
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Agents use the{' '}
				<code className="font-mono text-xs text-purple">
					dashboard-customization
				</code>{' '}
				skill to know where files live and how to modify them. Just
				ask in natural language:
			</p>
			<CodeBlock title="terminal">
				{`$ autopilot ask "Add a sprint chart to dashboard"
# → Designer/Developer agent:
#   1. Creates company/dashboard/widgets/sprint-chart/widget.tsx
#   2. Creates company/dashboard/widgets/sprint-chart/widget.yaml
#   3. Edits company/dashboard/overrides/layout.yaml
#   4. Dashboard updates automatically (HMR)

$ autopilot ask "Change the dashboard colors to match our new branding"
# → Designer agent:
#   1. Edits company/dashboard/overrides/theme.css
#   2. Changes --primary and other tokens
#   3. Dashboard refreshes with new colors

$ autopilot ask "Create a weekly report page"
# → Developer agent:
#   1. Creates company/dashboard/pages/weekly-report/page.tsx
#   2. Adds to company/dashboard/pages/registry.yaml
#   3. New page appears in sidebar`}
			</CodeBlock>

			{/* ── Safety & Reset ─────────────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Safety & Reset
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				The core is an immutable npm package -- agents cannot break it.
				Overrides are always optional; if they are deleted, the default
				dashboard works. Every widget has its own error boundary so a
				crash in one does not affect others.
			</p>
			<CodeBlock title="terminal">
				{`# Full reset — removes all customizations, keeps data
$ autopilot dashboard reset
Deleted: overrides/, widgets/, pages/
Preserved: pins/, groups.yaml (data)
Dashboard restored to default state.`}
			</CodeBlock>
		</article>
	)
}
