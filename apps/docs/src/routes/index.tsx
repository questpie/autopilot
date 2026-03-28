import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

import { CodeBlock } from '@/components/landing/CodeBlock'
import { Header } from '@/components/landing/Header'
import { QSymbol } from '@/components/landing/QSymbol'

export const Route = createFileRoute('/')({
	head: () => ({
		meta: [
			{ title: 'QuestPie Autopilot — Your company runs on files. Now it runs itself.' },
			{
				name: 'description',
				content:
					'Define AI agents in YAML. They write code, ship features, review PRs. You approve. Open source, self-hosted, MIT license.',
			},
			{
				property: 'og:title',
				content: 'QuestPie Autopilot — Your company runs on files. Now it runs itself.',
			},
			{
				property: 'og:description',
				content:
					'Define AI agents in YAML. They write code, ship features, review PRs. You approve. Open source, self-hosted, MIT license.',
			},
			{ property: 'og:type', content: 'website' },
			{ property: 'og:url', content: 'https://autopilot.questpie.com' },
			{ property: 'og:site_name', content: 'QUESTPIE Autopilot' },
			{ name: 'twitter:card', content: 'summary_large_image' },
			{
				name: 'twitter:title',
				content: 'QuestPie Autopilot — Your company runs on files. Now it runs itself.',
			},
		],
		links: [{ rel: 'canonical', href: 'https://autopilot.questpie.com' }],
	}),
	component: LandingPage,
})

/* ── Scroll reveal hook ── */
function useReveal() {
	const ref = useRef<HTMLDivElement>(null)
	useEffect(() => {
		const el = ref.current
		if (!el) return
		const io = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					el.classList.add('lp-visible')
					io.unobserve(el)
				}
			},
			{ threshold: 0.12 },
		)
		io.observe(el)
		return () => io.disconnect()
	}, [])
	return ref
}

function RevealSection({
	children,
	className = '',
}: { children: React.ReactNode; className?: string }) {
	const ref = useReveal()
	return (
		<div
			ref={ref}
			className={`lp-reveal ${className}`}
			style={{
				opacity: 0,
				transform: 'translateY(24px)',
				transition: 'opacity 0.5s ease, transform 0.5s ease',
			}}
		>
			{children}
		</div>
	)
}

/* ── Terminal typing animation ── */
function TerminalTyping() {
	const lines = [
		{ type: 'cmd', text: '$ autopilot init my-company' },
		{ type: 'out', text: '\u2713 Created company.yaml' },
		{ type: 'out', text: '\u2713 Created team/agents.yaml (6 agents)' },
		{ type: 'out', text: '\u2713 Created team/workflows/development.yaml' },
		{ type: 'blank', text: '' },
		{ type: 'cmd', text: '$ autopilot start' },
		{ type: 'out', text: '\u25CF Orchestrator running on :7778' },
		{ type: 'out', text: '\u25CF Dashboard at http://localhost:3000' },
		{ type: 'blank', text: '' },
		{ type: 'cmd', text: '$ autopilot chat ceo "Build a pricing page"' },
		{ type: 'out', text: '\u2192 CEO decomposing intent...' },
		{ type: 'out', text: '\u2192 Alex (planner) creating task tree' },
		{ type: 'out', text: '\u2192 Max (developer) writing components' },
	]

	return (
		<div className="bg-lp-card border border-lp-border overflow-hidden w-full">
			<div className="px-4 py-2 border-b border-lp-border flex items-center gap-2">
				<div className="flex gap-1">
					<div className="w-2 h-2 bg-lp-accent-green" />
					<div className="w-2 h-2 bg-lp-accent-green opacity-60" />
					<div className="w-2 h-2 bg-lp-accent-green opacity-30" />
				</div>
				<span className="font-mono text-[11px] text-lp-ghost">terminal</span>
			</div>
			<div className="p-4 font-mono text-xs leading-relaxed">
				{lines.map((line, i) => {
					if (line.type === 'blank') return <div key={i} className="h-3" />
					const delay = `${i * 0.3}s`
					const isCmd = line.type === 'cmd'
					return (
						<div
							key={i}
							className="lp-type-line whitespace-pre overflow-hidden"
							style={{
								animationDelay: delay,
								color: isCmd ? '#E5E5E5' : line.text.startsWith('\u2713') ? '#00E676' : '#B700FF',
							}}
						>
							{line.text}
						</div>
					)
				})}
			</div>
		</div>
	)
}

