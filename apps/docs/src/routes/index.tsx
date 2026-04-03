import { createFileRoute, Link } from '@tanstack/react-router'
import {
	ArrowRight,
	Box,
	CheckCircle,
	FileCode2,
	GitBranch,
	Layers,
	Monitor,
	Play,
	Shield,
	Terminal,
	Workflow,
} from 'lucide-react'

export const Route = createFileRoute('/')({
	component: LandingPage,
})

function QuestpieLogo({ className }: { className?: string }) {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
			<path d="M22 10V2H2V22H10" stroke="currentColor" strokeWidth="2" strokeLinecap="square"/>
			<path d="M23 13H13V23H23V13Z" fill="#B700FF"/>
		</svg>
	)
}

function LandingPage() {
	return (
		<div className="landing-grid min-h-screen">
			<Nav />
			<Hero />
			<HowItWorks />
			<Architecture />
			<WhyDifferent />
			<ProofLoop />
			<CTA />
			<Footer />
		</div>
	)
}

function Nav() {
	return (
		<nav className="border-border/50 sticky top-0 z-50 border-b bg-[var(--background)]/80 backdrop-blur-sm">
			<div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
				<Link to="/" className="flex items-center gap-2 font-mono text-sm font-bold tracking-tight">
					<QuestpieLogo />
					QUESTPIE Autopilot
				</Link>
				<div className="flex items-center gap-6">
					<Link
						to="/docs"
						className="text-muted-foreground hover:text-foreground font-mono text-xs transition-colors"
					>
						Docs
					</Link>
					<a
						href="https://github.com/questpie/autopilot"
						target="_blank"
						rel="noopener noreferrer"
						className="text-muted-foreground hover:text-foreground font-mono text-xs transition-colors"
					>
						GitHub
					</a>
				</div>
			</div>
		</nav>
	)
}

function Hero() {
	return (
		<section className="landing-hero">
			<div className="mx-auto max-w-5xl px-6 pb-20 pt-24 md:pb-28 md:pt-32">
				<div className="font-mono text-primary mb-6 text-xs uppercase tracking-widest">
					Workflow-driven AI execution
				</div>
				<h1 className="mb-6 max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-5xl lg:text-6xl">
					Run AI work where your code, tools, and access already live
				</h1>
				<p className="text-muted-foreground mb-10 max-w-2xl text-lg leading-relaxed md:text-xl">
					Autopilot turns tasks into workflow-driven execution across repo-native config, local
					workers, approvals, and external actions. No centralizing secrets. No chat transcripts
					pretending to be operations.
				</p>
				<div className="flex flex-wrap gap-4">
					<Link
						to="/docs/quickstart"
						className="bg-primary text-primary-foreground inline-flex items-center gap-2 px-5 py-2.5 font-mono text-sm font-semibold transition-opacity hover:opacity-90"
					>
						Get started
						<ArrowRight className="h-4 w-4" />
					</Link>
					<Link
						to="/docs"
						className="border-border text-foreground inline-flex items-center gap-2 border px-5 py-2.5 font-mono text-sm font-semibold transition-colors hover:bg-[var(--secondary)]"
					>
						Read the docs
					</Link>
				</div>
			</div>
		</section>
	)
}

