import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/CodeBlock'
import { seoHead } from '@/lib/seo'

export const Route = createFileRoute('/docs/integrations-setup')({
	head: () => ({ ...seoHead({ title: 'Integration Setup', description: 'Step-by-step guide to setting up integrations. Secret management, knowledge docs, webhook configuration, and OAuth.', path: '/docs/integrations-setup', ogImage: 'https://autopilot.questpie.com/og-integrations.png' }) }),
	component: IntegrationsSetup,
})

function IntegrationsSetup() {
	return (
		<article className="prose-autopilot">
			<h1 className="font-sans text-3xl font-black text-white mb-2">
				Integration Setup
			</h1>
			<p className="text-muted text-lg mb-8">
				How agents set up integrations. 3-part pattern: Secret +
				Knowledge Doc + Primitive. No code, no plugins, no adapters.
			</p>

			{/* ── The 3-Part Pattern ─────────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				The 3-Part Pattern
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Every integration follows the same architecture. There are no
				special modules or plugins. Agents learn from knowledge docs
				and call APIs with scoped credentials.
			</p>
			<CodeBlock title="integration-pattern">
				{`Integration = Secret + Knowledge Doc + Primitive

1. SECRET          → /company/secrets/{service}.yaml
                      API key + allowed agents list
                      Encrypted at rest, injected by orchestrator

2. KNOWLEDGE DOC   → /company/knowledge/integrations/{service}.md
                      API docs, endpoints, conventions, examples
                      Agents read this to learn how to call the API

3. PRIMITIVE       → Agent calls http_request() with secret_ref
                      Orchestrator auto-injects credentials
                      All calls logged in activity feed`}
			</CodeBlock>

			{/* ── Agent Workflow ──────────────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				How Agents Set Up Integrations
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Integration setup is not manual configuration. You tell the
				CEO agent what you need and the agents handle the rest:
			</p>
			<CodeBlock title="terminal">
				{`$ autopilot ask "Set up Slack integration so agents can post to #releases"

# CEO agent:
#   1. Creates secret: autopilot secrets add slack
#   2. Asks you for the bot token (human approval gate)
#   3. Writes knowledge doc: knowledge/integrations/slack.md
#   4. Configures webhook: team/webhooks.yaml
#   5. Tests it: posts a test message to #releases
#   6. Reports: "Slack integration ready. Agents: ceo, ops, morgan"`}
			</CodeBlock>

			{/* ── Secret Management ──────────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Secret Management
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Secrets are stored in{' '}
				<code className="font-mono text-xs text-purple">
					/company/secrets/
				</code>{' '}
				as YAML files. Values are encrypted at rest using AES-256-GCM.
				Agents never see the raw key -- the orchestrator injects it
				into requests at execution time.
			</p>
			<CodeBlock title="terminal">
				{`# Add a secret
$ autopilot secrets add stripe
Service: stripe
API key: sk_live_xxx (hidden)
Allowed agents (comma-separated): max, ops, ceo
Saved to /company/secrets/stripe.yaml

# List secrets (values always hidden)
$ autopilot secrets list
SECRETS — 4 configured

  SERVICE   TYPE               ALLOWED AGENTS
  github    personal_access    max, riley, ops, ceo
  linear    api_token          ceo, sam, max, riley
  slack     bot_token          ceo, ops, morgan
  stripe    api_key            max, ops, ceo

# Remove a secret
$ autopilot secrets remove stripe`}
			</CodeBlock>
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

			{/* ── Knowledge Docs ──────────────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Knowledge Docs
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Knowledge docs teach agents how to use the API. Include
				authentication format, endpoints, common operations, and
				your company's conventions.
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

			{/* ── Webhook Setup ──────────────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Webhook Setup
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				The orchestrator's webhook server (port 7777) receives events
				from external services and routes them to agents. Configure in{' '}
				<code className="font-mono text-xs text-purple">
					team/webhooks.yaml
				</code>
				. HMAC verification ensures only legitimate events are
				processed.
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
      value: "Issue"

  - id: slack-commands
    path: /webhooks/slack
    auth:
      type: hmac-sha256
      secret_ref: "slack_signing_secret"
    handler: ceo

  - id: telegram-bot
    path: /webhooks/telegram
    auth:
      type: token-in-url
      secret_ref: "telegram_bot_token"
    handler: ceo`}
			</CodeBlock>

			{/* ── Integration Examples ───────────────────────────── */}

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
				{`// Via MCP server (typed tools)
git_create_pr({
  repo: "projects/web-app/code",
  title: "feat: Pricing page",
  branch: "feat/pricing-page",
  target: "main",
  reviewers: ["riley"]
})

// Or via http_request (any endpoint)
http_request({
  method: "POST",
  url: "https://api.github.com/repos/questpie/web-app/issues",
  secret_ref: "github",
  body: JSON.stringify({ title: "Bug: Login broken", labels: ["bug"] })
})`}
			</CodeBlock>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				Linear
			</h3>
			<CodeBlock title="/company/secrets/linear.yaml">
				{`service: linear
type: api_token
value: "lin_api_xxx"
allowed_agents: [ceo, sam, max, riley]
usage: |
  Authorization: {value}
  Base URL: https://api.linear.app/graphql
  Content-Type: application/json`}
			</CodeBlock>
			<CodeBlock title="agent-usage.ts">
				{`http_request({
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
				{`http_request({
  method: "POST",
  url: "https://slack.com/api/chat.postMessage",
  secret_ref: "slack",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    channel: "#releases",
    text: "New release: Pricing page is live!"
  })
})`}
			</CodeBlock>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				Stripe
			</h3>
			<CodeBlock title="agent-usage.ts">
				{`http_request({
  method: "POST",
  url: "https://api.stripe.com/v1/checkout/sessions",
  secret_ref: "stripe",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: "mode=subscription&success_url=https://app.example.com/success"
    + "&line_items[0][price]=price_xxx&line_items[0][quantity]=1"
})`}
			</CodeBlock>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				Telegram
			</h3>
			<CodeBlock title="/company/secrets/telegram.yaml">
				{`service: telegram
type: bot_token
value: "123456:ABC-xxx"
allowed_agents: [ceo, morgan]
usage: |
  Base URL: https://api.telegram.org/bot{value}/
  Content-Type: application/json`}
			</CodeBlock>
			<CodeBlock title="agent-usage.ts">
				{`http_request({
  method: "POST",
  url: "https://api.telegram.org/bot{secret:telegram}/sendMessage",
  secret_ref: "telegram",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    chat_id: "-100123456789",
    text: "Deploy complete: v2.1.0 is live"
  })
})`}
			</CodeBlock>

			{/* ── OAuth Flow (Future) ────────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				OAuth Flow (Future)
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				For services that require OAuth (Google, Microsoft, etc.), a
				future version will support browser-based authorization flow:
			</p>
			<CodeBlock title="future-oauth-flow">
				{`# Agent registers an OAuth provider
