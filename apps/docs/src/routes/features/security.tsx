import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/landing/CodeBlock'
import { Header } from '@/components/landing/Header'

export const Route = createFileRoute('/features/security')({
	head: () => ({
		meta: [
			{ title: 'Security — QuestPie Autopilot' },
			{
				name: 'description',
				content:
					'Better Auth, 2FA, RBAC, AES-256-GCM secrets, IP allowlist, rate limiting, filesystem sandbox, audit logs. Self-hosted. MIT licensed.',
			},
			{
				property: 'og:title',
				content: 'Security — QuestPie Autopilot',
			},
			{
				property: 'og:description',
				content:
					'Better Auth, 2FA, RBAC, AES-256-GCM secrets, agent sandbox, audit logs. Self-hosted.',
			},
			{ property: 'og:type', content: 'website' },
			{
				property: 'og:url',
				content: 'https://autopilot.questpie.com/features/security',
			},
			{ property: 'og:site_name', content: 'QUESTPIE Autopilot' },
			{ name: 'twitter:card', content: 'summary_large_image' },
		],
		links: [
			{
				rel: 'canonical',
				href: 'https://autopilot.questpie.com/features/security',
			},
		],
	}),
	component: FeatureSecurityPage,
})

function FeatureSecurityPage() {
	return (
		<div className="landing-page">
			<Header />
			<main className="border-lp-border mx-auto max-w-[1200px] border-x lp-grid-bg">
				{/* ========== HERO ========== */}
				<section className="px-4 py-20 md:px-8 md:py-28 border-b border-lp-border">
					<p className="font-mono text-xs text-lp-muted tracking-[0.15em] uppercase mb-4">
						SECURITY
					</p>
					<h1 className="font-mono text-[32px] sm:text-[48px] font-bold text-white m-0 leading-tight tracking-[-0.03em]">
						14 Layers.
						<br />
						Your Machine.
					</h1>
					<p className="font-sans text-base text-lp-muted mt-5 leading-relaxed max-w-[560px]">
						Self-hosted. MIT licensed. No telemetry. Every layer ships free.
					</p>
				</section>

				{/* ========== CORE — all 14 layers ========== */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<p className="font-mono text-xs text-lp-muted tracking-[0.15em] uppercase mb-6">
						THE STACK
					</p>

					<div className="border-l-2 border-[#B700FF] pl-6">
						<pre className="font-mono text-sm text-lp-muted leading-relaxed whitespace-pre overflow-x-auto">
							{` 1  Authentication      Better Auth · email/password · 12+ char minimum
 2  Two-Factor Auth    TOTP · QR provisioning · 10 backup codes
 3  Authorization      RBAC · owner / admin / member / viewer
 4  Secrets Vault      AES-256-GCM · per-agent scoping · master key isolation
 5  Filesystem Sandbox Per-agent read/write globs · enforced at tool level
 6  Deny Patterns      .auth/ .data/ .git/ always blocked · no override
 7  Rate Limiting      Auth: 10/5min · IP: 20/min · Actor: 300/min
 8  IP Allowlist       IPv4/IPv6 CIDR ranges · 30s cache TTL
 9  SSRF Protection    DNS resolution gate · private IP blocking
10  Webhook Signing    HMAC-SHA256 · timing-safe comparison
11  API Keys           ap_* prefix · scoped to resource.action permissions
12  Session Mgmt       30-day expiry · individual revocation · device tracking
13  Audit Logs         Append-only JSONL · daily rotation · agent-inaccessible
14  Security Headers   CSP · HSTS · X-Frame-Options · Referrer-Policy

    Self-hosted. No QuestPie servers. No phone-home. No metadata collection.`}
						</pre>
					</div>
				</section>

				{/* ========== HOW — secrets.yaml + roles.yaml ========== */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<p className="font-mono text-xs text-lp-muted tracking-[0.15em] uppercase mb-6">
						THE CONFIG
					</p>

					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
						<CodeBlock title="secrets.yaml">
							{`# AES-256-GCM encrypted at rest
# Master key stored in .auth/master.key (deny-listed)
# Agents only see secrets scoped to them

encryption:
  algorithm: aes-256-gcm
  key_derivation: scrypt
  salt_bytes: 32
  iv_bytes: 12

secrets:
  - name: GITHUB_TOKEN
    agent: max
    created: 2026-03-15
    # max can push branches, open PRs
    # riley, ops, ceo — no access

  - name: DEPLOY_KEY
    agent: ops
    created: 2026-03-15
    # ops deploys to staging + production
    # no other agent can trigger deploys

  - name: ANALYTICS_KEY
    agent: morgan
    created: 2026-03-16
    # morgan reads dashboards
    # cannot write or delete data

  - name: LINEAR_API_KEY
    agent: ceo
    created: 2026-03-14
    # ceo creates tasks, reads backlogs
    # syncs with external project management

# Injection: runtime only, into HTTP tool calls
# Never in agent context window
# Never in logs
# Never in config files on disk`}
						</CodeBlock>

						<CodeBlock title="roles.yaml">
							{`# RBAC for human users
# Every API call checked against caller role

roles:
  owner:
    description: Full control
    permissions:
      - "*"
    limits:
      max_per_org: 1

  admin:
    description: Manage team and agents
    permissions:
      - agents.configure
      - agents.start
      - agents.stop
      - tasks.create
      - tasks.assign
      - tasks.delete
      - secrets.read
      - secrets.write
      - workflows.edit
      - members.invite
      - members.remove
    limits:
      max_per_org: 5

  member:
    description: Operate within assigned scope
    permissions:
      - tasks.create
      - tasks.assign
      - tasks.comment
      - agents.start
      - agents.stop
      - workflows.run
      - secrets.read

  viewer:
    description: Read-only everywhere
    permissions:
      - tasks.read
      - agents.read
      - workflows.read
      - logs.read
      - secrets.list
      # no .write, .delete, .configure on anything

# Permission format: resource.action
# Checked on every API call
# Denied = 403 + audit log entry`}
						</CodeBlock>
					</div>
				</section>

				{/* ========== CTA ========== */}
				<section className="px-4 py-16 md:px-8">
					<div className="max-w-md">
						<CodeBlock title="terminal">
							{`$ bun add -g @questpie/autopilot
$ autopilot init my-company
$ autopilot start`}
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
