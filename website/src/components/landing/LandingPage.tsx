import { Link } from "@tanstack/react-router";
import { ArrowRight, Github, Terminal } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";

import { cn } from "@/lib/cn";

/* ─── Helpers ─── */

function TerminalBlock({
	label,
	children,
	className,
}: {
	label?: string;
	children: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"border-border bg-background relative h-full border",
				className,
			)}
		>
			{label && (
				<div className="text-muted-foreground/40 border-border absolute top-0 left-0 border-r border-b px-2 py-1 font-mono text-[10px] tracking-[0.2em] uppercase">
					{label}
				</div>
			)}
			<div className="text-muted-foreground overflow-x-auto p-4 pt-10 font-mono text-[13px] leading-[1.6] whitespace-pre">
				{children}
			</div>
		</div>
	);
}

function Badge({ children }: { children: ReactNode }) {
	return (
		<span className="bg-secondary text-primary px-2 py-0.5 font-mono text-[11px] font-semibold tracking-[0.04em] uppercase">
			{children}
		</span>
	);
}

function BrutalistGrid({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"bg-border border-border grid grid-cols-1 gap-[1px] border md:grid-cols-2",
				className,
			)}
		>
			{children}
		</div>
	);
}

function FeatureCell({
	num,
	title,
	desc,
}: {
	num: string;
	title: string;
	desc: string;
}) {
	return (
		<div className="bg-background hover:outline-primary flex h-full flex-col p-6 transition-colors hover:outline hover:outline-1 hover:-outline-offset-1">
			<div className="text-primary mb-4 flex items-center gap-2 font-mono text-[10px] tracking-[3px]">
				{num}
			</div>
			<h3 className="text-foreground mb-2 font-mono text-[14px] font-bold">
				{title}
			</h3>
			<p className="text-muted-foreground text-[13px] leading-[1.5]">{desc}</p>
		</div>
	);
}

function SectionHeader({
	num,
	title,
	subtitle,
}: {
	num: string;
	title: string;
	subtitle: string;
}) {
	return (
		<div className="mb-12">
			<div className="text-primary mb-4 font-mono text-sm tracking-[3px]">
				{num}
			</div>
			<h2 className="text-foreground mb-4 font-mono text-3xl font-bold md:text-4xl">
				{title}
			</h2>
			<p className="text-muted-foreground max-w-2xl text-lg">{subtitle}</p>
		</div>
	);
}

function Reveal({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div
			data-reveal
			className={cn(
				"translate-y-3 opacity-0 transition-all duration-500 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] data-[visible]:translate-y-0 data-[visible]:opacity-100",
				className,
			)}
		>
			{children}
		</div>
	);
}

/* ─── Scroll reveal observer ─── */

function useRevealObserver() {
	const observed = useRef(false);
	useEffect(() => {
		if (observed.current) return;
		observed.current = true;
		const els = document.querySelectorAll("[data-reveal]");
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						entry.target.setAttribute("data-visible", "");
						observer.unobserve(entry.target);
					}
				}
			},
			{ threshold: 0.15 },
		);
		for (const el of els) observer.observe(el);
		return () => observer.disconnect();
	}, []);
}

/* ─── Landing Page ─── */