auth_register_provider({
  provider: "google",
  client_id: "xxx.apps.googleusercontent.com",
  client_secret: "secret_ref:google_oauth",
  scopes: ["calendar.events", "gmail.send"]
})

# Dashboard shows "Authorize Google" button
# Human clicks → OAuth popup → consent screen → callback
# Token stored encrypted in secrets/
# Agents can now use Google APIs with automatic token refresh`}
			</CodeBlock>

			{/* ── Step-by-Step ────────────────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Complete Setup Checklist
			</h2>
			<ol className="text-ghost leading-relaxed space-y-2 mb-6">
				<li>
					<strong className="text-fg">Add the secret</strong> --{' '}
					<code className="font-mono text-xs text-purple">
						autopilot secrets add {'<service>'}
					</code>
				</li>
				<li>
					<strong className="text-fg">Write the knowledge doc</strong>{' '}
					-- create{' '}
					<code className="font-mono text-xs text-purple">
						knowledge/integrations/{'<service>'}.md
					</code>
				</li>
				<li>
					<strong className="text-fg">Set allowed agents</strong> --
					only agents who need the service get access
				</li>
				<li>
					<strong className="text-fg">(Optional) Add webhook</strong>{' '}
					-- if the service sends events, add to{' '}
					<code className="font-mono text-xs text-purple">
						team/webhooks.yaml
					</code>
				</li>
				<li>
					<strong className="text-fg">(Optional) Configure MCP</strong>{' '}
					-- if an MCP server exists, add to agent's{' '}
					<code className="font-mono text-xs text-purple">mcps</code>{' '}
					config
				</li>
				<li>
					<strong className="text-fg">Test it</strong> -- give an
					intent that uses the integration and watch the agent work
				</li>
			</ol>
		</article>
	)
}