/* ── YAML=Company file viewer ── */
const companyFiles: Record<string, { lang: string; content: string }> = {
	'company.yaml': {
		lang: 'yaml',
		content: `name: "my-startup"
description: "SaaS for team productivity"
domain: "myapp.dev"
stack:
  runtime: bun
  framework: tanstack-start
  database: sqlite
  styling: tailwindcss`,
	},
	'team/agents.yaml': {
		lang: 'yaml',
		content: `agents:
  - id: alex
    role: planner
    tools: [task, message]

  - id: max
    role: developer
    tools: [fs, terminal, task, message]
    fs_scope:
      write: ["src/**", "tests/**"]

  - id: riley
    role: reviewer
    tools: [fs, terminal, task, message]`,
	},
	'team/roles/developer.md': {
		lang: 'yaml',
		content: `# Developer Role

You write production code.
You follow the project conventions.
You write tests for every feature.
You never push directly to main.

## Tools
- fs: read/write project files
- terminal: run commands
- task: update task status
- message: communicate with team`,
	},
	'knowledge/conventions.md': {
		lang: 'yaml',
		content: `# Coding Conventions

- TypeScript strict mode
- Functional components only
- Server functions for data fetching
- No "any" types
- Tests co-located with source
- Imports sorted alphabetically`,
	},
}

function FileTree() {
	const [active, setActive] = useState('company.yaml')
	const files = [
		{ name: 'company.yaml', indent: 0, label: '\u2190 identity' },
		{ name: 'team/agents.yaml', indent: 1, label: '\u2190 your AI team' },
		{ name: 'team/roles/developer.md', indent: 2, label: '\u2190 role prompts' },
		{ name: 'knowledge/conventions.md', indent: 1, label: '\u2190 coding standards' },
	]

	const treeDisplay = `my-company/
\u251C\u2500\u2500 company.yaml
\u251C\u2500\u2500 team/
\u2502   \u251C\u2500\u2500 agents.yaml
\u2502   \u251C\u2500\u2500 roles/
\u2502   \u2502   \u251C\u2500\u2500 developer.md
\u2502   \u2502   \u2514\u2500\u2500 reviewer.md
\u2502   \u2514\u2500\u2500 workflows/
\u2502       \u2514\u2500\u2500 development.yaml
\u251C\u2500\u2500 knowledge/
\u2502   \u251C\u2500\u2500 conventions.md
\u2502   \u2514\u2500\u2500 architecture.md
\u251C\u2500\u2500 secrets/
\u2502   \u2514\u2500\u2500 github.yaml          \u2190 encrypted
\u2514\u2500\u2500 .data/
    \u2514\u2500\u2500 autopilot.db         \u2190 SQLite (everything)`

	return (
		<div className="flex flex-col lg:flex-row gap-0 border border-lp-border">
			{/* Tree side */}
			<div className="lg:w-[45%] border-b lg:border-b-0 lg:border-r border-lp-border">
				<div className="px-4 py-2 border-b border-lp-border flex items-center gap-2">
					<span className="font-mono text-[11px] text-lp-ghost uppercase tracking-[0.05em]">
						Explorer
					</span>
				</div>
				<div className="p-4">
					{/* Clickable file list */}
					<div className="flex flex-col gap-1 mb-4">
						{files.map((f) => (
							<button
								key={f.name}
								type="button"
								onClick={() => setActive(f.name)}
								className={`text-left font-mono text-xs py-1 px-2 border transition-colors cursor-pointer ${
									active === f.name
										? 'border-lp-purple text-lp-fg bg-lp-purple-faint'
										: 'border-transparent text-lp-muted hover:text-lp-fg hover:border-lp-border'
								}`}
								style={{ paddingLeft: `${f.indent * 16 + 8}px` }}
							>
								{f.name.split('/').pop()}
								<span className="text-lp-ghost ml-3">{f.label}</span>
							</button>
						))}
					</div>
					{/* Full tree display */}
					<pre className="font-mono text-[11px] text-lp-ghost leading-relaxed whitespace-pre overflow-x-auto lp-scrollbar">
						{treeDisplay}
					</pre>
				</div>
			</div>
			{/* File content side */}
			<div className="lg:w-[55%] flex flex-col">
				<div className="px-4 py-2 border-b border-lp-border flex items-center gap-2">
					<div className="flex gap-1">
						<div className="w-2 h-2 bg-lp-accent-red" />
						<div className="w-2 h-2 bg-lp-accent-yellow" />
						<div className="w-2 h-2 bg-lp-accent-green" />
					</div>
					<span className="font-mono text-[11px] text-lp-ghost">{active}</span>
				</div>
				<pre className="font-mono text-xs text-lp-fg p-4 m-0 overflow-x-auto leading-relaxed flex-1 lp-scrollbar whitespace-pre">
					{companyFiles[active]?.content ?? ''}
				</pre>
			</div>
		</div>
	)
}

