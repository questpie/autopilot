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
				'translate-y-3 opacity-0 transition-all duration-500 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] data-[visible]:translate-y-0 data-[visible]:opacity-100',
				className,
			)}
		>
			{children}
		</div>
	)
}

function HeroProofPanel() {
	const proofPoints = [
		{
			title: 'Task becomes workflow state',
			desc: 'Runs, artifacts, and previews stay durable — not trapped in a session.',
		},
		{
			title: 'Worker executes on the right machine',
			desc: 'The host already has the repo, the toolchain, and the credentials.',
		},
		{
			title: 'Human decides what ships',
			desc: 'Approve the result, or reply with feedback for another pass.',
		},
	]

	return (
		<div className="border-border bg-border grid gap-[1px] border">
			<div className="bg-background p-5 md:p-6">
				<div className="text-primary mb-3 font-mono text-[11px] font-semibold tracking-[0.2em] uppercase">
					Proof loop
				</div>
				<h3 className="text-foreground mb-2 font-mono text-xl leading-tight font-bold">
					Task in, reviewable result out.
				</h3>
				<p className="text-muted-foreground text-sm leading-6">
					No transcript archaeology.
				</p>
			</div>

			<div className="bg-background p-5 md:p-6">
				<div className="space-y-3">
					{proofPoints.map(({ title, desc }, index) => (
						<div key={title} className="border-border flex gap-3 border p-3">
							<div className="text-primary font-mono text-[11px] tracking-[0.18em] uppercase">
								0{index + 1}
							</div>
							<div>
								<div className="font-mono text-sm font-semibold">{title}</div>
								<div className="text-muted-foreground mt-1 text-sm leading-5">{desc}</div>
							</div>
						</div>
					))}
				</div>
			</div>
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
						<div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
							<div>
								<div className="text-primary mb-6 font-mono text-[12px] font-semibold tracking-[0.04em] uppercase">
									Workflow-driven AI operator
								</div>
								<h1 className="text-foreground mb-6 font-mono text-4xl leading-[1.1] font-extrabold tracking-[-0.03em] text-balance md:text-5xl">
									Run AI work where your code, tools, and access already live
								</h1>
								<p className="text-muted-foreground mb-8 max-w-xl text-lg leading-[1.6] md:text-xl">
									Autopilot runs work on the machine that has the repo, sends back a reviewable
									preview, and waits for a human to decide what ships.
								</p>
								<div className="mb-8 flex flex-wrap items-center gap-4">
									<a
										href="/docs/quickstart"
										className="bg-primary text-primary-foreground hover:bg-primary/80 inline-flex items-center gap-2 px-4 py-2 font-mono text-[13px] font-semibold tracking-[0.04em] uppercase transition-colors"
									>
										Quickstart <ArrowRight className="h-4 w-4" />
									</a>
									<a
										href="#proof-loop"
										className="border-border text-foreground hover:bg-secondary inline-flex items-center gap-2 border px-4 py-2 font-mono text-[13px] font-semibold tracking-[0.04em] uppercase transition-colors"
									>
										How it works
									</a>
								</div>
								<p className="text-muted-foreground mb-5 max-w-2xl text-sm leading-[1.7]">
									Shipping today: workflow-driven runs, worker routing, durable previews,
									approval loops, structured artifacts.
								</p>
								<div className="flex flex-wrap gap-2">
									{['CLI-first', 'Repo-native', 'Durable previews', 'Approval-aware'].map((t) => (
										<Badge key={t}>{t}</Badge>
									))}
								</div>
							</div>

							<HeroProofPanel />
						</div>
					</section>

					{/* ─── §01 THE OPERATING LOOP ─── */}
					<Reveal>
						<section id="proof-loop" className="border-border border-t px-4 py-16 md:px-8 md:py-24">
							<SectionHeader
								num="01"
								title="The loop is the product"
								subtitle="Work moves through a controlled, inspectable loop — not a conversation you have to scroll back through."
							/>
							<div className="bg-border border-border grid grid-cols-1 gap-[1px] border md:grid-cols-5">
								<FeatureCell
									num="01"
									icon={Terminal}
									title="Start with a task"
									desc="Create work from the CLI. Intake attaches the right workflow — no ad hoc prompt choreography."
								/>
								<FeatureCell
									num="02"
									icon={Workflow}
									title="Workflow decides the next step"
									desc="Repo-authored policy picks the agent, the instructions, and what runs next."
								/>
								<FeatureCell
									num="03"
									icon={Monitor}
									title="Worker executes where access exists"
									desc="The right worker claims the run on a host that already has the repo, toolchain, and credentials."
								/>
								<FeatureCell
									num="04"
									icon={FileCode2}
									title="Result comes back reviewable"
									desc="The run finishes with a summary, artifacts, and a durable preview URL — available after the worker is gone."
								/>
								<FeatureCell
									num="05"
									icon={Shield}
									title="Human decides what moves forward"
									desc="Approve to continue, or reply with feedback that becomes the next implementation pass."
								/>
							</div>
						</section>
					</Reveal>

					{/* ─── §02 WHO IT'S FOR ─── */}
					<Reveal>
						<section className="border-border border-t px-4 py-16 md:px-8 md:py-24">
							<SectionHeader
								num="02"
								title="Who this is for"
								subtitle="Teams whose AI work touches real repos, real machines, and real approval gates."
							/>
							<BrutalistGrid className="md:grid-cols-2">
								<FeatureCell
									num="01"
									icon={GitBranch}
									title="Small engineering teams"
									desc="Multiple repos, client environments, limited bandwidth. You need durable runs and review loops, not more prompt wrangling."
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
									title="Teams producing recurring research or reports"
									desc="Weekly summaries, competitor briefs, docs audits — through a controlled loop with durable outputs, not one-off prompts."
								/>
							</BrutalistGrid>
						</section>
					</Reveal>

					{/* ─── §03 WHY NOT CHAT-FIRST ─── */}
					<Reveal>
						<section className="border-border border-t px-4 py-16 md:px-8 md:py-24">
							<SectionHeader
								num="03"
								title="Why workflow-first beats chat-first"
								subtitle="A conversation is the wrong primitive for routing, policy, previews, and approvals."
							/>
							<BrutalistGrid className="md:grid-cols-2">
								<FeatureCell
									num="01"
									icon={Terminal}
									title="A transcript is not a control plane"
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
									title="Review needs real surfaces"
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
								subtitle="No Worker App needed. The CLI and API already expose the full operator loop."
							/>
							<div className="bg-border border-border grid grid-cols-1 gap-[1px] border sm:grid-cols-2">
								{[
									'Implement a feature end-to-end: spec, plan, code, review, deploy.',
									'Respond to an incident: triage, investigate, hotfix, deploy, verify.',
									'Monitor competitors: scrape changelogs, analyze changes, produce a brief.',
									'Draft a blog post, get human approval, publish via CMS webhook.',
									'Generate an executive report from task activity and deliver via Slack.',
									'Maintain internal knowledge: scan for changes, update docs, human review.',
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
								subtitle="The operator loop is domain-agnostic. The same primitives that implement a feature also produce a research brief or publish a blog post."
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
							Run the loop on a real repo
						</h2>
						<p className="text-muted-foreground mx-auto mb-8 max-w-2xl text-lg leading-8">
							Create a task. Inspect the run. Open the preview. Decide what ships.
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
