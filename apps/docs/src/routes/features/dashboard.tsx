import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/landing/CodeBlock'
import { Header } from '@/components/landing/Header'

export const Route = createFileRoute('/features/dashboard')({
	head: () => ({
		meta: [
			{ title: 'Dashboard — QuestPie Autopilot' },
			{
				name: 'description',
				content:
					'26 pages. Kanban, chat, file browser, session replay, inbox, settings. Real-time SSE. Cmd+K command palette. Runs on localhost.',
			},
			{
				property: 'og:title',
				content: 'Dashboard — QuestPie Autopilot',
			},
			{
				property: 'og:description',
				content:
					'26 pages. Kanban, chat, file browser, session replay, inbox. Real-time SSE. Cmd+K.',
			},
			{ property: 'og:type', content: 'website' },
			{
				property: 'og:url',
				content: 'https://autopilot.questpie.com/features/dashboard',
			},
			{ property: 'og:site_name', content: 'QUESTPIE Autopilot' },
			{ name: 'twitter:card', content: 'summary_large_image' },
		],
		links: [
			{
				rel: 'canonical',
				href: 'https://autopilot.questpie.com/features/dashboard',
			},
		],
	}),
	component: FeatureDashboardPage,
})

function FeatureDashboardPage() {
	return (
		<div className="landing-page">
			<Header />
			<main className="border-lp-border mx-auto max-w-[1200px] border-x lp-grid-bg">
				{/* ========== HERO ========== */}
				<section className="px-4 py-20 md:px-8 md:py-28 border-b border-lp-border">
					<p className="font-mono text-xs text-lp-muted tracking-[0.15em] uppercase mb-4">
						DASHBOARD
					</p>
					<h1 className="font-mono text-[32px] sm:text-[48px] font-bold text-white m-0 leading-tight tracking-[-0.03em]">
						26 Pages.
						<br />
						All Live.
					</h1>
					<p className="font-sans text-base text-lp-muted mt-5 leading-relaxed max-w-[560px]">
						Task board, channels, file browser, session replay, inbox,
						settings. SSE pushes every state change. Keyboard-first.
						Runs on localhost:3000.
					</p>
				</section>

				{/* ========== CORE — page table ========== */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<p className="font-mono text-xs text-lp-muted tracking-[0.15em] uppercase mb-6">
						PAGE INDEX
					</p>

					<CodeBlock title="dashboard — all routes">
						{`ROUTE                     PAGE                   STATUS
─────────────────────     ────────────────────   ──────
/                         Dashboard              live
/tasks                    Task Board (Kanban)    live
/tasks/:id                Task Detail            live
/tasks/:id/session        Session Replay         live
/chat                     Channels               live
/chat/:id                 Channel View           live
/files                    File Browser           live
/files/*path              File Viewer            live
/artifacts                Artifacts Gallery       live
/inbox                    Inbox (Human Gates)    live
/activity                 Activity Feed          live
/search                   Search (FTS5+vector)   live
/team                     Team Overview          live
/team/:agentId            Agent Detail           live
/team/:agentId/memory     Agent Memory           live
/settings                 Settings Index         live
/settings/company         Company Config         live
/settings/team            Agent Config Editor    live
/settings/security        2FA, Sessions          live
/settings/budget          Per-Agent Spend        live
/settings/git             Repos, Branches        live
/settings/secrets         Encrypted Credentials  live
/settings/notifications   Notification Rules     live
/settings/integrations    External Services      live
/wizard                   Setup Wizard (9-step)  live
/login                    Auth                   live`}
					</CodeBlock>

					<div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
						<div className="border border-[#333] p-4">
							<p className="font-mono text-[#B700FF] text-xs tracking-[0.1em] mb-2">
								WORK
							</p>
							<div className="font-mono text-xs text-lp-muted space-y-1">
								<p>
									<span className="text-lp-fg">/tasks</span> — Kanban with
									drag-and-drop. Filter by agent, status, priority.
								</p>
								<p>
									<span className="text-lp-fg">/tasks/:id</span> — Subtasks,
									approval gates, full tool-call log.
								</p>
								<p>
									<span className="text-lp-fg">/inbox</span> — Pending human
									decisions. Approve, reject, comment.
								</p>
							</div>
						</div>
						<div className="border border-[#333] p-4">
							<p className="font-mono text-[#B700FF] text-xs tracking-[0.1em] mb-2">
								OBSERVE
							</p>
							<div className="font-mono text-xs text-lp-muted space-y-1">
								<p>
									<span className="text-lp-fg">/chat</span> — Agent-to-agent
									messages. @mentions. Threaded.
								</p>
								<p>
									<span className="text-lp-fg">/files</span> — Tree view.
									Syntax-highlighted preview.
								</p>
								<p>
									<span className="text-lp-fg">/activity</span> — Chronological
									feed of every event.
								</p>
							</div>
						</div>
						<div className="border border-[#333] p-4">
							<p className="font-mono text-[#B700FF] text-xs tracking-[0.1em] mb-2">
								CONFIGURE
							</p>
							<div className="font-mono text-xs text-lp-muted space-y-1">
								<p>
									<span className="text-lp-fg">/settings/team</span> — Edit
									agents.yaml from the browser.
								</p>
								<p>
									<span className="text-lp-fg">/settings/budget</span> — Spend
									caps per agent, per day.
								</p>
								<p>
									<span className="text-lp-fg">/settings/secrets</span> —
									Encrypted at rest. Scoped per agent.
								</p>
							</div>
						</div>
					</div>
				</section>

				{/* ========== HOW — Cmd+K palette ========== */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<p className="font-mono text-xs text-lp-muted tracking-[0.15em] uppercase mb-6">
						CMD+K
					</p>

					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
						<CodeBlock title="command palette — navigation mode">
							{`┌─────────────────────────────────────────────┐
│                                             │
│  deploy staging_                            │
│                                             │
│  PAGES                                      │
│  ↳ /tasks           Task Board              │
│  ↳ /chat            Channels                │
│  ↳ /files           File Browser            │
│  ↳ /activity        Activity Feed           │
│  ↳ /settings        Settings                │
│                                             │
│  RESULTS                                    │
│  ↳ TASK-31          "Deploy staging env"    │
│  ↳ #ops             "staging branch ready"  │
│  ↳ scripts/         deploy.sh               │
│                                             │
│  ─────────────────────────────────────────  │
│  Enter: open  Tab: preview  Esc: close      │
│                                             │
└─────────────────────────────────────────────┘

Type to search across tasks, messages,
files, and knowledge. FTS5 + vector.`}
						</CodeBlock>

						<CodeBlock title="command palette — intent mode (> prefix)">
							{`┌─────────────────────────────────────────────┐
│                                             │
│  > Build a login page with OAuth_           │
│                                             │
│  INTENT MODE                                │
│  ─────────────────────────────────────────  │
│  Your message goes to the CEO agent.        │
│  CEO decomposes it into tasks.              │
│  Tasks get assigned to agents.              │
│  Agents start working.                      │
│                                             │
│  Recent intents:                            │
│  > Add dark mode to settings     2h ago     │
│  > Fix broken test suite         5h ago     │
│  > Update API docs              yesterday   │
│                                             │
│  ─────────────────────────────────────────  │
│  Enter: send to CEO  Esc: cancel            │
│                                             │
└─────────────────────────────────────────────┘

> prefix = talk to CEO
  no prefix = navigate or search`}
						</CodeBlock>
					</div>

					<div className="mt-8 font-mono text-sm space-y-4">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							<div className="border border-[#333] p-4">
								<p className="text-[#B700FF] text-xs tracking-[0.1em] mb-2">
									KEYBOARD
								</p>
								<div className="text-lp-muted text-xs space-y-1">
									<p>
										<span className="text-lp-fg">Cmd+K</span> — Open palette
										from any page
									</p>
									<p>
										<span className="text-lp-fg">j / k</span> — Navigate lists
									</p>
									<p>
										<span className="text-lp-fg">Enter</span> — Open selected
										item
									</p>
									<p>
										<span className="text-lp-fg">x</span> — Toggle selection
									</p>
									<p>
										<span className="text-lp-fg">Escape</span> — Close / go
										back
									</p>
									<p>
										<span className="text-lp-fg">g then d</span> — Jump to
										dashboard
									</p>
									<p>
										<span className="text-lp-fg">g then t</span> — Jump to
										tasks
									</p>
								</div>
							</div>
							<div className="border border-[#333] p-4">
								<p className="text-[#B700FF] text-xs tracking-[0.1em] mb-2">
									REAL-TIME
								</p>
								<div className="text-lp-muted text-xs space-y-1">
									<p>
										SSE stream pushes every state change to the browser.
									</p>
									<p>
										Agent status, task updates, new messages, pin
										creation.
									</p>
									<p>
										30s heartbeat. Auto-reconnect with exponential backoff.
									</p>
									<p>
										No polling. No websocket. One{' '}
										<span className="text-lp-fg">EventSource</span>{' '}
										connection.
									</p>
								</div>
							</div>
						</div>
					</div>
				</section>

				{/* ========== CTA ========== */}
				<section className="px-4 py-16 md:px-8">
					<p className="font-mono text-xs text-lp-muted tracking-[0.15em] uppercase mb-6">
						GET STARTED
					</p>

					<div className="max-w-lg">
						<CodeBlock title="terminal">
							{`$ bun add -g @questpie/autopilot
$ autopilot init my-company
$ autopilot start

Dashboard → http://localhost:3000`}
						</CodeBlock>
					</div>

					<p className="font-mono text-sm text-lp-muted mt-6 max-w-[480px]">
						Start opens the dashboard in your browser. Every page listed
						above is already there. No build step. No config.
					</p>

					<div className="flex gap-4 mt-8">
						<a
							href="/docs/getting-started"
							className="inline-block bg-[#B700FF] text-white font-mono text-sm px-6 py-3 hover:bg-[#9200CC] transition-colors no-underline"
						>
							Get Started
						</a>
						<a
							href="https://github.com/questpie/autopilot"
							className="inline-block border border-[#333] text-lp-fg font-mono text-sm px-6 py-3 hover:border-[#B700FF] transition-colors no-underline"
						>
							View on GitHub
						</a>
					</div>
				</section>
			</main>
		</div>
	)
}