/* ── Main page ── */
function LandingPage() {
	return (
		<div className="landing-page min-h-screen">
			<style>{`
				.lp-reveal.lp-visible {
					opacity: 1 !important;
					transform: translateY(0) !important;
				}
				@keyframes lp-type {
					from { width: 0; opacity: 1; }
					to { width: 100%; opacity: 1; }
				}
				.lp-type-line {
					width: 0;
					opacity: 0;
					animation: lp-type 0.6s steps(40, end) forwards;
				}
			`}</style>

			<Header />

			{/* ── 1. HERO ── */}
			<section className="border-b border-lp-border">
				<div className="mx-auto max-w-[1200px] border-x border-lp-border px-4 md:px-8 py-16 md:py-24">
					<div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-start">
						{/* Left */}
						<div className="lg:w-[58%] flex flex-col gap-6">
							<span className="font-mono text-[10px] uppercase tracking-[0.15em] text-lp-muted">
								Open Source &middot; MIT License
							</span>
							<h1
								className="font-mono font-bold text-lp-fg leading-[1.1] tracking-[-0.03em]"
								style={{ fontSize: 'clamp(32px, 5vw, 64px)' }}
							>
								Define agents in YAML.
								<br />
								They write code, ship features, and review PRs.
								<br />
								<span className="text-lp-purple">You approve.</span>
							</h1>
							<p className="font-sans text-base md:text-lg text-lp-muted max-w-[480px] leading-relaxed">
								Your company as a git repo. AI agents that actually work. One CLI to run it all.
							</p>
							<div className="flex flex-wrap gap-3 mt-2">
								<a
									href="/docs/getting-started"
									className="font-mono text-sm font-semibold bg-lp-purple text-white px-6 py-3 border border-lp-purple hover:bg-[#9200CC] transition-colors no-underline inline-block"
								>
									Get Started
								</a>
								<a
									href="https://github.com/questpie/autopilot"
									target="_blank"
									rel="noopener noreferrer"
									className="font-mono text-sm font-semibold text-lp-fg px-6 py-3 border border-lp-border hover:border-lp-purple transition-colors no-underline inline-block"
								>
									View on GitHub
								</a>
							</div>
						</div>
						{/* Right */}
						<div className="lg:w-[42%] w-full">
							<TerminalTyping />
						</div>
					</div>
				</div>
			</section>

			{/* ── 2. PROBLEM ── */}
			<section className="border-b border-lp-border">
				<RevealSection>
					<div className="mx-auto max-w-[1200px] border-x border-lp-border px-4 md:px-8 py-16 md:py-24">
						<p
							className="font-mono font-bold text-lp-fg leading-snug tracking-[-0.03em] max-w-[720px] mb-12"
							style={{ fontSize: 'clamp(20px, 3vw, 36px)' }}
						>
							You're the founder. You're also the developer, the reviewer, the ops engineer,
							the marketer, and the designer. Something always drops.
						</p>
						<div className="bg-lp-card border border-lp-border p-4 md:p-6 overflow-x-auto lp-scrollbar">
							<pre className="font-mono text-xs md:text-sm text-lp-muted leading-loose whitespace-pre m-0">
{`06:00  wake up, check production
07:00  fix critical bug from last night
09:00  sprint planning (with yourself)
10:00  implement feature #47
12:00  lunch = debugging in your head
13:00  code review (reviewing your own code)
14:00  deployment (manual, scary)
15:00  marketing? tomorrow.
16:00  design? next week.
17:00  strategy? next month.
22:00  push to prod, pray`}
							</pre>
						</div>
					</div>
				</RevealSection>
			</section>

			{/* ── 3. SOLUTION ── */}
			<section className="border-b border-lp-border">
				<RevealSection>
					<div className="mx-auto max-w-[1200px] border-x border-lp-border px-4 md:px-8 py-16 md:py-24">
						<div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
							{/* Left labels */}
							<div className="lg:w-[28%] flex flex-row lg:flex-col gap-6 lg:gap-0">
								{[
									{ label: 'DEFINE', desc: 'Agents, roles, and workflows in YAML' },
									{ label: 'EXECUTE', desc: 'Agents work autonomously on tasks' },
									{ label: 'APPROVE', desc: 'You review and merge from your inbox' },
								].map((step, i) => (
									<div key={step.label} className="flex-1 lg:flex-initial relative">
										{/* Vertical connector line (desktop) */}
										{i < 2 && (
											<div className="hidden lg:block absolute left-[5px] top-8 bottom-0 w-px bg-lp-border" />
										)}
										<div className="flex lg:flex-row items-start gap-3 lg:pb-12">
											<div className="hidden lg:block w-[11px] h-[11px] border border-lp-purple bg-lp-bg mt-1 shrink-0" />
											<div>
												<span className="font-mono text-[10px] uppercase tracking-[0.15em] text-lp-purple font-semibold">
													{step.label}
												</span>
												<p className="font-sans text-sm text-lp-muted mt-1">{step.desc}</p>
											</div>
										</div>
									</div>
								))}
							</div>
							{/* Right code blocks */}
							<div className="lg:w-[72%] flex flex-col gap-4">
								<CodeBlock title="team/agents.yaml">
{`agents:
  - id: max
    role: developer
    tools: [fs, terminal, task, message]
    fs_scope:
      write: ["src/**", "tests/**"]`}
								</CodeBlock>
								<CodeBlock title="terminal — agents working">
{`[max] Writing src/components/PricingTable.tsx
[max] Running bun test -- 47 passed
[riley] Reviewing PR #23 — 2 issues found
[max] Fixing: unused import, missing error boundary
[riley] Approved \u2713`}
								</CodeBlock>
								<div className="bg-lp-bg border border-lp-border overflow-hidden">
									<div className="px-4 py-2 border-b border-lp-border">
										<span className="font-mono text-[11px] text-lp-ghost">inbox</span>
									</div>
									<div className="p-4 font-mono text-xs text-lp-fg leading-relaxed">
										<pre className="m-0 whitespace-pre overflow-x-auto lp-scrollbar">
{`\u250C\u2500 INBOX \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502                                \u2502
\u2502  \u25CF Merge PR #23 \u2014 PricingTable  \u2502
\u2502    Max completed, Riley approved \u2502
\u2502    [Approve] [Reject] [View Diff]\u2502
\u2502                                \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518`}
										</pre>
									</div>
								</div>
							</div>
						</div>
					</div>
				</RevealSection>
			</section>

			{/* ── 4. DASHBOARD ── */}
			<section className="border-b border-lp-border">
				<RevealSection>
					<div className="mx-auto max-w-[1200px] border-x border-lp-border px-4 md:px-8 py-16 md:py-24">
						<span className="font-mono text-[10px] uppercase tracking-[0.15em] text-lp-muted block mb-4">
							Dashboard
						</span>
						<h2
							className="font-mono font-bold text-lp-fg tracking-[-0.03em] mb-10"
							style={{ fontSize: 'clamp(22px, 3vw, 36px)' }}
						>
							Yes, it has a UI.
						</h2>
						{/* Screenshot area */}
						<div className="bg-lp-card border border-lp-border w-full aspect-[16/9] flex items-center justify-center overflow-hidden">
							<div className="p-6 md:p-10 w-full h-full flex flex-col">
								{/* Mock dashboard layout */}
								<div className="flex-1 flex gap-0 border border-lp-border">
									{/* Sidebar */}
									<div className="hidden md:flex flex-col w-[180px] border-r border-lp-border p-3 gap-2">
										<div className="font-mono text-[10px] text-lp-purple font-semibold uppercase tracking-[0.1em] mb-2">
											Navigation
										</div>
										{['Dashboard', 'Tasks', 'Agents', 'Sessions', 'Inbox', 'Settings'].map(
											(item) => (
												<div
													key={item}
													className="font-mono text-[11px] text-lp-muted py-1 px-2 hover:text-lp-fg"
												>
													{item}
												</div>
											),
										)}
									</div>
									{/* Main area — kanban */}
									<div className="flex-1 p-3 flex flex-col">
										<div className="font-mono text-[10px] text-lp-ghost uppercase tracking-[0.1em] mb-3">
											Task Board
										</div>
										<div className="flex-1 flex gap-2 overflow-x-auto">
											{[
												{
													col: 'Backlog',
													tasks: ['Setup CI/CD', 'Write docs'],
												},
												{
													col: 'In Progress',
													tasks: ['Pricing page', 'Auth flow'],
												},
												{ col: 'Review', tasks: ['Landing redesign'] },
												{ col: 'Done', tasks: ['API routes', 'DB schema'] },
											].map((column) => (
												<div
													key={column.col}
													className="flex-1 min-w-[120px] flex flex-col"
												>
													<div className="font-mono text-[9px] text-lp-muted uppercase tracking-wider mb-2">
														{column.col}
													</div>
													{column.tasks.map((t) => (
														<div
															key={t}
															className="bg-lp-surface border border-lp-border p-2 mb-1 font-mono text-[10px] text-lp-fg"
														>
															{t}
														</div>
													))}
												</div>
											))}
										</div>
									</div>
									{/* Right panel — agent stream */}
									<div className="hidden lg:flex flex-col w-[200px] border-l border-lp-border p-3">
										<div className="font-mono text-[10px] text-lp-ghost uppercase tracking-[0.1em] mb-3">
											Agent Session
										</div>
										<div className="font-mono text-[10px] text-lp-accent-green leading-relaxed">
											[max] writing PricingTable...
										</div>
										<div className="font-mono text-[10px] text-lp-muted leading-relaxed mt-1">
											[max] running tests...
										</div>
										<div className="font-mono text-[10px] text-lp-purple leading-relaxed mt-1">
											[riley] reviewing PR #23
										</div>
									</div>
								</div>
								{/* Status bar */}
								<div className="border border-t-0 border-lp-border px-3 py-1 flex items-center justify-between">
									<span className="font-mono text-[9px] text-lp-accent-green">
										● 3 agents online
									</span>
									<span className="font-mono text-[9px] text-lp-ghost">
										localhost:3000
									</span>
								</div>
							</div>
						</div>
						{/* Callouts */}
						<div className="grid grid-cols-1 md:grid-cols-3 gap-0 mt-8">
							{[
								'26 pages, all live, all real-time via SSE',
								'Cmd+K command palette with intent mode',
								'Mobile responsive \u2014 approve from your phone',
							].map((text) => (
								<div
									key={text}
									className="border-l-2 border-lp-purple pl-4 py-3 md:pr-4"
								>
									<p className="font-sans text-sm text-lp-muted m-0">{text}</p>
								</div>
							))}
						</div>
					</div>
				</RevealSection>
			</section>

			{/* ── 5. YAML = COMPANY ── */}
			<section className="border-b border-lp-border">
				<RevealSection>
					<div className="mx-auto max-w-[1200px] border-x border-lp-border px-4 md:px-8 py-16 md:py-24">
						<span className="font-mono text-[10px] uppercase tracking-[0.15em] text-lp-muted block mb-4">
							Configuration
						</span>
						<h2
							className="font-mono font-bold text-lp-fg tracking-[-0.03em] mb-3"
							style={{ fontSize: 'clamp(22px, 3vw, 36px)' }}
						>
							Your company is a git repo.
						</h2>
						<p className="font-sans text-base text-lp-muted mb-10 max-w-[560px]">
							Fork it, version it, back it up with <code className="font-mono text-xs text-lp-fg">cp</code>.
							Every agent, role, workflow, and secret is a file you control.
						</p>
						<FileTree />
					</div>
				</RevealSection>
			</section>

			{/* ── 6. SECURITY ── */}
			<section className="border-b border-lp-border">
				<RevealSection>
					<div className="mx-auto max-w-[1200px] border-x border-lp-border px-4 md:px-8 py-16 md:py-24">
						<div className="border-l-2 border-lp-accent-green bg-lp-card border-y border-r border-lp-border p-6 md:p-8">
							<span className="font-mono text-[10px] uppercase tracking-[0.15em] text-lp-accent-green font-semibold block mb-4">
								Security
							</span>
							<pre className="font-mono text-xs md:text-sm text-lp-fg leading-loose whitespace-pre-wrap m-0">
{`Better Auth \u00B7 2FA/TOTP \u00B7 RBAC (4 roles) \u00B7 AES-256-GCM secrets
IP allowlist \u00B7 Rate limiting \u00B7 SSRF protection \u00B7 Agent sandbox
Audit logs \u00B7 Webhook HMAC \u00B7 API keys \u00B7 Deny patterns`}
							</pre>
							<p className="font-sans text-sm text-lp-muted mt-4 mb-0">
								MIT license. Self-hosted. Your data stays on your machine.
							</p>
						</div>
					</div>
				</RevealSection>
			</section>

			{/* ── 7. INSTALL ── */}
			<section className="border-b border-lp-border">
				<RevealSection>
					<div className="mx-auto max-w-[1200px] border-x border-lp-border px-4 md:px-8 py-20 md:py-32 flex flex-col items-center text-center">
						<div className="bg-lp-card border border-lp-border p-6 md:p-8 mb-8 w-full max-w-[520px]">
							<pre className="font-mono text-sm md:text-base text-lp-fg leading-loose whitespace-pre m-0">
{`$ bun add -g @questpie/autopilot
$ autopilot init my-company
$ autopilot start`}
							</pre>
							<div className="mt-4 pt-4 border-t border-lp-border">
								<span className="font-mono text-xs text-lp-accent-green">
									→ Dashboard at http://localhost:3000
								</span>
							</div>
						</div>
						<div className="flex flex-wrap gap-3 justify-center">
							<a
								href="/docs/getting-started"
								className="font-mono text-sm font-semibold bg-lp-purple text-white px-6 py-3 border border-lp-purple hover:bg-[#9200CC] transition-colors no-underline inline-block"
							>
								Read the Docs
							</a>
							<a
								href="https://github.com/questpie/autopilot"
								target="_blank"
								rel="noopener noreferrer"
								className="font-mono text-sm font-semibold text-lp-fg px-6 py-3 border border-lp-border hover:border-lp-purple transition-colors no-underline inline-block"
							>
								Star on GitHub
							</a>
						</div>
					</div>
				</RevealSection>
			</section>

			{/* ── 8. FOOTER ── */}
			<footer className="border-b border-lp-border">
				<div className="mx-auto max-w-[1200px] border-x border-lp-border px-4 md:px-8 py-6">
					<div className="flex flex-col md:flex-row items-center justify-between gap-4">
						<div className="flex items-center gap-2 text-lp-ghost">
							<QSymbol size={16} />
							<span className="font-mono text-[11px]">QUESTPIE s.r.o.</span>
						</div>
						<nav className="flex items-center gap-4 md:gap-6">
							{[
								{ label: 'Docs', href: '/docs' },
								{ label: 'GitHub', href: 'https://github.com/questpie/autopilot' },
								{ label: 'Features', href: '/docs/features' },
							].map((link) => (
								<a
									key={link.label}
									href={link.href}
									className="font-mono text-[11px] text-lp-ghost hover:text-lp-fg transition-colors no-underline"
									{...(link.href.startsWith('http')
										? { target: '_blank', rel: 'noopener noreferrer' }
										: {})}
								>
									{link.label}
								</a>
							))}
						</nav>
						<span className="font-mono text-[11px] text-lp-ghost">
							MIT License &middot; Open Source
						</span>
					</div>
				</div>
			</footer>
		</div>
	)
}
