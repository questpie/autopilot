import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/CodeBlock'

export const Route = createFileRoute('/docs/integrations')({
	head: () => ({
		meta: [{ title: 'Integrations — QUESTPIE Autopilot' }],
	}),
	component: Integrations,
})

function Integrations() {
	return (
		<article className="prose-autopilot">
			<h1 className="font-sans text-3xl font-black text-white mb-2">
				Integrations
			</h1>
			<p className="text-muted text-lg mb-8">
				No integration is hard-coded. All external services follow the
				same 3-part pattern. Infinitely extensible without writing code.
			</p>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				The 3-Part Integration Pattern
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Every integration in QUESTPIE Autopilot follows the same
				architecture. There is no "Linear sync module" or "GitHub
				integration plugin." There are just agents calling APIs, guided
				by knowledge docs, with scoped credentials.
			</p>
			<CodeBlock title="integration-pattern">
				{`Integration = Secret + Knowledge Doc + Primitive

┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  1. SECRET                                                   │
│     /company/secrets/{service}.yaml                          │
│     API key + allowed agents list                            │
│                                                              │
│  2. KNOWLEDGE DOC                                            │
│     /company/knowledge/integrations/{service}.md             │
│     API docs, endpoints, conventions, examples               │
│                                                              │
│  3. PRIMITIVE                                                │
│     Agent calls http_request() or MCP server tool            │
│     Orchestrator auto-injects credentials                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘`}
			</CodeBlock>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				Why This Works
			</h3>
			<ul className="text-ghost leading-relaxed space-y-2 mb-6">
				<li>
					<strong className="text-fg">Infinitely extensible</strong> — add any
					integration without code changes. New service? Add a secret + knowledge
					doc.
				</li>
				<li>
					<strong className="text-fg">Agent-native</strong> — agents learn from
					knowledge docs, not from hard-coded adapters. They read the API docs
					and figure out how to call it.
				</li>
				<li>
					<strong className="text-fg">Secure</strong> — secrets are scoped per
					agent. Only agents in the{' '}
					<code className="font-mono text-xs text-purple">allowed_agents</code>{' '}
					list can use a credential. Keys are never exposed directly to agents.
				</li>
				<li>
					<strong className="text-fg">Debuggable</strong> — every API call is
					logged in the activity feed. You can see exactly what an agent sent
					and received.
				</li>
				<li>
					<strong className="text-fg">No vendor lock-in</strong> — switch from
					Linear to Jira by changing the knowledge doc. The agents adapt.
				</li>
			</ul>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Step-by-Step: Adding a New Integration
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Adding a new integration takes about 2 minutes. Here is how to
				add Stripe as an example:
			</p>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				Step 1: Add the secret
			</h3>
			<CodeBlock title="terminal">
				{`$ autopilot secrets add stripe
Service: stripe
API key: sk_live_xxx (hidden)
Allowed agents (comma-separated): max, ops, ceo
Saved to /company/secrets/stripe.yaml`}
			</CodeBlock>
			<p className="text-ghost leading-relaxed mb-4">
				This creates the following file (the actual key value is encrypted
				at rest):
			</p>
			<CodeBlock title="/company/secrets/stripe.yaml">
				{`service: stripe
type: api_key
value: "sk_live_xxx"                    # Encrypted at rest
allowed_agents: [max, ops, ceo]
usage: |
  Use with Authorization: Bearer {value}
  Base URL: https://api.stripe.com/v1/
  Content-Type: application/x-www-form-urlencoded`}
			</CodeBlock>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				Step 2: Add the knowledge doc
			</h3>
			<p className="text-ghost leading-relaxed mb-4">
				Create a markdown file that teaches agents how to use the API.
				Include endpoints, auth format, and examples of common operations
				your company performs.
			</p>
			<CodeBlock title="/company/knowledge/integrations/stripe.md">
				{`# Stripe Integration

## Authentication
- API key via Authorization header: \`Bearer sk_live_xxx\`
- Secret ref: \`stripe\`
- Content-Type: application/x-www-form-urlencoded

## Common Operations

### Create a Product
POST https://api.stripe.com/v1/products
Body: name=Premium+Plan&active=true

### Create a Price
POST https://api.stripe.com/v1/prices
Body: product=prod_xxx&unit_amount=2900&currency=usd&recurring[interval]=month

### Create a Checkout Session
POST https://api.stripe.com/v1/checkout/sessions
Body: mode=subscription&success_url=https://app.example.com/success
      &line_items[0][price]=price_xxx&line_items[0][quantity]=1

## Our Conventions
- Always use test keys (sk_test_) in development
- Webhooks endpoint: /webhooks/stripe
- Products follow naming: "Plan Name - Monthly/Annual"
- Always set metadata.task_id on checkout sessions

## Webhook Events We Handle
- checkout.session.completed → update user subscription
- invoice.payment_failed → alert ops + notify customer
- customer.subscription.deleted → downgrade user`}
			</CodeBlock>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				Step 3: Agents use it
			</h3>
			<p className="text-ghost leading-relaxed mb-4">
				No configuration needed. When Max (developer) is working on a
				Stripe-related task, he reads the knowledge doc and calls the API:
			</p>
			<CodeBlock title="agent-calls-stripe.ts">
				{`// Max reads the integration docs
read_file("/knowledge/integrations/stripe.md")

// Max calls the Stripe API
http_request({
  method: "POST",
  url: "https://api.stripe.com/v1/products",
  secret_ref: "stripe",                    // Orchestrator auto-injects API key
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: "name=Premium+Plan&active=true"
})

// The orchestrator:
// 1. Reads /secrets/stripe.yaml
// 2. Checks that "max" is in allowed_agents → yes
// 3. Injects the API key into Authorization header
// 4. Executes the HTTP request
// 5. Returns the response to the agent
// 6. Logs the API call in the activity feed`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Integration Examples
			</h2>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				GitHub
			</h3>
			<CodeBlock title="/company/secrets/github.yaml">
				{`service: github
type: personal_access_token
value: "ghp_xxx"
allowed_agents: [max, riley, ops, ceo]
usage: |
  Authorization: token {value}
  Base URL: https://api.github.com/`}
			</CodeBlock>
			<CodeBlock title="agent-usage.ts">
				{`// Create a PR via GitHub API
http_request({
  method: "POST",
  url: "https://api.github.com/repos/questpie/web-app/pulls",
  secret_ref: "github",
  body: JSON.stringify({
    title: "feat: Pricing page with Stripe checkout",
    head: "feat/pricing-page",
    base: "main",
    body: "Implements pricing page per spec in TASK-003"
  })
})

// Or use git_create_pr primitive (uses GitHub secret internally)
git_create_pr({
  repo: "projects/web-app/code",
  title: "feat: Pricing page with Stripe checkout",
  branch: "feat/pricing-page",
  target: "main",
  reviewers: ["riley"]
})`}
			</CodeBlock>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				Linear
			</h3>
			<CodeBlock title="/company/secrets/linear.yaml">
				{`service: linear
type: api_token
value: "lin_api_xxx"
allowed_agents: [ceo, sam, max, riley]`}
			</CodeBlock>
			<CodeBlock title="agent-usage.ts">
				{`// Create an issue in Linear via GraphQL
http_request({
  method: "POST",
  url: "https://api.linear.app/graphql",
  secret_ref: "linear",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    query: \`mutation {
      issueCreate(input: {
        title: "Implement pricing page"
        teamId: "TEAM-123"
        priority: 2
        labelIds: ["feature"]
      }) {
        success
        issue { id identifier url }
      }
    }\`
  })
})`}
			</CodeBlock>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				Slack
			</h3>
			<CodeBlock title="/company/secrets/slack.yaml">
				{`service: slack
type: bot_token
value: "xoxb-xxx"
allowed_agents: [ceo, ops, morgan]
usage: |
  Authorization: Bearer {value}
  Base URL: https://slack.com/api/`}
			</CodeBlock>
			<CodeBlock title="agent-usage.ts">
				{`// Post to a Slack channel
http_request({
  method: "POST",
  url: "https://slack.com/api/chat.postMessage",
  secret_ref: "slack",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    channel: "#releases",
    text: "New release: Pricing page is live! Check it out at https://app.example.com/pricing"
  })
})`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Integration Methods
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				There are four ways agents interact with external services,
				depending on what tools are available:
			</p>
			<div className="overflow-x-auto mb-8">
				<table className="w-full text-sm border-collapse">
					<thead>
						<tr className="border-b border-border">
							<th className="text-left text-ghost font-mono text-xs py-2 pr-4">
								Method
							</th>
							<th className="text-left text-ghost font-mono text-xs py-2 pr-4">
								When to Use
							</th>
							<th className="text-left text-ghost font-mono text-xs py-2">
								Examples
							</th>
						</tr>
					</thead>
					<tbody className="text-ghost">
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								http_request + secret
							</td>
							<td className="py-2 pr-4 text-xs">
								Any REST or GraphQL API
							</td>
							<td className="py-2 text-xs">
								Linear, Stripe, Slack, Sendgrid, Twilio
							</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								MCP server
							</td>
							<td className="py-2 pr-4 text-xs">
								Rich tool interface exists for the service
							</td>
							<td className="py-2 text-xs">
								GitHub, Figma, Playwright, databases
							</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								run_command
							</td>
							<td className="py-2 pr-4 text-xs">
								CLI tool exists
							</td>
							<td className="py-2 text-xs">
								kubectl, terraform, aws-cli, gh
							</td>
						</tr>
						<tr>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								Agent SDK built-in
							</td>
							<td className="py-2 pr-4 text-xs">
								Web browsing and search
							</td>
							<td className="py-2 text-xs">
								WebSearch, WebFetch tools
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				MCP Servers vs http_request
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				MCP (Model Context Protocol) servers provide a richer tool
				interface than raw HTTP requests. Use MCP when a server exists
				for the service; use{' '}
				<code className="font-mono text-xs text-purple">http_request</code>{' '}
				for everything else.
			</p>
			<CodeBlock title="mcp-server-config">
				{`# Configure MCP servers per agent in agents.yaml
agents:
  - id: max
    name: Max
    role: developer
    mcps:
      - name: github
        command: "npx @modelcontextprotocol/server-github"
        env:
          GITHUB_TOKEN: "secret_ref:github"    # Auto-injected from secrets

      - name: playwright
        command: "npx @anthropic-ai/mcp-server-playwright"

      - name: postgres
        command: "npx @modelcontextprotocol/server-postgres"
        env:
          DATABASE_URL: "secret_ref:database"`}
			</CodeBlock>
			<p className="text-ghost leading-relaxed mb-4">
				When to choose which:
			</p>
			<ul className="text-ghost leading-relaxed space-y-1 text-sm">
				<li>
					<strong className="text-fg">MCP server</strong> — use when a
					well-maintained MCP server exists. Provides typed tools, better error
					handling, and richer responses. GitHub MCP server gives you tools like{' '}
					<code className="font-mono text-xs text-purple">create_issue</code>,{' '}
					<code className="font-mono text-xs text-purple">search_code</code>,{' '}
					<code className="font-mono text-xs text-purple">create_pull_request</code>.
				</li>
				<li>
					<strong className="text-fg">http_request</strong> — use for any
					REST/GraphQL API where no MCP server exists, or for simple one-off
					calls. More flexible, works with any API. The knowledge doc teaches
					the agent how to structure requests.
				</li>
			</ul>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Secret Management
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Secrets are stored in{' '}
				<code className="font-mono text-xs text-purple">
					/company/secrets/
				</code>{' '}
				as YAML files. Each secret specifies which agents can use it.
				The orchestrator handles injection — agents never see the raw
				key value.
			</p>
			<CodeBlock title="secret-lifecycle">
				{`# 1. Add a secret via CLI
$ autopilot secrets add stripe

# 2. Secret stored in /company/secrets/stripe.yaml
#    - value is encrypted at rest
#    - allowed_agents controls access

# 3. Agent calls http_request with secret_ref
http_request({
  url: "https://api.stripe.com/v1/products",
  secret_ref: "stripe"
})

# 4. Orchestrator flow:
#    a. Read /secrets/stripe.yaml
#    b. Check requesting agent is in allowed_agents
#    c. Decrypt value
#    d. Inject into request headers (Authorization: Bearer ...)
#    e. Execute request
#    f. Return response to agent (key never exposed)
#    g. Log API call in activity feed (key redacted)

# 5. Manage secrets
$ autopilot secrets list              # Show all secrets (values hidden)
$ autopilot secrets remove stripe     # Remove a secret`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Webhook Receivers
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				The orchestrator's webhook server (port 7777) receives external
				events and routes them to agents. Configure webhooks in{' '}
				<code className="font-mono text-xs text-purple">
					team/webhooks.yaml
				</code>
				:
			</p>
			<CodeBlock title="/company/team/webhooks.yaml">
				{`webhooks:
  - id: github-push
    path: /webhooks/github
    auth:
      type: hmac-sha256
      secret_ref: "github_webhook_secret"
    handler: ops
    filter:
      header: "X-GitHub-Event"
      value: "push"
    context_template: |
      GitHub push to {payload.repository.full_name}
      Branch: {payload.ref}
      Commits: {payload.commits.length}
      Pusher: {payload.pusher.name}

  - id: stripe-events
    path: /webhooks/stripe
    auth:
      type: stripe-signature
      secret_ref: "stripe_webhook_secret"
    handler: ops
    filter:
      body_path: "type"
      values: ["checkout.session.completed", "invoice.payment_failed"]

  - id: linear-updates
    path: /webhooks/linear
    auth:
      type: hmac-sha256
      secret_ref: "linear_webhook_secret"
    handler: ceo
    filter:
      body_path: "type"
      value: "Issue"`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Integration Checklist
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				To add any new integration, follow this checklist:
			</p>
			<ol className="text-ghost leading-relaxed space-y-2">
				<li>
					<strong className="text-fg">Add the secret</strong> —{' '}
					<code className="font-mono text-xs text-purple">
						autopilot secrets add &lt;service&gt;
					</code>
				</li>
				<li>
					<strong className="text-fg">Write the knowledge doc</strong> —
					create{' '}
					<code className="font-mono text-xs text-purple">
						knowledge/integrations/&lt;service&gt;.md
					</code>{' '}
					with API docs, endpoints, auth format, and common operations
				</li>
				<li>
					<strong className="text-fg">Set allowed agents</strong> — decide
					which agents need access to this service
				</li>
				<li>
					<strong className="text-fg">(Optional) Configure MCP</strong> — if
					an MCP server exists, add it to the agent's{' '}
					<code className="font-mono text-xs text-purple">mcps</code> config
				</li>
				<li>
					<strong className="text-fg">(Optional) Add webhooks</strong> — if
					the service sends events, add a webhook handler in{' '}
					<code className="font-mono text-xs text-purple">
						team/webhooks.yaml
					</code>
				</li>
				<li>
					<strong className="text-fg">Test it</strong> — give an intent that
					uses the integration and watch the agent work
				</li>
			</ol>
			<CodeBlock title="complete-example">
				{`# Full integration: GitHub + Stripe + Slack in 5 minutes

# Add secrets
$ autopilot secrets add github
$ autopilot secrets add stripe
$ autopilot secrets add slack

# Knowledge docs (create these files)
knowledge/integrations/
  github.md    # Repo URLs, branch conventions, PR templates
  stripe.md    # API endpoints, product naming, webhook events
  slack.md     # Channel names, message formatting, bot permissions

# Webhook receivers (add to team/webhooks.yaml)
webhooks:
  - path: /webhooks/github   handler: ops    auth: hmac-sha256
  - path: /webhooks/stripe   handler: ops    auth: stripe-signature

# Test it
$ autopilot ask "Build a pricing page with Stripe checkout and announce it on Slack"
# CEO decomposes → Max builds with Stripe → Morgan announces on Slack`}
			</CodeBlock>
		</article>
	)
}
