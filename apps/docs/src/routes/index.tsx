import { createFileRoute } from '@tanstack/react-router'
import {
	ArrowRight,
	BookOpen,
	CheckCircle,
	FileCode2,
	GitBranch,
	Layers,
	Monitor,
	Search,
	Shield,
	Terminal,
	Workflow,
} from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

export const Route = createFileRoute('/')({
	component: LandingPage,
})

/* ─── Helpers ─── */

function QuestpieLogo({ className }: { className?: string }) {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className={className}
		>
			<path
				d="M22 10V2H2V22H10"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="square"
			/>
			<path d="M23 13H13V23H23V13Z" fill="#B700FF" />
		</svg>
	)
}

function Badge({ children }: { children: ReactNode }) {
	return (
		<span className="bg-secondary text-primary px-2 py-0.5 font-mono text-[11px] font-semibold tracking-[0.04em] uppercase">
			{children}
		</span>
	)
}

function BrutalistGrid({
	children,
	className,
}: {
	children: ReactNode
	className?: string
}) {
	return (
		<div
			className={cn(
				'bg-border border-border grid grid-cols-1 gap-[1px] border md:grid-cols-2',
				className,
			)}
		>
			{children}
		</div>
	)
}

function FeatureCell({
	num,
	title,
	desc,
	icon: Icon,
}: {
	num: string
	title: string
	desc: string
	icon: React.ComponentType<{ className?: string }>
}) {
	return (
		<div className="bg-background hover:outline-primary flex h-full flex-col p-6 transition-colors hover:outline hover:outline-1 hover:-outline-offset-1">
			<div className="text-primary mb-4 flex items-center gap-2 font-mono text-[10px] tracking-[3px]">
				<Icon className="h-4 w-4" />
				{num}
			</div>
			<h3 className="text-foreground mb-2 font-mono text-[14px] font-bold">{title}</h3>
			<p className="text-muted-foreground text-[13px] leading-[1.5]">{desc}</p>
		</div>
	)
}

function SectionHeader({
	num,
	title,
	subtitle,
}: {
	num: string
	title: string
	subtitle: string
}) {
	return (
		<div className="mb-12">
			<div className="text-primary mb-4 font-mono text-sm tracking-[3px]">{num}</div>
			<h2 className="text-foreground mb-4 font-mono text-3xl font-bold md:text-4xl">{title}</h2>
			<p className="text-muted-foreground max-w-2xl text-lg">{subtitle}</p>
		</div>
	)
}

function Reveal({ children, className }: { children: ReactNode; className?: string }) {
	return (
		<div
			data-reveal
			className={cn(
				'translate-y-3 opacity-0 transition-[opacity,transform] duration-500 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] data-[visible]:translate-y-0 data-[visible]:opacity-100',
				className,
			)}
		>
			{children}
		</div>
	)
}

