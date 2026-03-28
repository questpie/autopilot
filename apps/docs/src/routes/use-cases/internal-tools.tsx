import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/landing/CodeBlock'
import { Header } from '@/components/landing/Header'

export const Route = createFileRoute('/use-cases/internal-tools')({
	head: () => ({
		meta: [
			{ title: 'Internal Tools — 8x Faster Accounting — QuestPie Autopilot' },
			{
				name: 'description',
				content:
					'Accounting agents + invoicing workflow. Annual accounting: 2 days became 2 hours. Real result from QuestPie internal usage.',
			},
			{ property: 'og:title', content: 'Internal Tools — 8x Faster Accounting — QuestPie Autopilot' },
			{
				property: 'og:description',
				content: 'Accounting agents + invoicing workflow. 8x faster. Real result from QuestPie.',
			},
			{ property: 'og:type', content: 'website' },
			{ property: 'og:url', content: 'https://autopilot.questpie.com/use-cases/internal-tools' },
			{ property: 'og:site_name', content: 'QUESTPIE Autopilot' },
			{ name: 'twitter:card', content: 'summary_large_image' },
		],
		links: [{ rel: 'canonical', href: 'https://autopilot.questpie.com/use-cases/internal-tools' }],
	}),
	component: InternalToolsPage,
})

function InternalToolsPage() {
	return (
		<div className="landing-page">
			<Header />
			<main className="border-lp-border mx-auto max-w-[1200px] border-x lp-grid-bg">
				{/* HERO */}
				<section className="px-4 py-20 md:px-8 md:py-28 border-b border-lp-border">
					<p className="font-mono text-xs text-lp-purple tracking-[0.2em] mb-4">USE CASE</p>
					<h1 className="font-mono text-[32px] sm:text-[44px] font-bold text-white m-0 leading-tight tracking-[-0.03em]">
						Internal Tools
					</h1>
					<p className="font-mono text-sm text-lp-muted mt-4 max-w-[560px]">
						Accounting agents + invoicing workflow. Annual accounting for
						QuestPie s.r.o.: 2 full days became 2 hours. 8x faster. Real
						number from real usage.
					</p>
				</section>

				{/* AGENTS CONFIG */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<h2 className="font-mono text-lg font-bold text-white mb-6">agents.yaml</h2>
					<div className="max-w-[720px]">
						<CodeBlock title="company.yaml — accounting agents">
							{`agents:
  controller:
    role: Financial Controller
    provider: anthropic
    model: claude-sonnet-4-20250514
    tools: [task, message, search, http]
    skills: [accounting, invoicing, vat, tax-reporting]
    fs_scope:
      read: ["./finances/**", "./contracts/**"]
      write: ["./finances/reports/**"]

  doc-gen:
    role: Document Generator
    provider: claude-agent-sdk
    model: claude-sonnet-4-20250514
    tools: [task, message, search]
    skills: [invoicing, contracts, templates]
    fs_scope:
      read: ["./templates/**", "./data/**"]
      write: ["./output/**"]

  reviewer:
    role: Financial Reviewer
    provider: anthropic
    model: claude-sonnet-4-20250514
    tools: [task, message, search]
    skills: [accuracy-checks, compliance, reconciliation]

  delivery:
    role: Document Delivery
    provider: claude-agent-sdk
    model: claude-sonnet-4-20250514
    tools: [task, message, http]
    skills: [email, file-delivery, platform-integrations]`}
						</CodeBlock>
					</div>
				</section>

				{/* WORKFLOW */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<h2 className="font-mono text-lg font-bold text-white mb-6">invoicing.yaml</h2>
					<div className="max-w-[720px]">
						<CodeBlock title="workflows/invoicing.yaml">
							{`workflow: invoicing
steps:
  - name: collect_data
    agent: controller
    action: gather_time_and_services
    inputs: [project_id, date_range]
    outputs: [time_entries, service_records]

  - name: generate_invoice
    agent: doc-gen
    action: fill_template
    inputs: [time_entries, template, tax_rules]
    outputs: [invoice_draft]

  - name: review
    agent: reviewer
    action: verify_calculations
    inputs: [invoice_draft]
    outputs: [verified, findings]

  - name: approve
    type: human_gate
    action: review_and_sign

  - name: deliver
    agent: delivery
    action: send_via_configured_method
    requires: [approve.approved]
    inputs: [invoice_draft, delivery_config]

  - name: record
    agent: controller
    action: update_accounting_records
    inputs: [invoice_draft]`}
						</CodeBlock>
					</div>
				</section>

				{/* TERMINAL FLOW */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<h2 className="font-mono text-lg font-bold text-white mb-6">Annual accounting run</h2>
					<div className="max-w-[720px]">
						<CodeBlock title="terminal">
							{`$ autopilot chat controller "Prepare annual accounting for 2025"

[controller] Processing bank statements: 487 transactions
[controller] Matching invoices: 94 issued, 89 matched
[controller] 5 unmatched — flagged for review
[controller] VAT calculated: Q1-Q4 summaries ready
[doc-gen]    Generating annual report from template...
[doc-gen]    12 sections, 34 tables, 2 appendices
[reviewer]   Verifying calculations...
[reviewer]   487/487 transactions reconciled
[reviewer]   VAT totals: verified against quarterly filings
[reviewer]   Approved. 0 discrepancies.

  HUMAN GATE: Review annual report
  $ autopilot approve report annual-2025

[delivery]   Sent to accountant via email
[controller] Records updated. Filing deadline tracked.

# Before: 2 full days of manual work
# After:  ~30 min agent processing + ~90 min human review
# Result: 8x faster. Same accuracy.`}
						</CodeBlock>
					</div>
				</section>

				{/* 8x STAT */}
				<section className="px-4 py-12 md:px-8 border-b border-lp-border">
					<div className="max-w-[720px]">
						<CodeBlock title="cat results.yaml">
							{`# QuestPie s.r.o. internal usage
# Annual accounting, small company
# < 100 invoices, < 500 transactions

before:
  total_time: "2 days"
  breakdown: "manual matching, manual VAT, manual report"

after:
  agent_time: "~30 minutes"
  human_time: "~90 minutes"
  total_time: "~2 hours"

improvement: "8x"
note: "results vary by company size and complexity"`}
						</CodeBlock>
					</div>
				</section>

				{/* CTA */}
				<section className="px-4 py-16 md:px-8 text-center border-t border-lp-border">
					<div className="max-w-md mx-auto mb-6">
						<CodeBlock title="install">
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
