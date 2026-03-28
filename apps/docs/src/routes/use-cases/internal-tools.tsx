import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/landing/CodeBlock'
import { Header } from '@/components/landing/Header'
import { Section, SectionHeader } from '@/components/landing/Section'
import { Tag } from '@/components/landing/Tag'

export const Route = createFileRoute('/use-cases/internal-tools')({
	head: () => ({
		meta: [
			{ title: 'Internal Tools — Automate Any Process — QuestPie Autopilot' },
			{
				name: 'description',
				content:
					'Invoicing, reporting, contracts, HR onboarding — define any process as a YAML workflow. Agents execute, humans approve.',
			},
			{
				property: 'og:title',
				content: 'Internal Tools — Automate Any Process — QuestPie Autopilot',
			},
			{
				property: 'og:description',
				content:
					'Invoicing, reporting, contracts, HR onboarding — define any process as a YAML workflow. Agents execute, humans approve.',
			},
			{ property: 'og:type', content: 'website' },
			{
				property: 'og:url',
				content: 'https://autopilot.questpie.com/use-cases/internal-tools',
			},
			{ property: 'og:site_name', content: 'QUESTPIE Autopilot' },
			{ name: 'twitter:card', content: 'summary_large_image' },
			{
				name: 'twitter:title',
				content: 'Internal Tools — Automate Any Process — QuestPie Autopilot',
			},
		],
		links: [
			{
				rel: 'canonical',
				href: 'https://autopilot.questpie.com/use-cases/internal-tools',
			},
		],
	}),
	component: UseCaseInternalToolsPage,
})