function HeroProofPanel() {
	const timeline = [
		{
			label: 'Intake',
			title: 'Task captured',
			desc: 'Issue, repo, branch policy, and acceptance criteria are attached.',
			state: 'done',
		},
		{
			label: 'Run',
			title: 'Worker claimed',
			desc: 'The host already has the repo, toolchain, secrets, and network access.',
			state: 'done',
		},
		{
			label: 'Review',
			title: 'Waiting for decision',
			desc: 'Preview, patch, logs, and summary stay available after the run.',
			state: 'active',
		},
	]

	return (
		<div className="border-border bg-border grid min-w-0 max-w-[calc(100vw-2rem)] gap-[1px] border lg:max-w-none">
			<div className="bg-background p-4 md:p-5">
				<div className="mb-4 flex items-start justify-between gap-4">
					<div>
						<div className="text-primary mb-2 font-mono text-[10px] font-semibold tracking-[0.18em] uppercase">
							Operator state
						</div>
						<h3 className="text-foreground max-w-sm font-mono text-lg leading-tight font-bold">
							Checkout regression is ready for human review.
						</h3>
					</div>
					<div className="bg-primary text-primary-foreground shrink-0 px-2 py-1 font-mono text-[10px] font-bold tracking-[0.12em] uppercase">
						Review
					</div>
				</div>

				<div className="border-border bg-secondary grid grid-cols-2 border">
					<div className="border-border border-r p-3">
						<div className="text-muted-foreground mb-1 font-mono text-[10px] tracking-[0.14em] uppercase">
							Worker
						</div>
						<div className="flex items-center gap-2 font-mono text-sm font-semibold">
							<Monitor className="text-primary h-4 w-4" />
							laptop-m3
						</div>
					</div>
					<div className="p-3">
						<div className="text-muted-foreground mb-1 font-mono text-[10px] tracking-[0.14em] uppercase">
							Runtime
						</div>
						<div className="flex items-center gap-2 font-mono text-sm font-semibold">
							<Terminal className="text-primary h-4 w-4" />
							Claude Code
						</div>
					</div>
				</div>
			</div>

			<div className="bg-background p-4 md:p-5">
				<div className="space-y-3">
					{timeline.map(({ label, title, desc, state }) => (
						<div key={title} className="border-border grid grid-cols-[72px_minmax(0,1fr)] border sm:grid-cols-[84px_minmax(0,1fr)]">
							<div className="border-border flex items-center justify-center border-r p-3">
								<span
									className={cn(
										'font-mono text-[10px] font-semibold tracking-[0.14em] uppercase',
										state === 'active' ? 'text-primary' : 'text-muted-foreground',
									)}
								>
									{label}
								</span>
							</div>
							<div className="p-3">
								<div className="flex items-center gap-2">
									<CheckCircle
										className={cn(
											'h-4 w-4 shrink-0',
											state === 'active' ? 'text-primary' : 'text-muted-foreground',
										)}
									/>
									<div className="font-mono text-sm font-semibold">{title}</div>
								</div>
								<div className="text-muted-foreground mt-1 text-sm leading-5">{desc}</div>
							</div>
						</div>
					))}
				</div>

				<div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
					<div className="border-border bg-secondary p-3">
						<div className="text-muted-foreground mb-2 font-mono text-[10px] tracking-[0.14em] uppercase">
							Artifacts
						</div>
						<div className="space-y-1 font-mono text-[12px]">
							<div className="flex items-center gap-2">
								<FileCode2 className="text-primary h-3.5 w-3.5" />
								patch.diff
							</div>
							<div className="flex items-center gap-2">
								<Layers className="text-primary h-3.5 w-3.5" />
								preview URL
							</div>
						</div>
					</div>
					<div className="border-border bg-secondary p-3">
						<div className="text-muted-foreground mb-2 font-mono text-[10px] tracking-[0.14em] uppercase">
							Decision
						</div>
						<div className="space-y-1 font-mono text-[12px]">
							<div className="bg-primary text-primary-foreground px-2 py-1">Approve</div>
							<div className="border-border border px-2 py-1">Reply with feedback</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

function TrustStrip() {
	const items = [
		['01', 'Bring your runtime', 'Autopilot wraps the AI CLI and subscription you already trust.'],
		['02', 'Run where access exists', 'Workers execute on machines with the repo, VPN, tools, and credentials.'],
		['03', 'Keep the evidence', 'Summaries, artifacts, previews, logs, and decisions survive the session.'],
		['04', 'Gate risky work', 'Human approval or feedback is an explicit step, not a buried chat message.'],
	] as const

	return (
		<div className="border-border bg-border grid grid-cols-1 gap-[1px] border md:grid-cols-4">
			{items.map(([num, title, desc]) => (
				<div key={title} className="bg-background p-4">
					<div className="text-primary mb-3 font-mono text-[10px] font-semibold tracking-[0.18em] uppercase">
						{num}
					</div>
					<div className="mb-2 font-mono text-[13px] font-bold">{title}</div>
					<p className="text-muted-foreground text-[12px] leading-5">{desc}</p>
				</div>
			))}
		</div>
	)
}

/* ─── Nav ─── */

function Nav() {
	const [mobileOpen, setMobileOpen] = useState(false)

	return (
		<header className="bg-background border-border fixed inset-x-0 top-0 z-50 h-14 border-b transition-colors duration-200">

			<div className="border-border bg-background mx-auto flex h-full max-w-[1200px] items-center justify-between border-x px-4 md:px-8">
				<div className="flex items-center gap-8">
					<a href="/" className="flex items-center gap-2">
						<QuestpieLogo />
						<span className="font-mono text-sm font-bold tracking-tight">Autopilot</span>
					</a>

					<div className="text-muted-foreground hidden items-center gap-6 font-mono text-[12px] font-medium md:flex">
						<a href="/docs" className="hover:text-foreground transition-colors">
							Docs
						</a>
						<a
							href="https://github.com/questpie/autopilot"
							target="_blank"
							rel="noreferrer"
							className="hover:text-foreground transition-colors"
						>
							GitHub
						</a>
					</div>
				</div>

				<div className="flex items-center gap-4">
					<a
						href="/docs/quickstart"
						className="bg-primary text-primary-foreground hover:bg-primary/80 hidden items-center px-4 py-2 font-mono text-[13px] font-semibold tracking-[0.04em] uppercase transition-colors sm:inline-flex"
					>
						Quickstart
					</a>
					<button
						type="button"
						className="text-muted-foreground hover:text-foreground p-1.5 transition-colors md:hidden"
						onClick={() => setMobileOpen((v) => !v)}
						aria-label="Toggle navigation"
					>
						<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
							{mobileOpen ? (
								<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
							) : (
								<path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
							)}
						</svg>
					</button>
				</div>
			</div>

			{mobileOpen && (
				<div className="border-border bg-background absolute inset-x-0 top-full border-b p-4 md:hidden">
					<div className="mx-auto flex max-w-[1200px] flex-col gap-3">
						<a href="/docs" className="text-muted-foreground font-mono text-sm" onClick={() => setMobileOpen(false)}>
							Docs
						</a>
						<a href="https://github.com/questpie/autopilot" target="_blank" rel="noreferrer" className="text-muted-foreground font-mono text-sm" onClick={() => setMobileOpen(false)}>
							GitHub
						</a>
						<div className="bg-border my-1 h-px" />
						<a
							href="/docs/quickstart"
							className="bg-primary text-primary-foreground inline-flex h-7 items-center px-3 font-mono text-[10px] tracking-wider uppercase"
							onClick={() => setMobileOpen(false)}
						>
							Quickstart
						</a>
					</div>
				</div>
			)}
		</header>
	)
}

/* ─── Landing Page ─── */

function LandingPage() {
	useEffect(() => {
		const obs = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (e.isIntersecting) e.target.setAttribute('data-visible', '')
				}
			},
			{ threshold: 0.1 },
		)
		document.querySelectorAll('[data-reveal]').forEach((el) => obs.observe(el))
		return () => obs.disconnect()
	}, [])

	return (
		<div className="bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
			<Nav />

			<main className="bg-grid-quest">
				<div className="border-border mx-auto max-w-[1200px] border-x">
					{/* ─── HERO ─── */}
					<section className="landing-hero mt-14 px-4 py-18 md:px-8 md:py-20">
						<div className="grid min-w-0 grid-cols-1 items-start gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
							<div className="min-w-0 max-w-[calc(100vw-2rem)] lg:max-w-none">
								<div className="text-primary mb-6 font-mono text-[12px] font-semibold tracking-[0.04em] uppercase">
									AI operator layer for real work
								</div>
								<h1 className="text-foreground mb-6 font-mono text-4xl leading-[1.1] font-extrabold tracking-normal break-words md:text-5xl">
									Autopilot operates AI work after the chat ends
								</h1>
								<p className="text-muted-foreground mb-8 max-w-xl text-base leading-[1.6] md:text-xl">
									AI tools can answer and edit. Autopilot turns a request into durable work:
									a task, a claimed worker run, reviewable artifacts, and a human decision
									before anything risky moves forward.
								</p>
								<div className="mb-8 flex flex-wrap items-center gap-4">
									<a
										href="/docs/quickstart"
										className="bg-primary text-primary-foreground hover:bg-primary/80 inline-flex items-center gap-2 px-4 py-2 font-mono text-[13px] font-semibold tracking-[0.04em] uppercase transition-[background-color,transform] active:scale-[0.98]"
									>
										Quickstart <ArrowRight className="h-4 w-4" />
									</a>
									<a
										href="#proof-loop"
										className="border-border text-foreground hover:bg-secondary inline-flex items-center gap-2 border px-4 py-2 font-mono text-[13px] font-semibold tracking-[0.04em] uppercase transition-[background-color,transform] active:scale-[0.98]"
									>
										See the operator loop
									</a>
								</div>
								<p className="text-muted-foreground mb-5 max-w-2xl text-sm leading-[1.7]">
									Self-hosted control plane over your CLI, API, MCP, and worker machines.
									Claude Code is the proven runtime today; additional adapters stay behind
									the same worker contract.
								</p>
								<div className="flex flex-wrap gap-2">
									{['Operator layer', 'Worker-local access', 'Durable artifacts', 'Human gates', 'Self-hosted'].map((t) => (
										<Badge key={t}>{t}</Badge>
									))}
								</div>
							</div>

							<HeroProofPanel />
						</div>
						<div className="mt-10">
							<TrustStrip />
						</div>
					</section>

					{/* ─── §01 THE OPERATING LOOP ─── */}
					<Reveal>
						<section id="proof-loop" className="border-border border-t px-4 py-16 md:px-8 md:py-24">
							<SectionHeader
								num="01"
								title="From request to decision"
								subtitle="Autopilot gives AI work a controlled path through task state, worker execution, artifacts, and approval."
							/>
							<div className="bg-border border-border grid grid-cols-1 gap-[1px] border md:grid-cols-5">
								<FeatureCell
									num="01"
									icon={Terminal}
									title="Capture the task"
									desc="Create work from the CLI, API, MCP, conversation, or Operator Web. The request becomes durable state."
								/>
								<FeatureCell
									num="02"
									icon={Workflow}
									title="Resolve the route"
									desc="Repo-authored policy picks the workflow, instructions, runtime, and next checkpoint."
								/>
								<FeatureCell
									num="03"
									icon={Monitor}
									title="Claim the worker"
									desc="A worker runs on the host that already has the repo, toolchain, credentials, and network access."
								/>
								<FeatureCell
									num="04"
									icon={FileCode2}
									title="Return proof"
									desc="The run finishes with a summary, logs, artifacts, diffs, and durable previews for review."
								/>
								<FeatureCell
									num="05"
									icon={Shield}
									title="Decide the next step"
									desc="Approve to continue, reject, or reply with feedback that becomes the next worker pass."
								/>
							</div>
						</section>
					</Reveal>

					{/* ─── §02 WHO IT'S FOR ─── */}
					<Reveal>
						<section className="border-border border-t px-4 py-16 md:px-8 md:py-24">
							<SectionHeader
								num="02"
								title="Built for work that needs evidence"
								subtitle="Start with engineering work because it proves the hard parts: repo access, repeatable execution, reviewable output, and explicit approval."
							/>
							<BrutalistGrid className="md:grid-cols-2">
								<FeatureCell
									num="01"
									icon={GitBranch}
									title="Feature work across real repos"
									desc="Implement, test, preview, and review changes without losing the thread in a chat transcript."
								/>
								<FeatureCell
									num="02"
									icon={Monitor}
									title="Machine-bound access"
									desc="The work depends on a VPN, staging host, local toolchain, or private network. Where execution happens matters."
								/>
								<FeatureCell
									num="03"
									icon={Shield}
									title="Review before merge or deploy"
									desc="Risky work needs a human gate. Autopilot stops, surfaces the result, and waits for an explicit decision."
								/>
								<FeatureCell
									num="04"
									icon={Layers}
									title="Research and content with provenance"
									desc="Competitor briefs, docs audits, launch drafts, and reports move through the same artifact-and-review loop."
								/>
							</BrutalistGrid>
						</section>
					</Reveal>

					{/* ─── §03 WHY NOT CHAT-FIRST ─── */}
					<Reveal>
						<section className="border-border border-t px-4 py-16 md:px-8 md:py-24">
							<SectionHeader
								num="03"
								title="Why this is not another agent"
								subtitle="Agents do the work. Autopilot owns task state, routing, machine execution, artifacts, and the human gate around that work."
							/>
							<BrutalistGrid className="md:grid-cols-2">
								<FeatureCell
									num="01"
									icon={Terminal}
									title="Agents are workers, not memory"
									desc="Task state, run history, event logs, artifacts, and human decisions need to survive beyond the current session."
								/>
								<FeatureCell
									num="02"
									icon={Monitor}
									title="Execution surface matters"
									desc="When work depends on the repo, the toolchain, local credentials, or a private network, you can't abstract the machine away."
								/>
								<FeatureCell
									num="03"
									icon={FileCode2}
									title="Policy belongs in the repo"
									desc="Workflows and execution rules live in `.autopilot/`, next to the code — diffable, reviewable, changeable like any other config."
								/>
								<FeatureCell
									num="04"
									icon={Layers}
									title="Review needs a surface"
									desc="A durable preview URL and explicit approve/reject/reply actions are stronger than asking someone to scroll through generated text."
								/>
							</BrutalistGrid>
						</section>
					</Reveal>

					{/* ─── §04 WHAT IS REAL TODAY ─── */}
					<Reveal>
						<section className="border-border border-t px-4 py-16 md:px-8 md:py-24">
							<SectionHeader
								num="04"
								title="What you can run today"
								subtitle="The CLI, API, MCP, conversations, and Operator Web all compose the same operator loop."
							/>
							<div className="bg-border border-border grid grid-cols-1 gap-[1px] border sm:grid-cols-2">
								{[
									'Implement a feature end-to-end: spec, plan, code, preview, review.',
									'Investigate an incident: triage, inspect, patch, verify, hand back evidence.',
									'Generate a competitor or pricing brief from explicit sources.',
									'Draft a blog post and route it for review before publication.',
									'Prepare launch and social copy with approval before provider handoff.',
									'Assemble an executive update from artifacts and hand it to a reviewer.',
								].map((text) => (
									<div key={text} className="bg-background flex items-start gap-3 p-5">
										<CheckCircle className="text-primary mt-0.5 h-4 w-4 shrink-0" />
										<span className="text-[13px]">{text}</span>
									</div>
								))}
							</div>
						</section>
					</Reveal>

					{/* ─── §05 SAME LOOP, BEYOND CODE ─── */}
					<Reveal>
						<section className="border-border border-t px-4 py-16 md:px-8 md:py-24">
							<SectionHeader
								num="05"
								title="The same loop, beyond code"
								subtitle="Once the task, worker, artifact, and approval primitives are in place, the same loop carries research, content, and operations."
							/>
							<div className="bg-border border-border grid grid-cols-1 gap-[1px] border md:grid-cols-3">
								<FeatureCell
									num="01"
									icon={GitBranch}
									title="Engineering"
									desc={'"Implement dark mode" \u2192 plan \u2192 code \u2192 preview \u2192 approve \u2192 deploy'}
								/>
								<FeatureCell
									num="02"
									icon={Search}
									title="Research"
									desc={'"Monitor competitor pricing" \u2192 scrape \u2192 analyze \u2192 brief \u2192 human review'}
								/>
								<FeatureCell
									num="03"
									icon={BookOpen}
									title="Content"
									desc={'"Write launch blog post" \u2192 research \u2192 draft \u2192 preview \u2192 approve \u2192 publish via API'}
								/>
							</div>
						</section>
					</Reveal>

					{/* ─── CTA ─── */}
					<section className="border-border border-t px-4 py-24 text-center md:px-8 md:py-32">
						<div className="mb-8">
							<QuestpieLogo className="mx-auto h-12 w-12" />
						</div>
						<h2 className="text-foreground mb-6 font-mono text-4xl font-extrabold md:text-5xl">
							Run one operator loop on a real repo
						</h2>
						<p className="text-muted-foreground mx-auto mb-8 max-w-2xl text-lg leading-8">
							Start with a task that needs the repo, the toolchain, and a human decision.
						</p>
						<div className="bg-secondary border-border mb-8 inline-flex items-center gap-4 border px-6 py-3">
							<span className="text-primary font-mono">$</span>
							<span className="font-mono text-[14px]">bun add -g @questpie/autopilot</span>
						</div>
						<div className="flex flex-wrap items-center justify-center gap-4">
							<a
								href="/docs/quickstart"
								className="bg-primary text-primary-foreground hover:bg-primary/80 inline-flex items-center gap-2 px-4 py-2 font-mono text-[13px] font-semibold tracking-[0.04em] uppercase transition-colors"
							>
								Quickstart <ArrowRight className="h-4 w-4" />
							</a>
							<a
								href="/docs/architecture"
								className="border-border text-foreground hover:bg-secondary inline-flex items-center gap-2 border px-4 py-2 font-mono text-[13px] font-semibold tracking-[0.04em] uppercase transition-colors"
							>
								How it works
							</a>
							<a
								href="https://github.com/questpie/autopilot"
								target="_blank"
								rel="noreferrer"
								className="text-primary inline-flex items-center gap-2 bg-transparent font-mono text-[13px] font-semibold tracking-[0.04em] uppercase hover:underline"
							>
								GitHub
							</a>
						</div>
					</section>
				</div>
			</main>

			{/* ─── Footer ─── */}
			<footer className="border-border border-t">
				<div className="border-border mx-auto max-w-[1200px] border-x px-4 py-12 md:px-8">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<QuestpieLogo className="h-4 w-4" />
							<span className="font-mono text-xs font-bold">QUESTPIE Autopilot</span>
						</div>
						<span className="text-muted-foreground text-xs">Open source. MIT license.</span>
					</div>
				</div>
			</footer>
		</div>
	)
}