function HowItWorks() {
	const steps = [
		{
			num: '01',
			icon: Terminal,
			title: 'Submit intent',
			desc: 'Create a task via CLI, intake provider, or conversation binding. Intent becomes a real task with workflow assignment.',
		},
		{
			num: '02',
			icon: Workflow,
			title: 'Workflow decides',
			desc: 'Authored YAML workflows determine step progression, routing, and what approvals are needed.',
		},
		{
			num: '03',
			icon: Monitor,
			title: 'Worker executes',
			desc: 'A worker on a real machine claims the run. It has the repo, the toolchain, the credentials. Execution happens where access exists.',
		},
		{
			num: '04',
			icon: Shield,
			title: 'Review and continue',
			desc: 'Operator gets notified. Previews are durable. Approve, reject, or reply. The workflow continues.',
		},
	]

	return (
		<section className="border-border border-t">
			<div className="mx-auto max-w-5xl px-6 py-20 md:py-28">
				<SectionHeader label="How it works" title="The operating loop" />
				<div className="grid gap-8 md:grid-cols-2">
					{steps.map((step) => (
						<div key={step.num} className="border-border border bg-[var(--card)] p-6">
							<div className="mb-4 flex items-center gap-3">
								<span className="font-mono text-primary text-xs font-bold">{step.num}</span>
								<step.icon className="text-muted-foreground h-4 w-4" />
							</div>
							<h3 className="mb-2 text-lg font-semibold">{step.title}</h3>
							<p className="text-muted-foreground text-sm leading-relaxed">{step.desc}</p>
						</div>
					))}
				</div>
			</div>
		</section>
	)
}

function Architecture() {
	const layers = [
		{
			icon: FileCode2,
			title: 'Policy in git',
			desc: 'Agents, workflows, environments, providers — all authored YAML under .autopilot/ in your repo. Reviewable, versioned, branchable.',
		},
		{
			icon: Layers,
			title: 'State in orchestrator',
			desc: 'Tasks, runs, workers, leases, events, artifacts. The orchestrator owns operational truth. Not your worker, not a chat log.',
		},
		{
			icon: Box,
			title: 'Secrets on worker',
			desc: 'Raw sessions, credentials, worktrees, local runtime state. Never leaves the machine. Never centralized.',
		},
	]

	return (
		<section className="border-border border-t bg-[var(--card)]">
			<div className="mx-auto max-w-5xl px-6 py-20 md:py-28">
				<SectionHeader label="Architecture" title="Three truth boundaries" />
				<p className="text-muted-foreground mb-10 max-w-2xl text-base leading-relaxed">
					Autopilot keeps authored policy in git, operational state in the orchestrator, and
					secrets/runtime state on the worker. Each boundary has a clear owner.
				</p>
				<div className="grid gap-6 md:grid-cols-3">
					{layers.map((layer) => (
						<div key={layer.title} className="border-border border bg-[var(--background)] p-6">
							<div className="mb-4 flex h-9 w-9 items-center justify-center border border-[rgba(183,0,255,0.25)] bg-[rgba(183,0,255,0.08)]">
								<layer.icon className="text-primary h-4 w-4" />
							</div>
							<h3 className="mb-2 font-semibold">{layer.title}</h3>
							<p className="text-muted-foreground text-sm leading-relaxed">{layer.desc}</p>
						</div>
					))}
				</div>
			</div>
		</section>
	)
}

function WhyDifferent() {
	const points = [
		{
			icon: GitBranch,
			title: 'Repo-native',
			desc: 'Config lives with code. No external dashboard is the source of truth.',
		},
		{
			icon: Play,
			title: 'Workflow-first, not chat-first',
			desc: 'Work progresses through tasks, workflows, runs, and approvals. Not endless chat transcripts.',
		},
		{
			icon: Shield,
			title: 'Approval-aware',
			desc: 'Human review is part of the execution model, not an afterthought. Gate risky steps explicitly.',
		},
		{
			icon: Monitor,
			title: 'Runs where access exists',
			desc: 'Workers execute on the machine with the repo, toolchain, and credentials. No centralizing secrets.',
		},
		{
			icon: Layers,
			title: 'Provider-extensible',
			desc: 'Notifications, intent intake, conversation bindings — all through authored provider config and standardized handlers.',
		},
		{
			icon: Terminal,
			title: 'Operable today',
			desc: 'CLI, notifications, conversation bindings. No polished app required to operate the system.',
		},
	]

	return (
		<section className="border-border border-t">
			<div className="mx-auto max-w-5xl px-6 py-20 md:py-28">
				<SectionHeader label="Why it's different" title="Not another chat wrapper" />
				<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
					{points.map((point) => (
						<div key={point.title} className="border-border border bg-[var(--card)] p-5">
							<point.icon className="text-muted-foreground mb-3 h-4 w-4" />
							<h3 className="mb-1.5 text-sm font-semibold">{point.title}</h3>
							<p className="text-muted-foreground text-sm leading-relaxed">{point.desc}</p>
						</div>
					))}
				</div>
			</div>
		</section>
	)
}