function UseCaseInternalToolsPage() {
	return (
		<div className="landing-page">
			<Header />
			<main className="border-lp-border mx-auto max-w-[1200px] border-x lp-grid-bg">
				{/* ========== HERO ========== */}
				<section className="px-4 py-24 md:px-8 md:py-32 border-b border-lp-border">
					<div className="mb-4">
						<Tag>USE CASE</Tag>
					</div>
					<h1 className="font-mono text-[36px] sm:text-[48px] font-bold text-white m-0 leading-tight tracking-[-0.03em]">
						Internal Tools.
						<br />
						Automate Any Process.
					</h1>
					<p className="font-sans text-base sm:text-lg text-lp-muted mt-5 leading-relaxed max-w-[640px]">
						Invoicing, reporting, contracts, HR onboarding — define any
						process as a YAML workflow. Agents execute, humans approve.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Any repeatable business process can become an automated workflow.
						Agents handle data gathering, document generation, calculations,
						and routing. Humans approve at every decision point.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						The numbers are real: annual accounting prepared in 2 hours instead
						of 2 days. 8x faster. From QUESTPIE s.r.o. internal usage.
					</p>
					<div className="mt-8">
						<a
							href="/docs/getting-started"
							className="inline-block bg-[#B700FF] text-white font-mono text-sm px-6 py-3 hover:bg-[#9200CC] transition-colors no-underline"
						>
							Try the Business Tools Template
						</a>
					</div>
				</section>

				{/* ========== BEFORE / AFTER ========== */}
				<Section id="before-after">
					<SectionHeader
						num="01"
						sub="A real result from real usage at QUESTPIE s.r.o. Annual accounting, 8x faster."
					>
						2 Hours Instead of 2 Days
					</SectionHeader>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-red-400 mb-3">
								BEFORE AUTOPILOT
							</h3>
							<ul className="font-sans text-xs text-lp-muted leading-relaxed space-y-2 list-none p-0 m-0">
								<li>Bank statements matched to invoices manually — 4+ hours</li>
								<li>Monthly reports: data from 5 sources, full day consumed</li>
								<li>Invoices: copy-paste templates, manual calculations</li>
								<li>Contract review: read every clause by hand</li>
								<li>HR onboarding: 12-step checklist, steps get missed</li>
							</ul>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-[#B700FF] mb-3">
								AFTER AUTOPILOT
							</h3>
							<ul className="font-sans text-xs text-lp-muted leading-relaxed space-y-2 list-none p-0 m-0">
								<li>Bank statements processed and matched automatically</li>
								<li>Monthly reports compiled in minutes, not hours</li>
								<li>Invoices generated with calculated totals, ready to send</li>
								<li>Contracts scanned, flagged items queued for review</li>
								<li>Onboarding workflow: 12 steps, 3 human gates, nothing missed</li>
							</ul>
						</div>
					</div>

					<p className="font-sans text-sm text-lp-muted mt-6 max-w-[640px]">
						The 8x improvement is not theoretical. Annual accounting for a
						small company: 2 full days became 2 hours. Approximately 30
						minutes of agent processing. Approximately 90 minutes of human
						review. Your review time is the bottleneck, not the processing.
					</p>
				</Section>

				{/* ========== BUSINESS AGENTS ========== */}
				<Section id="agents">
					<SectionHeader
						num="02"
						sub="Reconfigure agents for business operations: finance, HR, legal, and reporting."
					>
						Your AI Back Office
					</SectionHeader>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								CEO
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Routes business requests and coordinates cross-department
								workflows. Invoice, report, and onboarding tasks flow through
								CEO to the right specialist.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Accountant (Sam)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Processes bank statements, matches transactions to invoices,
								calculates VAT, prepares tax reports. Follows your accounting
								procedures from knowledge base.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Planner (Alex)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Schedules recurring tasks. Manages compliance deadlines. Tracks
								filing dates. Nothing gets missed because Alex maintains the
								calendar.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Document Specialist (Max)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Generates invoices, contracts, and reports from templates. Fills
								in data, calculates totals, formats output, prepares documents
								for approval.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Reviewer (Riley)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Reviews financial calculations for accuracy, contract clauses
								for issues, report figures for consistency. Catches the math
								error that would take you 3 hours to find.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Operations (Ops)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Manages file delivery, email sending, and platform integrations.
								When an invoice is approved, Ops delivers it through the
								configured method.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Communications (Morgan)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Writes client correspondence, status updates, and internal
								memos. Professional communication without you drafting every
								email.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Designer (Jordan)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Creates branded report templates, presentation decks, and visual
								summaries for stakeholder reviews.
							</p>
						</div>
					</div>

					<div className="mt-8 max-w-[640px]">
						<CodeBlock title="company.yaml — business agents">
							{`agents:
  ceo:
    name: CEO
    role: Business Operations Coordinator
    provider: claude-agent-sdk
    model: claude-sonnet-4-20250514
    tools: [task, message, pin, search, http, search_web, browse]

  sam:
    name: Penny
    role: Financial Controller
    provider: anthropic
    model: claude-sonnet-4-20250514
    tools: [task, message, search, http]
    skills: [accounting, invoicing, vat, tax-reporting]
    fs_scope:
      read: ["./finances/**", "./contracts/**"]
      write: ["./finances/reports/**"]

  max:
    name: Max
    role: Document Specialist
    provider: claude-agent-sdk
    model: claude-sonnet-4-20250514
    tools: [task, message, search]
    skills: [invoicing, contracts, reporting, templates]
    fs_scope:
      read: ["./templates/**", "./data/**"]
      write: ["./output/**"]

  riley:
    name: Riley
    role: Financial Reviewer
    provider: anthropic
    model: claude-sonnet-4-20250514
    tools: [task, message, search]
    skills: [accuracy-checks, compliance, reconciliation]`}
						</CodeBlock>
					</div>
				</Section>

				{/* ========== INVOICING WORKFLOW ========== */}
				<Section id="workflow">
					<SectionHeader
						num="03"
						sub="From time tracking data to delivered invoice in one automated workflow."
					>
						Invoice Generated. Approved. Sent.
					</SectionHeader>

					<div className="space-y-3 max-w-[640px]">
						{[
							{ step: '01', agent: 'Sam', action: 'Collect time and service data from project tracking' },
							{ step: '02', agent: 'Max', action: 'Generate invoice from template — correct currency, tax rates, formatting' },
							{ step: '03', agent: 'Riley', action: 'Review for accuracy — automated checks plus flagged items' },
							{ step: '04', agent: 'YOU', action: 'Verify totals, check line items, approve — HUMAN GATE' },
							{ step: '05', agent: 'Ops', action: 'Send to client via configured delivery method' },
							{ step: '06', agent: 'Sam', action: 'Log in accounting records, update receivables' },
						].map((item) => (
							<div
								key={item.step}
								className="flex items-start gap-4 bg-lp-card border border-lp-border p-4"
							>
								<span className="font-mono text-xs text-[#B700FF] flex-shrink-0 w-6">
									{item.step}
								</span>
								<span className="font-mono text-xs text-white flex-shrink-0 w-16">
									{item.agent}
								</span>
								<span className="font-sans text-xs text-lp-muted">
									{item.action}
								</span>
							</div>
						))}
					</div>

					<p className="font-sans text-sm text-lp-muted mt-6 max-w-[640px]">
						The invoice is correct because Sam calculated the totals. It is
						formatted correctly because Max followed the template. It is
						delivered reliably because Ops handles the send.
					</p>

					<div className="mt-8 max-w-[640px]">
						<CodeBlock title="invoicing.yaml — workflow definition">
							{`workflow: invoicing
steps:
  - name: collect_data
    agent: sam
    action: gather_time_and_services
    inputs: [project_id, date_range]

  - name: generate_invoice
    agent: max
    action: fill_template
    inputs: [time_data, template, tax_rules]
    outputs: [invoice_draft]

  - name: review
    agent: riley
    action: verify_calculations
    inputs: [invoice_draft]

  - name: approve
    type: human_gate
    action: review_and_sign

  - name: deliver
    agent: ops
    action: send_via_configured_method
    requires: [approve.approved]

  - name: record
    agent: sam
    action: update_accounting_records`}
						</CodeBlock>
					</div>
				</Section>

				{/* ========== ACCOUNTING CASE STUDY ========== */}
				<Section id="case-study">
					<SectionHeader
						num="04"
						sub="From QUESTPIE s.r.o. internal usage. Results may vary based on company size and complexity."
					>
						Annual Accounting: 8x Faster
					</SectionHeader>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div className="bg-lp-card border border-lp-border p-6 text-center">
							<p className="font-mono text-[32px] font-bold text-red-400 mb-1">
								2 days
							</p>
							<p className="font-sans text-xs text-lp-muted">
								Before: manual processing
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6 text-center">
							<p className="font-mono text-[32px] font-bold text-[#B700FF] mb-1">
								2 hours
							</p>
							<p className="font-sans text-xs text-lp-muted">
								After: agent + human review
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6 text-center">
							<p className="font-mono text-[32px] font-bold text-white mb-1">
								8x
							</p>
							<p className="font-sans text-xs text-lp-muted">
								Faster end-to-end
							</p>
						</div>
					</div>

					<div className="mt-6 max-w-[640px]">
						<p className="font-sans text-sm text-lp-muted leading-relaxed">
							The task: prepare annual accounting for a small company. Under 100
							invoices, under 500 transactions. Standard complexity.
						</p>
						<p className="font-sans text-sm text-lp-muted mt-4 leading-relaxed">
							The accounting agent processes statements, matches invoices using
							the search tool, and calculates VAT following rules from the
							knowledge base. Reports generate from templates. You review the
							output, verify totals, and approve.
						</p>
						<p className="font-sans text-sm text-lp-muted mt-4 leading-relaxed">
							Approximately 30 minutes of agent processing. Approximately 90
							minutes of human review and approval. The agent work that used to
							take a human 14+ hours takes 30 minutes.
						</p>
					</div>

					<div className="mt-6 max-w-[640px]">
						<CodeBlock title="terminal — business knowledge">
							{`autopilot knowledge add ./procedures/invoicing-sop.md
autopilot knowledge add ./templates/invoice-template.yaml
autopilot knowledge add ./compliance/vat-rules.md
autopilot knowledge add ./compliance/filing-deadlines.yaml`}
						</CodeBlock>
					</div>
				</Section>

				{/* ========== CTA ========== */}
				<section className="px-4 py-16 md:px-8 text-center border-t border-lp-border">
					<h2 className="font-mono text-xl sm:text-2xl font-bold text-white mb-4">
						Automate Your Back Office
					</h2>
					<p className="font-sans text-sm text-lp-muted mb-6 max-w-md mx-auto">
						Free. Open source. Running in 5 minutes.
					</p>
					<div className="max-w-md mx-auto mb-8">
						<CodeBlock title="terminal">
							{`bun add -g @questpie/autopilot
autopilot init my-business
autopilot start`}
						</CodeBlock>
					</div>
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
