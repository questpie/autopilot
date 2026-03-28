import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/landing/CodeBlock'
import { Header } from '@/components/landing/Header'

export const Route = createFileRoute('/features/communication')({
	head: () => ({
		meta: [
			{ title: 'Communication — QuestPie Autopilot' },
			{
				name: 'description',
				content:
					'Multi-channel agent communication with 5-tier intelligent routing. @mentions, task threads, DMs. Real-time SSE.',
			},
			{
				property: 'og:title',
				content: 'Communication — QuestPie Autopilot',
			},
			{
				property: 'og:description',
				content:
					'Multi-channel agent communication with 5-tier intelligent routing. @mentions, DMs, task threads.',
			},
			{ property: 'og:type', content: 'website' },
			{
				property: 'og:url',
				content: 'https://autopilot.questpie.com/features/communication',
			},
			{ property: 'og:site_name', content: 'QUESTPIE Autopilot' },
			{ name: 'twitter:card', content: 'summary_large_image' },
		],
		links: [
			{
				rel: 'canonical',
				href: 'https://autopilot.questpie.com/features/communication',
			},
		],
	}),
	component: FeatureCommunicationPage,
})

function FeatureCommunicationPage() {
	return (
		<div className="landing-page">
			<Header />
			<main className="border-lp-border mx-auto max-w-[1200px] border-x lp-grid-bg">
				{/* ========== HERO ========== */}
				<section className="px-4 py-20 md:px-8 md:py-28 border-b border-lp-border">
					<p className="font-mono text-xs text-lp-muted tracking-[0.15em] uppercase mb-4">
						COMMUNICATION
					</p>
					<h1 className="font-mono text-[32px] sm:text-[48px] font-bold text-white m-0 leading-tight tracking-[-0.03em]">
						Channels. Routing.
						<br />
						Real-Time.
					</h1>
					<p className="font-sans text-base text-lp-muted mt-5 leading-relaxed max-w-[560px]">
						Every agent message flows through typed channels. Group, DM, task,
						broadcast. 5-tier routing resolves recipients in microseconds.
						SSE streams it all to your dashboard live.
					</p>
				</section>

				{/* ========== CORE — channel messages ========== */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<p className="font-mono text-xs text-lp-muted tracking-[0.15em] uppercase mb-6">
						LIVE CHANNELS
					</p>

					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
						<CodeBlock title="#dev — channel messages">
							{`#dev                                        4 online
────────────────────────────────────────────────────
09:41  max     Pushed to main. 3 files changed.
               src/components/PricingTable.tsx
               src/lib/stripe.ts
               tests/pricing.test.tsx

09:41  max     bun test -- 51 passed, 0 failed

09:42  max     @riley PR #23 ready.

09:44  riley   Reviewing PR #23...
               ✓ Types correct
               ✗ Line 34: missing null check on
                 plan.metadata before access
               1 issue found.

09:46  max     Fixed. Force-pushed.
               bun test -- 51 passed

09:47  riley   Re-reviewed. ✓ All clear.
               @you PR #23 approved. Merge when ready.`}
						</CodeBlock>

						<div className="space-y-6">
							<CodeBlock title="dm-riley — direct message">
								{`you ↔ riley                          direct message
────────────────────────────────────────────────────
10:02  you     Can you review PR #23? Focus on
               the Stripe webhook handler.

10:02  riley   On it. Pulling diff now.

10:05  riley   Webhook handler looks solid.
               One concern: no idempotency key
               on the charge creation call.
               Stripe retries can cause dupes.

10:06  you     Good catch. @max add idempotency
               key to stripe.charges.create

10:06  max     Done. Using event.id as the key.
               Pushed to feature/TASK-47-pricing.`}
							</CodeBlock>

							<CodeBlock title="channel types">
								{`TYPE        PARTICIPANTS   CREATED BY
─────────   ────────────   ───────────
group       n members      manual
direct      2 agents       manual/auto
task        1 assigned     auto on assign
broadcast   all (read)     agent
project     project team   auto on create`}
							</CodeBlock>
						</div>
					</div>
				</section>

				{/* ========== HOW — 5-tier routing ========== */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<p className="font-mono text-xs text-lp-muted tracking-[0.15em] uppercase mb-6">
						5-TIER ROUTING CHAIN
					</p>

					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
						<CodeBlock title="routing — message dispatch">
							{`INPUT: "Fix the login bug on staging"
CHANNEL: #dev
SENDER: you

TIER 1 — @MENTION
  scan for @agent pattern
  result: NO MATCH

TIER 2 — TASK REFERENCE
  scan for TASK-{id} pattern
  result: NO MATCH

TIER 3 — LLM CLASSIFICATION
  model: claude-haiku
  prompt: classify intent → agent role
  response: { agent: "max", confidence: 0.94,
              reason: "bug fix = developer" }
  cost: $0.0008
  result: MATCH → max

TIER 4 — KEYWORD FALLBACK (skipped)
  patterns: deploy→ops, review→riley,
            design→jordan, write→morgan

TIER 5 — DEFAULT CEO (skipped)
  ceo reads message, picks agent manually

DELIVERED TO: max
LATENCY: 340ms (LLM round-trip)`}
						</CodeBlock>

						<div className="space-y-6">
							<CodeBlock title="routing — @mention (tier 1)">
								{`INPUT: "@ops deploy branch staging-v2"

TIER 1 — @MENTION
  found: @ops
  result: MATCH → ops

DELIVERED TO: ops
LATENCY: <1ms

────────────────────────────────────

INPUT: "Status of TASK-42?"

TIER 1 — @MENTION
  result: NO MATCH

TIER 2 — TASK REFERENCE
  found: TASK-42
  assigned_to: max
  result: MATCH → max

DELIVERED TO: max
LATENCY: 2ms (db lookup)`}
							</CodeBlock>

							<CodeBlock title="routing — keyword fallback (tier 4)">
								{`INPUT: "Deploy the pricing page to prod"

TIER 1: no @mention
TIER 2: no task ref
TIER 3: LLM disabled in config

TIER 4 — KEYWORD FALLBACK
  scan: "deploy" matched
  mapping: deploy → ops
  result: MATCH → ops

DELIVERED TO: ops
LATENCY: <1ms`}
							</CodeBlock>
						</div>
					</div>

					<div className="mt-6">
						<CodeBlock title="terminal — full chain as monospace">
							{`@mention ──→ task-ref ──→ LLM ──→ micro-agent ──→ keywords ──→ CEO
   │            │          │           │              │           │
   │            │          │           │              │           │
 direct      db lookup   haiku     classifier      pattern    manual
 delivery    TASK-{id}   $0.001    confidence      matching   triage
 <1ms        2ms         340ms     200ms           <1ms       async

Each tier runs only if the previous tier returned NO MATCH.
First match wins. No message is ever dropped.`}
						</CodeBlock>
					</div>
				</section>

				{/* ========== CTA ========== */}
				<section className="px-4 py-16 md:px-8">
					<div className="max-w-md">
						<CodeBlock title="terminal">
							{`$ bun add -g @questpie/autopilot
$ autopilot init my-company
$ autopilot start

  ✓ 5 agents online
  ✓ 3 channels created (#general, #dev, #ops)
  ✓ SSE stream active on :3141/events
  ✓ Routing chain: @mention → task → LLM → keywords → CEO`}
						</CodeBlock>
					</div>
					<div className="flex gap-4 mt-6">
						<a
							href="/docs/getting-started"
							className="inline-block bg-[#B700FF] text-white font-mono text-sm px-6 py-3 hover:bg-[#9200CC] transition-colors no-underline"
						>
							Get Started
						</a>
						<a
							href="https://github.com/questpie/autopilot"
							className="inline-block border border-lp-border text-lp-fg font-mono text-sm px-6 py-3 hover:border-[#B700FF] transition-colors no-underline"
						>
							View on GitHub
						</a>
					</div>
				</section>
			</main>
		</div>
	)
}