export function LandingPage() {
	useRevealObserver();

	return (
		<div className="min-h-screen">
			{/* ── Hero ── */}
			<section className="border-border border-b">
				<div className="mx-auto max-w-5xl px-6 py-24 md:py-32">
					<Reveal>
						<Badge>Alpha v0.2.0</Badge>
					</Reveal>
					<Reveal className="mt-6">
						<h1 className="text-foreground max-w-3xl font-mono text-4xl font-bold leading-[1.1] md:text-5xl lg:text-6xl">
							Local-first workflow engine for coding agents
						</h1>
					</Reveal>
					<Reveal className="mt-6">
						<p className="text-muted-foreground max-w-2xl text-lg leading-relaxed">
							Plan, execute, validate, and monitor tasks driven by Claude Code or
							Codex. From your terminal.
						</p>
					</Reveal>
					<Reveal className="mt-8">
						<TerminalBlock label="install" className="max-w-md">
							<span className="text-primary">$</span> bun add -g @questpie/autopilot
						</TerminalBlock>
					</Reveal>
					<Reveal className="mt-8 flex flex-wrap gap-3">
						<Link
							to="/docs/$"
							params={{ _splat: "" }}
							className="bg-primary text-primary-foreground inline-flex items-center gap-2 px-5 py-2.5 font-mono text-sm font-semibold transition-opacity hover:opacity-90"
						>
							Get Started <ArrowRight className="h-4 w-4" />
						</Link>
						<a
							href="https://github.com/questpie/questpie-autopilot"
							target="_blank"
							rel="noopener noreferrer"
							className="border-border text-foreground hover:bg-secondary inline-flex items-center gap-2 border px-5 py-2.5 font-mono text-sm font-semibold transition-colors"
						>
							<Github className="h-4 w-4" /> GitHub
						</a>
					</Reveal>
				</div>
			</section>

			{/* ── 01: How it works ── */}
			<section className="border-border border-b">
				<div className="mx-auto max-w-5xl px-6 py-20">
					<Reveal>
						<SectionHeader
							num="01"
							title="How it works"
							subtitle="Four steps from repo to delivered code."
						/>
					</Reveal>
					<Reveal>
						<BrutalistGrid className="md:grid-cols-4">
							<FeatureCell
								num="01"
								title="Point at your repo"
								desc="Autopilot auto-detects the workspace from your current directory."
							/>
							<FeatureCell
								num="02"
								title="AI generates the plan"
								desc="An agent reads your repo and artifacts, then creates the task graph."
							/>
							<FeatureCell
								num="03"
								title="Autopilot runs the loop"
								desc="Tasks execute in dependency order — prompt, spawn agent, validate, persist."
							/>
							<FeatureCell
								num="04"
								title="Validate and commit"
								desc="Each task passes validation before advancing. You stay in control."
							/>
						</BrutalistGrid>
					</Reveal>
				</div>
			</section>

			{/* ── 02: Terminal-first ── */}
			<section className="border-border border-b">
				<div className="mx-auto max-w-5xl px-6 py-20">
					<Reveal>
						<SectionHeader
							num="02"
							title="Terminal-first"
							subtitle="A full TUI cockpit — not a web dashboard."
						/>
					</Reveal>
					<Reveal>
						<TerminalBlock label="qap" className="text-[12px]">
{`┌── ■ QUESTPIE AUTOPILOT v0.2.0 │ WS my-repo │ PRJ v3-rollout ── 12T 3R 5D 0F ──┐
│ [PROJECT]  SESSIONS   LOGS   HELP                                                │
├─ PROJECT ─────────────┬─ READY ──────────────────────────────────────────────────┤
│ Name    v3-rollout     │ ● TASK-007  [main] Implement auth module                │
│ ID      v3-rollout     │ ● TASK-008  [main] Add API endpoints                    │
│ Provider claude        │ ● TASK-012  [sidecar] Write integration tests           │
│ Repo    /path/to/repo  │                                                         │
├─ LOG ─────────────────┼─ COMPLETED / FAILED ─────────────────────────────────────┤
│ Project loaded         │ ✓ TASK-001  [gate] Initial setup                        │
│ 12 tasks | 3 ready     │ ✓ TASK-002  [main] Database schema                      │
│                        │ ✗ TASK-005  [main] Failed: timeout                      │
├────────────────────────┴──────────────────────────────────────────────────────────┤
│ ▸ Type a command... (/help)  ESC clear · Ctrl+C exit                             │
└───────────────────────────────────────────────────────────────────────────────────┘`}
						</TerminalBlock>
					</Reveal>
				</div>
			</section>

			{/* ── 03: Core concepts ── */}
			<section className="border-border border-b">
				<div className="mx-auto max-w-5xl px-6 py-20">
					<Reveal>
						<SectionHeader
							num="03"
							title="Core concepts"
							subtitle="Four primitives power the engine."
						/>
					</Reveal>
					<Reveal>
						<BrutalistGrid>
							<FeatureCell
								num="WORKSPACE"
								title="Workspace"
								desc="A repo root. Auto-detected from cwd. One workspace holds multiple projects."
							/>
							<FeatureCell
								num="PROJECT"
								title="Project"
								desc="A specific initiative — its own task graph, prompts, state, and sessions."
							/>
							<FeatureCell
								num="SESSION"
								title="Session"
								desc="A run history record. Tracks what executed, succeeded, and failed."
							/>
							<FeatureCell
								num="TASK"
								title="Task model"
								desc="10 states, dependency DAG, track priority (gate > main > sidecar), and kind classification."
							/>
						</BrutalistGrid>
					</Reveal>
				</div>
			</section>

			{/* ── 04: CLI at a glance ── */}
			<section className="border-border border-b">
				<div className="mx-auto max-w-5xl px-6 py-20">
					<Reveal>
						<SectionHeader
							num="04"
							title="CLI at a glance"
							subtitle="Every operation is scriptable."
						/>
					</Reveal>
					<Reveal>
						<div className="grid grid-cols-1 gap-[1px] md:grid-cols-2">
							<TerminalBlock label="project management">
{`$ qap project init --name my-feature
$ qap project import --prompts ./prompts
$ qap project list
$ qap project use v3-rollout`}
							</TerminalBlock>
							<TerminalBlock label="execution">
{`$ qap status
$ qap next
$ qap run --max 5
$ qap run-task TASK-007`}
							</TerminalBlock>
						</div>
					</Reveal>
					<Reveal className="mt-[1px]">
						<div className="grid grid-cols-1 gap-[1px] md:grid-cols-2">
							<TerminalBlock label="steering">
{`$ qap steer project "Focus on type safety"
$ qap note TASK-007 "Use new auth middleware"
$ qap steer show`}
							</TerminalBlock>
							<TerminalBlock label="quick start">
{`$ cd /path/to/repo
$ qap                # opens TUI
$ /run               # starts execution`}
							</TerminalBlock>
						</div>
					</Reveal>
				</div>
			</section>

			{/* ── CTA ── */}
			<section className="border-border border-b">
				<div className="mx-auto max-w-5xl px-6 py-20 text-center">
					<Reveal>
						<div className="mb-6 flex justify-center">
							<img
								src="/autopilot/logo/symbol-light.svg"
								alt=""
								className="h-10 w-auto dark:hidden"
							/>
							<img
								src="/autopilot/logo/symbol-dark.svg"
								alt=""
								className="hidden h-10 w-auto dark:block"
							/>
						</div>
					</Reveal>
					<Reveal>
						<h2 className="text-foreground mb-4 font-mono text-2xl font-bold md:text-3xl">
							Start automating
						</h2>
					</Reveal>
					<Reveal>
						<TerminalBlock className="mx-auto mb-8 max-w-md">
							<span className="text-primary">$</span> bun add -g @questpie/autopilot
						</TerminalBlock>
					</Reveal>
					<Reveal className="flex flex-wrap justify-center gap-3">
						<Link
							to="/docs/$"
							params={{ _splat: "" }}
							className="bg-primary text-primary-foreground inline-flex items-center gap-2 px-5 py-2.5 font-mono text-sm font-semibold transition-opacity hover:opacity-90"
						>
							Read the docs <ArrowRight className="h-4 w-4" />
						</Link>
						<a
							href="https://www.npmjs.com/package/@questpie/autopilot"
							target="_blank"
							rel="noopener noreferrer"
							className="border-border text-foreground hover:bg-secondary inline-flex items-center gap-2 border px-5 py-2.5 font-mono text-sm font-semibold transition-colors"
						>
							<Terminal className="h-4 w-4" /> npm
						</a>
					</Reveal>
				</div>
			</section>

			{/* ── Footer ── */}
			<footer className="border-border border-b">
				<div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 py-8 md:flex-row">
					<div className="text-muted-foreground font-mono text-xs">
						QUESTPIE Autopilot — MIT License
					</div>
					<div className="text-muted-foreground flex gap-6 font-mono text-xs">
						<a
							href="https://questpie.com"
							target="_blank"
							rel="noopener noreferrer"
							className="hover:text-foreground transition-colors"
						>
							questpie.com
						</a>
						<a
							href="https://github.com/questpie/questpie-autopilot"
							target="_blank"
							rel="noopener noreferrer"
							className="hover:text-foreground transition-colors"
						>
							GitHub
						</a>
						<a
							href="https://www.npmjs.com/package/@questpie/autopilot"
							target="_blank"
							rel="noopener noreferrer"
							className="hover:text-foreground transition-colors"
						>
							npm
						</a>
					</div>
				</div>
				<div className="border-border border-t">
					<div className="mx-auto max-w-5xl px-6 py-4 text-center">
						<span className="text-muted-foreground/60 font-mono text-[10px] tracking-[0.15em] uppercase">
							Part of the QUESTPIE ecosystem
						</span>
					</div>
				</div>
			</footer>
		</div>
	);
}
