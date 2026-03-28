import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/landing/CodeBlock'
import { Header } from '@/components/landing/Header'
import { Section, SectionHeader } from '@/components/landing/Section'
import { Tag } from '@/components/landing/Tag'

export const Route = createFileRoute('/features/security')({
	head: () => ({
		meta: [
			{ title: 'Enterprise Security — QuestPie Autopilot' },
			{
				name: 'description',
				content:
					'Better Auth, 2FA, RBAC, encrypted secrets, IP allowlist, rate limiting, filesystem sandbox, audit logs. GDPR-native. Self-hosted.',
			},
			{
				property: 'og:title',
				content: 'Enterprise Security — QuestPie Autopilot',
			},
			{
				property: 'og:description',
				content:
					'Better Auth, 2FA, RBAC, encrypted secrets, IP allowlist, rate limiting, filesystem sandbox, audit logs. GDPR-native. Self-hosted.',
			},
			{ property: 'og:type', content: 'website' },
			{
				property: 'og:url',
				content: 'https://autopilot.questpie.com/features/security',
			},
			{ property: 'og:site_name', content: 'QUESTPIE Autopilot' },
			{ name: 'twitter:card', content: 'summary_large_image' },
			{
				name: 'twitter:title',
				content: 'Enterprise Security — QuestPie Autopilot',
			},
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
				<section className="px-4 py-24 md:px-8 md:py-32 border-b border-lp-border">
					<div className="mb-4">
						<Tag>SECURITY</Tag>
					</div>
					<h1 className="font-mono text-[36px] sm:text-[48px] font-bold text-white m-0 leading-tight tracking-[-0.03em]">
						14 Layers. Zero Trust.
						<br />
						Self-Hosted.
					</h1>
					<p className="font-sans text-base sm:text-lg text-lp-muted mt-5 leading-relaxed max-w-[640px]">
						Enterprise-grade security built from day one — not bolted on after a
						breach.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Authentication, authorization, encryption, sandboxing, and auditing
						are all included and enabled by default. Self-hosted means your data
						never leaves your infrastructure. MIT licensed means you can audit
						every line of the source code yourself. GDPR-native means no data
						leaves the EU unless you configure it to.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Security is not a feature tier. It is not an enterprise add-on.
						Every security layer is available in the free self-hosted version.
						Every user gets the same protection.
					</p>
					<div className="mt-8">
						<a
							href="/docs/getting-started"
							className="inline-block bg-[#B700FF] text-white font-mono text-sm px-6 py-3 hover:bg-[#9200CC] transition-colors no-underline"
						>
							Get Started
						</a>
					</div>
				</section>

				{/* ========== AUTHENTICATION ========== */}
				<Section id="auth">
					<SectionHeader
						num="01"
						sub="Email/password with 12+ character minimum. TOTP 2FA with backup codes. Invite-only registration."
					>
						Authentication That Stops Attackers
					</SectionHeader>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Better Auth
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Email and password with a minimum 12-character policy
								enforced at registration. Sessions expire after 30 days with
								active session management — list all sessions, revoke
								individual sessions, or revoke all sessions.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Invite-Only
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								No one creates an account unless you explicitly invite them.
								No open registration endpoints, no unauthorized access.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								TOTP 2FA
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Standard QR code for any authenticator app. 10 backup codes
								for recovery. 30-day device trust. Mandatory for owner and
								admin roles.
							</p>
						</div>
					</div>
				</Section>

				{/* ========== RBAC ========== */}
				<Section id="rbac">
					<SectionHeader
						num="02"
						sub="Owner, admin, member, viewer — each with precise resource-level access control."
					>
						4 Roles. Granular Permissions.
					</SectionHeader>

					<p className="font-sans text-sm text-lp-muted max-w-[640px]">
						Four built-in roles provide cascading access levels. Owners have
						full control over all resources and settings. Admins manage the team
						and company configuration. Members operate within their assigned
						scope. Viewers can see everything but change nothing.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Permissions follow a{' '}
						<code className="font-mono text-lp-fg text-xs">
							resource.action
						</code>{' '}
						format.{' '}
						<code className="font-mono text-lp-fg text-xs">tasks.create</code>
						,{' '}
						<code className="font-mono text-lp-fg text-xs">secrets.read</code>,{' '}
						<code className="font-mono text-lp-fg text-xs">
							agents.configure
						</code>{' '}
						— each permission is specific and granular. Roles are assigned per
						user, and you can mix roles across your human team members.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Agent API keys follow the{' '}
						<code className="font-mono text-lp-fg text-xs">ap_*</code> naming
						convention and carry scoped permissions. CI/CD integration uses
						Better Auth keys with their own permission scope. Every API call is
						authenticated and authorized against the role of the caller.
					</p>
				</Section>

				{/* ========== SECRETS ========== */}
				<Section id="secrets">
					<SectionHeader
						num="03"
						sub="Encrypted secrets with master key isolation. Each agent only sees the secrets it needs."
					>
						AES-256-GCM. Per-Agent Scoping.
					</SectionHeader>

					<p className="font-sans text-sm text-lp-muted max-w-[640px]">
						All secrets are encrypted at rest with AES-256-GCM. The master
						encryption key is isolated from agent access — no agent, regardless
						of its role or tools, can read the encryption key.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Per-agent secret scoping means you assign specific secrets to
						specific agents. Max gets the GitHub token. Ops gets the deployment
						credentials. Morgan gets the analytics API key. No agent sees
						credentials it does not need.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Secrets are injected into HTTP tool calls at runtime. When Max calls
						the GitHub API, the token is injected into the request header
						automatically. The secret never appears in agent context,
						configuration files, or tool call logs.
					</p>

					<div className="mt-6 max-w-[640px]">
						<CodeBlock title="terminal">
							{`autopilot secrets set GITHUB_TOKEN --agent max
autopilot secrets set DEPLOY_KEY --agent ops
autopilot secrets set ANALYTICS_KEY --agent morgan`}
						</CodeBlock>
					</div>
				</Section>

				{/* ========== NETWORK SECURITY ========== */}
				<Section id="network">
					<SectionHeader
						num="04"
						sub="Three layers of network defense that protect your infrastructure from agent-initiated attacks."
					>
						SSRF Protection. Rate Limiting. IP Allowlist.
					</SectionHeader>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								SSRF Protection
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Every HTTP request made by an agent goes through DNS
								resolution and private IP blocking. Agents cannot reach
								internal services, localhost, or private network ranges.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								3-Layer Rate Limiting
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Auth endpoints: 10 attempts per 5 minutes. IP-based: 20
								requests per minute. Actor-based: 300/min for humans,
								600/min for agents.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								IP Allowlist
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Restrict dashboard access to specific networks. Full IPv4
								and IPv6 CIDR support with cached configuration (30-second
								TTL).
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Webhook Auth
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								HMAC-SHA256 verification with per-webhook or global secrets
								and timing-safe comparison. Inbound webhooks authenticated
								before processing.
							</p>
						</div>
					</div>

					<p className="font-sans text-xs text-lp-muted mt-4">
						Security Headers — CSP, X-Frame-Options, HSTS, and Referrer-Policy
						— are set on every response.
					</p>
				</Section>

				{/* ========== AGENT SANDBOX ========== */}
				<Section id="sandbox">
					<SectionHeader
						num="05"
						sub="Each agent has explicit read/write globs. Sensitive directories are hardcoded as denied."
					>
						Filesystem Sandbox Per Agent
					</SectionHeader>

					<div className="max-w-[640px]">
						<CodeBlock title="company.yaml — sandbox">
							{`agents:
  max:
    fs_scope:
      read: ["./src/**", "./tests/**", "./package.json"]
      write: ["./src/**", "./tests/**"]
      # .auth/, .data/, .git/ always denied`}
						</CodeBlock>
					</div>

					<p className="font-sans text-sm text-lp-muted mt-6 max-w-[640px]">
						Per-agent filesystem scopes are defined in YAML configuration. Read
						globs specify which directories an agent can read. Write globs
						specify which directories it can modify. Outside these paths, the
						agent has no filesystem access.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Hardcoded deny patterns protect sensitive directories regardless of
						glob configuration.{' '}
						<code className="font-mono text-lp-fg text-xs">.auth/</code>,{' '}
						<code className="font-mono text-lp-fg text-xs">.data/</code>, and{' '}
						<code className="font-mono text-lp-fg text-xs">.git/</code> are
						always blocked. No agent can read authentication data, database
						files, or git internals. This protection is enforced at the tool
						level and cannot be overridden by configuration.
					</p>
				</Section>

				{/* ========== AUDIT TRAIL ========== */}
				<Section id="audit">
					<SectionHeader
						num="06"
						sub="Append-only JSONL logs with daily rotation. Protected from agent access."
					>
						Every Action. Every Agent. Logged.
					</SectionHeader>

					<p className="font-sans text-sm text-lp-muted max-w-[640px]">
						Every tool call, message, task state change, and authentication
						event is written to the audit log. Each entry is a JSON object on a
						single line with the agent identity, action type, timestamp, input
						parameters, and result. Standard JSONL format means any log
						ingestion tool can parse it.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Daily rotation creates one file per day. Once rotated, log files are
						never modified. The append-only design means historical records
						cannot be altered or deleted — not by agents, not by users, not by
						the system.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Agents cannot read or modify audit logs. The log directory is in the
						hardcoded deny list. Session management is audited too — every
						login, logout, session revocation, and banned user detection is
						recorded.
					</p>
				</Section>

				{/* ========== DATA SOVEREIGNTY ========== */}
				<Section id="sovereignty">
					<SectionHeader
						num="07"
						sub="MIT licensed. Self-hosted. Your data stays on your servers. Period."
					>
						Your Data. Your Infrastructure.
					</SectionHeader>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								MIT License
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Audit the source code, verify there is no telemetry, modify
								the behavior, and deploy it wherever you choose. No license
								key, no phone-home, no activation server.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Self-Hosted
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								The entire system runs on your infrastructure — your server,
								your network, behind your firewall. No data transits through
								QuestPie servers. No metadata, no usage analytics.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								GDPR-Native
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Data residency is under your control by default because the
								data never leaves the machine you install it on. For
								EU-based companies, compliance is a deployment decision, not
								a configuration exercise.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Filesystem-First
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								All data lives in one directory. Back up with{' '}
								<code className="font-mono text-lp-fg">cp -r</code>. Migrate
								with{' '}
								<code className="font-mono text-lp-fg">scp</code>. Delete
								with{' '}
								<code className="font-mono text-lp-fg">rm -rf</code>.
								Standard tools, standard operations.
							</p>
						</div>
					</div>
				</Section>

				{/* ========== CTA ========== */}
				<section className="px-4 py-16 md:px-8 text-center border-t border-lp-border">
					<h2 className="font-mono text-xl sm:text-2xl font-bold text-white mb-4">
						Security built in, not bolted on
					</h2>
					<p className="font-sans text-sm text-lp-muted mb-8 max-w-md mx-auto">
						14 layers. Self-hosted. MIT licensed. Every feature free.
					</p>
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