function ProofLoop() {
	const proofs = [
		{ icon: CheckCircle, text: 'Workflow-driven execution with explicit step progression' },
		{ icon: CheckCircle, text: 'Durable previews that survive worker shutdown' },
		{ icon: CheckCircle, text: 'Human approval loops built into workflow steps' },
		{ icon: CheckCircle, text: 'Provider-driven notifications and intent intake' },
		{ icon: CheckCircle, text: 'CLI-first async operation via inbox and watch' },
		{ icon: CheckCircle, text: 'Conversation bindings for task-scoped chat actions' },
		{ icon: CheckCircle, text: 'Per-run git worktree isolation' },
		{ icon: CheckCircle, text: 'Workers execute with real repo and toolchain access' },
	]

	return (
		<section className="border-border border-t bg-[var(--card)]">
			<div className="mx-auto max-w-5xl px-6 py-20 md:py-28">
				<SectionHeader label="What's real today" title="Already working" />
				<p className="text-muted-foreground mb-8 max-w-2xl text-base leading-relaxed">
					These are not roadmap items. This is what the system does right now.
				</p>
				<div className="grid gap-3 sm:grid-cols-2">
					{proofs.map((proof) => (
						<div key={proof.text} className="flex items-start gap-3 py-2">
							<proof.icon className="text-primary mt-0.5 h-4 w-4 shrink-0" />
							<span className="text-sm">{proof.text}</span>
						</div>
					))}
				</div>
			</div>
		</section>
	)
}

function CTA() {
	return (
		<section className="border-border border-t">
			<div className="mx-auto max-w-5xl px-6 py-20 text-center md:py-28">
				<h2 className="mb-4 text-2xl font-bold tracking-tight md:text-3xl">
					Start operating
				</h2>
				<p className="text-muted-foreground mx-auto mb-8 max-w-lg text-base">
					Autopilot is open source and self-hostable. Read the docs, run the quickstart, or
					inspect the architecture.
				</p>
				<div className="flex flex-wrap justify-center gap-4">
					<Link
						to="/docs/quickstart"
						className="bg-primary text-primary-foreground inline-flex items-center gap-2 px-5 py-2.5 font-mono text-sm font-semibold transition-opacity hover:opacity-90"
					>
						Quickstart
						<ArrowRight className="h-4 w-4" />
					</Link>
					<Link
						to="/docs/architecture"
						className="border-border text-foreground inline-flex items-center gap-2 border px-5 py-2.5 font-mono text-sm font-semibold transition-colors hover:bg-[var(--secondary)]"
					>
						Architecture
					</Link>
					<a
						href="https://github.com/questpie/autopilot"
						target="_blank"
						rel="noopener noreferrer"
						className="border-border text-foreground inline-flex items-center gap-2 border px-5 py-2.5 font-mono text-sm font-semibold transition-colors hover:bg-[var(--secondary)]"
					>
						GitHub
					</a>
				</div>
			</div>
		</section>
	)
}

function Footer() {
	return (
		<footer className="border-border border-t">
			<div className="text-muted-foreground mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
				<span className="flex items-center gap-2 font-mono text-xs">
					<QuestpieLogo className="h-4 w-4" />
					QUESTPIE Autopilot
				</span>
				<span className="text-xs">Open source. MIT license.</span>
			</div>
		</footer>
	)
}

function SectionHeader({ label, title }: { label: string; title: string }) {
	return (
		<div className="mb-10">
			<div className="font-mono text-primary mb-3 text-xs uppercase tracking-widest">
				{label}
			</div>
			<h2 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h2>
		</div>
	)
}
