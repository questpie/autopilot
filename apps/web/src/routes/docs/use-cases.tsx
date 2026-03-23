import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/CodeBlock'
import { seoHead } from '@/lib/seo'

export const Route = createFileRoute('/docs/use-cases')({
	head: () => ({ ...seoHead({ title: 'Use Cases', description: 'Software dev shop, marketing agency, e-commerce, consulting, and solo SaaS — same system, different configuration.', path: '/docs/use-cases', ogImage: 'https://autopilot.questpie.com/og-use-cases.png' }) }),
	component: UseCases,
})

function UseCases() {
	return (
		<article className="prose-autopilot">
			<h1 className="font-sans text-3xl font-black text-white mb-2">
				Use Cases
			</h1>
			<p className="text-muted text-lg mb-8">
				Autopilot is not a dev tool. It is a company OS. Same system,
				different configuration. Same kernel, different distribution.
			</p>

			{/* ── Key Insight ────────────────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				The Principle
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Every use case is a combination of the same building blocks.
				The orchestrator, CLI, dashboard, and agent spawner never
				change. Only the contents of the filesystem change:
			</p>
			<CodeBlock title="building-blocks">
				{`Skills       → teach agents WHAT to do
Knowledge    → provide CONTEXT (API docs, brand, conventions)
Workflows    → define HOW work flows
Widgets      → visualize STATE (dashboard)
Secrets      → authenticate ACCESS (API keys)
Schedules    → automate WHEN (cron)`}
			</CodeBlock>
			<div className="bg-purple-faint border border-border border-l-[3px] border-l-purple p-3 mb-8">
				<div className="font-sans text-[12px] text-muted leading-relaxed">
					<strong className="text-purple">Autopilot = kernel.</strong>{' '}
					Company template = distribution. Like Linux -- same kernel,
					different distro for each use case.
				</div>
			</div>

			{/* ── Use Case 1: Software Dev Shop ──────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				1. Software Development Shop
			</h2>
			<p className="text-ghost leading-relaxed mb-2">
				The default template. Full product lifecycle from intent to
				deployed feature.
			</p>
			<CodeBlock title="configuration">
				{`skills/
  code-review/          Code review standards and checklist
  testing-strategy/     Unit, integration, E2E test patterns
  git-workflow/         Branch strategy, PR conventions
  deployment/           Deploy checklist, rollback, health checks

knowledge/
  technical/            Stack, conventions, architecture decisions
  brand/                Brand guidelines

workflows/
  development.yaml      scope → plan → implement → review → merge → deploy
  incident.yaml         triage → fix → review → deploy → verify

agents:
  CEO, Sam(strategist), Alex(planner), Max(developer),
  Riley(reviewer), Ops(devops), Morgan(marketing), Jordan(design)

dashboard/widgets/
  sprint-progress/      Burndown chart
  deploy-status/        Last deploy, health`}
			</CodeBlock>

			{/* ── Use Case 2: Marketing Agency ───────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				2. Marketing Agency
			</h2>
			<p className="text-ghost leading-relaxed mb-2">
				Content calendar, social media scheduling, campaign management,
				analytics reporting.
			</p>
			<CodeBlock title="configuration">
				{`skills/
  content-strategy/     Content calendar planning
  social-media/         Platform best practices (Twitter, LinkedIn, IG)
  seo-optimization/     Keywords, meta tags, content structure
  campaign-planning/    Campaigns from brief to launch
  copywriting/          Tone of voice, headlines, CTA patterns
  analytics/            Metrics, reporting, trend analysis

knowledge/
  brand/                Client brand guidelines
  business/             Client briefs, target audience
  integrations/
    twitter.md          Twitter API docs
    linkedin.md         LinkedIn API docs
    buffer.md           Buffer API (scheduling)
    google-analytics.md GA4 API

workflows/
  content.yaml          brief → research → write → design → review → schedule → publish → monitor
  campaign.yaml         strategy → plan → create → review → launch → analyze → report

agents:
  CEO, Strategist, Content-Writer, Designer, Social-Manager,
  SEO-Specialist, Analytics-Agent, Client-Manager

schedules:
  - id: daily-posting
    agent: social-manager
    cron: "0 9,13,17 * * 1-5"
    description: "Check scheduled posts, publish, monitor engagement"

  - id: weekly-analytics
    agent: analytics-agent
    cron: "0 10 * * 1"
    description: "Generate weekly performance report"

dashboard/widgets/
  content-calendar/     Monthly calendar with posts
  post-preview/         Preview post before publishing
  engagement-metrics/   Likes, shares, comments real-time
  campaign-tracker/     Campaign status`}
			</CodeBlock>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				Post Preview Widget
			</h3>
			<CodeBlock title="dashboard/widgets/post-preview/widget.tsx">
				{`export default function PostPreview() {
  const { data: posts } = useQuery({
    queryKey: ['scheduled-posts'],
    queryFn: () => fetch('/fs/projects/marketing/posts/').then(r => r.json()),
    refetchInterval: 10000,
  })

  return (
    <div className="space-y-3">
      {posts?.map(post => (
        <div key={post.name} className="border border-border p-3">
          <div className="font-ui text-xs text-muted-foreground">
            {post.scheduled_for} · {post.platform}
          </div>
          <div className="text-sm mt-1">{post.title}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {post.status}
          </div>
        </div>
      ))}
    </div>
  )
}`}
			</CodeBlock>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				Post File Format
			</h3>
			<CodeBlock title="projects/marketing/posts/2026-03-24-launch.yaml">
				{`title: "QUESTPIE Autopilot is here"
platform: twitter
scheduled_for: "2026-03-24T14:00:00Z"
status: scheduled
content: |
  Introducing QUESTPIE Autopilot

  AI-native company operating system.
  Your company is a container. Your employees are agents.

  Open source. CLI-first. Ships today.

  github.com/questpie/autopilot
hashtags: [ai, agents, opensource, devtools]
image: /projects/marketing/assets/launch-banner.png
created_by: content-writer
reviewed_by: client-manager`}
			</CodeBlock>

			{/* ── Use Case 3: E-commerce ─────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				3. E-commerce Operations
			</h2>
			<p className="text-ghost leading-relaxed mb-2">
				Inventory management, customer support, order fulfillment,
				pricing strategy.
			</p>
			<CodeBlock title="configuration">
				{`skills/
  product-listing/      Product listing creation
  pricing-strategy/     Dynamic pricing, competitor analysis
  inventory-management/ Stock levels, reorder points
  customer-support/     Ticket handling, escalation rules
  order-fulfillment/    Order processing workflow

knowledge/
  products/             Product catalog, descriptions
  suppliers/            Supplier contacts, lead times
  integrations/
    shopify.md          Shopify API
    stripe.md           Stripe API

workflows/
  new-product.yaml      research → listing → pricing → photos → publish
  support-ticket.yaml   triage → respond → escalate-if-needed → resolve
  restock.yaml          alert → verify → order → confirm → update-inventory

agents:
  CEO, Product-Manager, Content-Writer, Support-Agent,
  Inventory-Agent, Pricing-Agent, Ops

dashboard/widgets/
  sales-overview/       Revenue, orders, conversion
  inventory-alerts/     Low stock warnings
  support-queue/        Open tickets, avg response time
  top-products/         Best sellers chart`}
			</CodeBlock>

			{/* ── Use Case 4: Consulting ─────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				4. Consulting / Agency
			</h2>
			<p className="text-ghost leading-relaxed mb-2">
				Client management, proposals, project tracking, invoicing,
				meeting notes.
			</p>
			<CodeBlock title="configuration">
				{`skills/
  client-onboarding/    Client onboarding process
  proposal-writing/     Proposal templates and conventions
  project-scoping/      Scope definition, estimation
  invoice-generation/   Invoicing, payment tracking
  meeting-notes/        Meeting documentation

knowledge/
  clients/
    client-a/           Brief, contacts, history
    client-b/           Brief, contacts, history
  legal/
    contract-template.md
    nda-template.md

workflows/
  client-onboarding.yaml  prospect → proposal → contract → kick-off → delivery
  project.yaml            scope → plan → execute → review → deliver → invoice

agents:
  CEO, Account-Manager, Project-Manager, Developer,
  Designer, Finance-Agent

dashboard/widgets/
  client-pipeline/      Kanban: prospect → active → completed
  project-timeline/     Gantt chart per client
  revenue-forecast/     Monthly projected revenue
  invoice-status/       Pending, paid, overdue`}
			</CodeBlock>

			{/* ── Use Case 5: Solo SaaS ──────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				5. Solo SaaS Creator
			</h2>
			<p className="text-ghost leading-relaxed mb-2">
				Feature development, content marketing, metrics tracking --
				one person, full team of agents.
			</p>
			<CodeBlock title="configuration">
				{`skills/
  saas-metrics/         MRR, churn, LTV calculations
  landing-page/         Effective landing page writing
  email-marketing/      Drip campaigns, newsletter
  user-research/        Interview scripts, feedback analysis

knowledge/
  product/              Feature specs, roadmap
  users/                User personas, feedback
  integrations/
    resend.md           Email API
    stripe.md           Billing API
    vercel.md           Deploy API

workflows/
  feature.yaml          idea → research → spec → build → test → ship → announce
  content.yaml          topic → draft → edit → publish → promote

agents:
  CEO (also product manager), Developer, Designer, Marketer
  (smaller team — 4 agents is enough)

dashboard/widgets/
  mrr-chart/            Monthly recurring revenue
  feature-progress/     Roadmap progress
  user-feedback/        Latest feedback items`}
			</CodeBlock>

			{/* ── How to Add a New Use Case ──────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Adding a New Use Case
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Step-by-step from empty company to fully configured setup:
			</p>
			<CodeBlock title="terminal">
				{`# 1. Create a company
autopilot init my-agency

# 2. Add skills for your domain
mkdir -p skills/content-strategy
cat > skills/content-strategy/SKILL.md << 'EOF'
---
name: content-strategy
description: How to plan and execute content marketing campaigns.
metadata:
  roles: [marketing, strategist]
---
# Content Strategy
...
EOF

# 3. Add knowledge
autopilot knowledge add brand/our-brand.md --file brand-guidelines.pdf
autopilot knowledge add integrations/twitter.md --file twitter-api-docs.md

# 4. Add secrets
autopilot secrets add twitter --value "bearer_xxx" --agents marketer

# 5. Add custom workflow
cat > team/workflows/content.yaml << 'EOF'
id: content
name: Content Pipeline
steps:
  - id: brief
    assigned_role: strategist
    transitions: { done: create }
  - id: create
    assigned_role: marketing
    transitions: { done: review }
  ...
EOF

# 6. (Optional) Add custom agents
# Edit team/agents.yaml — add Social-Manager, Content-Writer

# 7. (Optional) Add dashboard widgets
# Agents do it for you:
autopilot ask "Create a content calendar widget for the dashboard"

# 8. Done — same Autopilot, different content
autopilot start
autopilot ask "Plan next week's social media content"`}
			</CodeBlock>
		</article>
	)
}
