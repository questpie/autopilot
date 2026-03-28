import { createFileRoute } from '@tanstack/react-router'
import { Header } from '@/components/landing/Header'
import { Section, SectionHeader } from '@/components/landing/Section'
import { Tag } from '@/components/landing/Tag'

export const Route = createFileRoute('/features/dashboard')({
	head: () => ({
		meta: [
			{ title: 'Living Dashboard — QuestPie Autopilot' },
			{
				name: 'description',
				content:
					'Full-featured dashboard with kanban boards, chat, file browser, session replay, and 9-step setup wizard. Real-time SSE updates. Mobile responsive.',
			},
			{
				property: 'og:title',
				content: 'Living Dashboard — QuestPie Autopilot',
			},
			{
				property: 'og:description',
				content:
					'Full-featured dashboard with kanban boards, chat, file browser, session replay, and 9-step setup wizard. Real-time SSE updates. Mobile responsive.',
			},
			{ property: 'og:type', content: 'website' },
			{
				property: 'og:url',
				content: 'https://autopilot.questpie.com/features/dashboard',
			},
			{ property: 'og:site_name', content: 'QUESTPIE Autopilot' },
			{ name: 'twitter:card', content: 'summary_large_image' },
			{
				name: 'twitter:title',
				content: 'Living Dashboard — QuestPie Autopilot',
			},
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
				<section className="px-4 py-24 md:px-8 md:py-32 border-b border-lp-border">
					<div className="mb-4">
						<Tag>DASHBOARD</Tag>
					</div>
					<h1 className="font-mono text-[36px] sm:text-[48px] font-bold text-white m-0 leading-tight tracking-[-0.03em]">
						26 Pages. Real-Time.
						<br />
						Mobile-Ready.
					</h1>
					<p className="font-sans text-base sm:text-lg text-lp-muted mt-5 leading-relaxed max-w-[640px]">
						A full-featured dashboard that shows what your AI team is doing,
						thinking, and waiting on. Not a chat window.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Real-time SSE updates stream across every page. Kanban board, chat,
						file browser, session replay, inbox — all in one place. Mobile
						responsive with bottom tab bar, sheets, and swipe actions. The
						9-step setup wizard gets you running in under 5 minutes.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						This is not a monitoring tool. This is how you work with your AI
						team. Approve tasks, chat with agents, browse files, and manage
						workflows — all from a single interface that updates the moment
						anything changes.
					</p>
					<div className="mt-8">
						<a
							href="/docs/getting-started"
							className="inline-block bg-[#B700FF] text-white font-mono text-sm px-6 py-3 hover:bg-[#9200CC] transition-colors no-underline"
						>
							Get Started
						</a>
					</div>
				</section>

				{/* ========== DASHBOARD HOME ========== */}
				<Section id="home">
					<SectionHeader
						num="01"
						sub="Agents, alerts, pins, and activity — everything you need to know in one screen."
					>
						Your Company at a Glance
					</SectionHeader>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Agent Status Grid
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Every team member visible. Green means working, gray means
								idle. Click any agent to see their current task, recent
								activity, and memory statistics. You know the state of your
								company in one look.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Pin Board
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Collects what agents think you should see. When Ops detects
								a failing health check, the pin appears immediately. Pins
								have severity levels — info, warning, error, and progress —
								so you can triage at a glance.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Activity Feed
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Scrolls chronologically. Every tool call, every message,
								every status change — listed with timestamps and agent
								identity. Filter by agent or action type to find exactly
								what you need.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Alert Section
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Tasks needing your attention bubble to the top. Pending
								approvals, blocked work, and failed steps appear before
								anything else.
							</p>
						</div>
					</div>
				</Section>

				{/* ========== KANBAN ========== */}
				<Section id="kanban">
					<SectionHeader
						num="02"
						sub="A real kanban board with drag-and-drop status changes and one-click approvals."
					>
						Drag Tasks. Approve Work.
					</SectionHeader>

					<p className="font-sans text-sm text-lp-muted max-w-[640px]">
						Drag tasks between columns: backlog, in-progress, review, and done.
						Built with @dnd-kit for smooth, responsive drag interactions that
						feel native.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Filter the board by agent, priority, or status. Click any task card
						to see full details — description, discussion thread, file changes,
						and approval controls. Approve or reject a task directly from the
						card detail view.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Agent avatars appear on every task card so you know who is working
						on what. Priority badges and status colors make the board scannable.
						The board updates in real time — when Max finishes a task and moves
						it to review, the card moves on your screen without a refresh.
					</p>
				</Section>

				{/* ========== CHAT AND CHANNELS ========== */}
				<Section id="chat">
					<SectionHeader
						num="03"
						sub="@mention any agent. They respond in context, with memory of past conversations."
					>
						Talk to Your Agents
					</SectionHeader>

					<p className="font-sans text-sm text-lp-muted max-w-[640px]">
						The channel system supports 5 types. Group channels for team-wide
						discussions. Direct messages for 1:1 conversations with any agent.
						Broadcast channels for read-only announcements. Task channels
						auto-created when work is assigned. Project channels for
						coordination across multiple tasks.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Type <code className="font-mono text-lp-fg text-xs">@max</code> in
						any channel and Max receives your message. Agents see the full
						channel history when responding — no lost context, no repeated
						explanations. Task threads keep implementation discussions separate
						from general coordination.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Agents can @mention other agents. Max finishes writing code and
						@mentions Riley for review. Riley reviews and @mentions you for
						merge approval. The conversation flows naturally without you routing
						anything manually.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						All chat history is persistent and searchable. Find any past
						conversation across any channel through the dashboard search or the
						Cmd+K command palette.
					</p>
				</Section>

				{/* ========== FILE BROWSER ========== */}
				<Section id="files">
					<SectionHeader
						num="04"
						sub="Navigate the filesystem. View markdown, YAML, code, and images. Upload new knowledge."
					>
						Browse Your Company Files
					</SectionHeader>

					<p className="font-sans text-sm text-lp-muted max-w-[640px]">
						A tree-view sidebar shows your entire company directory structure.
						Click any file to view it with syntax highlighting — markdown
						renders as formatted text, YAML and JSON display with proper
						indentation, code files get full syntax colors.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Upload files directly from the browser. Add knowledge documents,
						configuration files, brand guidelines, or any asset your agents
						need. What you upload appears in the filesystem immediately and
						becomes searchable through the unified search index.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Agents see the same filesystem you do. When you upload a coding
						standards document, Max can find it on the next task. When you add
						API documentation, every agent with the search tool can reference
						it.
					</p>
				</Section>

				{/* ========== SESSION REPLAY ========== */}
				<Section id="sessions">
					<SectionHeader
						num="05"
						sub="Understand exactly what an agent did, why, and what tools it used."
					>
						Replay Any Decision
					</SectionHeader>

					<p className="font-sans text-sm text-lp-muted max-w-[640px]">
						Select any historical session from the session picker. Browse by
						agent name, date, or associated task. Every session is stored as a
						JSONL log with the complete sequence of events.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Scrub through the timeline. See each tool call with its input
						parameters and output. Read the code diffs as the agent wrote them.
						View API responses as the agent saw them. Follow the search queries
						and their results.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						When an agent makes an unexpected decision, session replay shows you
						the exact sequence that led there. No guessing, no log diving, no
						recreating scenarios. The full decision chain is recorded and
						reviewable.
					</p>
				</Section>

				{/* ========== SETUP WIZARD ========== */}
				<Section id="wizard">
					<SectionHeader
						num="06"
						sub="A 9-step wizard that walks you through everything — from account creation to first agent session."
					>
						Running in 5 Minutes
					</SectionHeader>

					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						{[
							{
								step: '1',
								title: 'Create Account',
								desc: 'Email and password.',
							},
							{
								step: '2',
								title: 'Enable 2FA',
								desc: 'TOTP with any authenticator app.',
							},
							{
								step: '3',
								title: 'AI Provider',
								desc: 'Configure provider and enter API keys.',
							},
							{
								step: '4',
								title: 'Company Details',
								desc: 'Name, description, and timezone.',
							},
							{
								step: '5',
								title: 'Team Template',
								desc: 'Solo dev, agency, startup, or custom.',
							},
							{
								step: '6',
								title: 'Upload Knowledge',
								desc: 'Docs, code conventions, and brand guidelines.',
							},
							{
								step: '7',
								title: 'Integrations',
								desc: 'GitHub and communication tools.',
							},
							{
								step: '8',
								title: 'Workflows',
								desc: 'Pick built-in or import your own.',
							},
							{
								step: '9',
								title: 'Git Repository',
								desc: 'Connect your repo and start.',
							},
						].map((item) => (
							<div
								key={item.step}
								className="bg-lp-card border border-lp-border p-6"
							>
								<span className="font-mono text-[11px] text-lp-purple">
									STEP {item.step}
								</span>
								<h3 className="font-mono text-sm font-bold text-white mt-1 mb-2">
									{item.title}
								</h3>
								<p className="font-sans text-xs text-lp-muted leading-relaxed">
									{item.desc}
								</p>
							</div>
						))}
					</div>

					<p className="font-sans text-sm text-lp-muted mt-6 max-w-[640px]">
						Every step includes inline guidance. Skip what you do not need. Come
						back to any step later from settings. By step 9, your AI team is
						ready to accept its first intent.
					</p>
				</Section>

				{/* ========== COMMAND PALETTE ========== */}
				<Section id="command-palette">
					<SectionHeader
						num="07"
						sub="Navigate anywhere. Create intents. Search everything. All from the keyboard."
					>
						Cmd+K Everything
					</SectionHeader>

					<p className="font-sans text-sm text-lp-muted max-w-[640px]">
						Open the command palette from any page with Cmd+K (or Ctrl+K). Start
						typing to navigate to any dashboard page instantly. Results appear
						as you type — tasks, channels, settings pages, all accessible
						without touching the mouse.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Prefix any query with{' '}
						<code className="font-mono text-lp-fg text-xs">&gt;</code> to
						create a new intent. Type{' '}
						<code className="font-mono text-lp-fg text-xs">
							&gt;Build a login form
						</code>{' '}
						and the CEO agent receives your request and starts decomposing it
						into tasks. Intent creation is one keystroke away from wherever you
						are.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						The keyboard-first design extends across the entire dashboard — j/k
						to navigate lists, x to select, Enter to open, Escape to close, and
						chord shortcuts like g+d to jump to the dashboard home.
					</p>
				</Section>

				{/* ========== MOBILE ========== */}
				<Section id="mobile">
					<SectionHeader
						num="08"
						sub="Full dashboard on mobile. Bottom tab bar, swipe actions, haptic feedback."
					>
						Your AI Team in Your Pocket
					</SectionHeader>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Responsive Design
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Adapts to any screen size without losing functionality. On
								mobile, primary navigation moves to a bottom tab bar. Detail
								views open as sheets that slide up from the bottom.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Swipe Actions
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Swipe on task cards to approve or reject with a gesture.
								Haptic feedback confirms your action. One swipe on mobile
								replaces two clicks on desktop.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								PWA Notifications
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Push notifications reach you anywhere. When a task needs
								approval, the notification arrives with action buttons —
								approve directly from your lock screen. Urgent notifications
								bypass quiet hours.
							</p>
						</div>
					</div>
				</Section>

				{/* ========== SETTINGS ========== */}
				<Section id="settings">
					<SectionHeader
						num="09"
						sub="Company, team, security, budget, git, providers, integrations — configure everything from the dashboard."
					>
						Full Control. 13 Settings Pages.
					</SectionHeader>

					<p className="font-sans text-sm text-lp-muted max-w-[640px]">
						Company settings let you update name, description, timezone, and
						default workflow. Team management provides add, remove, and edit
						controls for every agent with role assignments and provider
						configuration.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Security settings give you 2FA enforcement, session management with
						individual and bulk revocation, IP allowlist configuration, and rate
						limit tuning. Budget controls set spending limits per agent, per
						day, and per month — agents stop working when they hit their budget.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Git integration connects repositories, configures branch strategy,
						and manages webhooks. Provider management handles API keys, default
						model selection, and fallback configuration. Every setting is
						accessible from both the dashboard and the CLI.
					</p>
				</Section>

				{/* ========== CTA ========== */}
				<section className="px-4 py-16 md:px-8 text-center border-t border-lp-border">
					<h2 className="font-mono text-xl sm:text-2xl font-bold text-white mb-4">
						See the dashboard in action
					</h2>
					<p className="font-sans text-sm text-lp-muted mb-8 max-w-md mx-auto">
						26 pages, real-time SSE, mobile responsive. Running in 5 minutes.
					</p>
					<a
						href="/docs/getting-started"
						className="inline-block bg-[#B700FF] text-white font-mono text-sm px-6 py-3 hover:bg-[#9200CC] transition-colors no-underline"
					>
						Get Started
					</a>
				</section>
			</main>
		</div>
	)
}
