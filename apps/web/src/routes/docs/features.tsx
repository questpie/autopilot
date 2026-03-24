import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/CodeBlock'
import { seoHead } from '@/lib/seo'

export const Route = createFileRoute('/docs/features')({
	head: () => ({
		...seoHead({
			title: 'Features',
			description:
				'Complete feature list for QUESTPIE Autopilot — hybrid storage, unified search, multiple agent providers, transport plugins, and more.',
			path: '/docs/features',
		}),
	}),
	component: Features,
})

function Features() {
	return (
		<article className="prose-autopilot">
			<h1 className="font-sans text-3xl font-black text-white mb-2">
				Features
			</h1>
			<p className="text-muted text-lg mb-8">
				Everything QUESTPIE Autopilot can do today, and what is coming next.
			</p>

			{/* ── Unified Search ─────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Unified Search (FTS5 + Vector)
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Search across tasks, knowledge docs, channels, and agent memory
				with a single query. Two search engines run in parallel:
			</p>
			<div className="overflow-x-auto mb-4">
				<table className="w-full text-sm border-collapse">
					<thead>
						<tr className="border-b border-border">
							<th className="text-left text-ghost font-mono text-xs py-2 pr-4">
								Engine
							</th>
							<th className="text-left text-ghost font-mono text-xs py-2 pr-4">
								Technology
							</th>
							<th className="text-left text-ghost font-mono text-xs py-2">
								Best For
							</th>
						</tr>
					</thead>
					<tbody className="text-ghost">
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs text-fg">Full-text</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								SQLite FTS5
							</td>
							<td className="py-2 text-xs">
								Exact keyword matches, task IDs, agent names, file paths
							</td>
						</tr>
						<tr>
							<td className="py-2 pr-4 text-xs text-fg">Semantic</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								sqlite-vec embeddings
							</td>
							<td className="py-2 text-xs">
								Conceptual similarity, natural language queries, related content
							</td>
						</tr>
					</tbody>
				</table>
			</div>
			<p className="text-ghost leading-relaxed mb-4 text-sm">
				Results from both engines are merged and ranked. The search index
				is kept in sync with the filesystem automatically by the indexer
				module.
			</p>

			{/* ── Embedding Service ─────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Embedding Service
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Vector embeddings power semantic search and knowledge retrieval.
				The embedding service supports multiple providers with automatic
				fallback:
			</p>
			<div className="overflow-x-auto mb-4">
				<table className="w-full text-sm border-collapse">
					<thead>
						<tr className="border-b border-border">
							<th className="text-left text-ghost font-mono text-xs py-2 pr-4">
								Provider
							</th>
							<th className="text-left text-ghost font-mono text-xs py-2 pr-4">
								Model
							</th>
							<th className="text-left text-ghost font-mono text-xs py-2">
								Notes
							</th>
						</tr>
					</thead>
					<tbody className="text-ghost">
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs text-fg">Gemini</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								text-embedding-004
							</td>
							<td className="py-2 text-xs">
								Primary. High quality, fast. Requires GOOGLE_API_KEY.
							</td>
						</tr>
						<tr>
							<td className="py-2 pr-4 text-xs text-fg">Local fallback</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								TF-IDF hashing
							</td>
							<td className="py-2 text-xs">
								Zero-cost fallback when no API key is configured. Lower quality
								but works offline.
							</td>
						</tr>
					</tbody>
				</table>
			</div>
			<p className="text-ghost leading-relaxed mb-4 text-sm">
				Knowledge docs, task descriptions, and agent memory are
				automatically embedded and indexed. New content is embedded
				on write.
			</p>

			{/* ── Multiple Agent Providers ──────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Multiple Agent Providers
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				The agent spawner supports multiple AI backends through a
				provider abstraction. Configure per-agent or company-wide:
			</p>
			<div className="overflow-x-auto mb-4">
				<table className="w-full text-sm border-collapse">
					<thead>
						<tr className="border-b border-border">
							<th className="text-left text-ghost font-mono text-xs py-2 pr-4">
								Provider
							</th>
							<th className="text-left text-ghost font-mono text-xs py-2 pr-4">
								Config Value
							</th>
							<th className="text-left text-ghost font-mono text-xs py-2">
								Features
							</th>
						</tr>
					</thead>
					<tbody className="text-ghost">
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs text-fg">Claude Agent SDK</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								claude-agent-sdk
							</td>
							<td className="py-2 text-xs">
								Primary. File tools, MCP, sandboxing, hooks, sub-agents.
							</td>
						</tr>
						<tr>
							<td className="py-2 pr-4 text-xs text-fg">Codex SDK</td>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								codex-sdk
							</td>
							<td className="py-2 text-xs">
								OpenAI Codex runtime. Alternative provider for specific agents.
							</td>
						</tr>
					</tbody>
				</table>
			</div>
			<CodeBlock title="company.yaml — provider config">
				{`settings:
  agent_provider: "claude-agent-sdk"   # default for all agents
  agent_model: "claude-sonnet-4-6"

# Or per-agent in agents.yaml:
agents:
  - id: max
    provider: "codex-sdk"              # override for this agent
    model: "codex-mini-latest"`}
			</CodeBlock>

			{/* ── Transport Registry ───────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Transport Registry
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Notification transports are pluggable via a registry pattern.
				Built-in adapters and webhook handlers route notifications
				to the right channel based on priority and user preferences.
			</p>
			<div className="overflow-x-auto mb-4">
				<table className="w-full text-sm border-collapse">
					<thead>
						<tr className="border-b border-border">
							<th className="text-left text-ghost font-mono text-xs py-2 pr-4">
								Transport
							</th>
							<th className="text-left text-ghost font-mono text-xs py-2 pr-4">
								Status
							</th>
							<th className="text-left text-ghost font-mono text-xs py-2">
								Notes
							</th>
						</tr>
					</thead>
					<tbody className="text-ghost">
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs text-fg">Telegram</td>
							<td className="py-2 pr-4 font-mono text-xs text-accent-green">
								Available
							</td>
							<td className="py-2 text-xs">
								Built-in adapter + webhook handler. Two-way messaging.
							</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs text-fg">Dashboard</td>
							<td className="py-2 pr-4 font-mono text-xs text-accent-green">
								Available
							</td>
							<td className="py-2 text-xs">
								SSE-based realtime notifications in the Living Dashboard.
							</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs text-fg">Slack</td>
							<td className="py-2 pr-4 font-mono text-xs text-muted">
								Coming Soon
							</td>
							<td className="py-2 text-xs">
								Planned. Knowledge-doc based integration pattern.
							</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 text-xs text-fg">Email</td>
							<td className="py-2 pr-4 font-mono text-xs text-muted">
								Coming Soon
							</td>
							<td className="py-2 text-xs">
								Planned. SMTP or transactional email service.
							</td>
						</tr>
						<tr>
							<td className="py-2 pr-4 text-xs text-fg">WhatsApp</td>
							<td className="py-2 pr-4 font-mono text-xs text-muted">
								Coming Soon
							</td>
							<td className="py-2 text-xs">
								Planned. Twilio-based adapter.
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			{/* ── Language Configuration ────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Language Configuration
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Configure the primary language and supported languages for your
				company. Agents will respond and create content in the configured
				language. Set in{' '}
				<code className="font-mono text-xs text-purple">company.yaml</code>:
			</p>
			<CodeBlock title="company.yaml">
				{`language: "en"                    # primary language
languages: ["en", "sk", "de"]    # supported languages`}
			</CodeBlock>
			<p className="text-ghost leading-relaxed mb-4 text-sm">
				The language setting is injected into agent context assembly,
				so agents know which language to use for task descriptions,
				commit messages, documentation, and communication.
			</p>

			{/* ── Hybrid Storage ───────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Hybrid Storage (SQLite + Filesystem)
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				QUESTPIE Autopilot uses a hybrid storage model. YAML and
				Markdown files remain the source of truth -- human-readable,
				git-versioned, and portable. SQLite + Drizzle ORM provides:
			</p>
			<ul className="text-ghost leading-relaxed space-y-2 mb-4">
				<li>
					<strong className="text-fg">Fast indexed queries</strong> --
					task lists, agent lookups, status counts without scanning directories
				</li>
				<li>
					<strong className="text-fg">FTS5 full-text search</strong> --
					search across all content types with ranking
				</li>
				<li>
					<strong className="text-fg">sqlite-vec embeddings</strong> --
					vector similarity search for semantic queries
				</li>
				<li>
					<strong className="text-fg">Better Auth</strong> --
					dashboard and API authentication and security
				</li>
				<li>
					<strong className="text-fg">Automatic sync</strong> --
					the indexer watches filesystem changes and keeps SQLite in sync
				</li>
			</ul>
			<p className="text-ghost leading-relaxed mb-4 text-sm">
				If you delete the SQLite database, it is fully rebuilt from files.
				Files are always the canonical source.
			</p>

			{/* ── SSE Realtime ──────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				SSE Realtime
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				All realtime communication uses Server-Sent Events (SSE) instead
				of polling. The dashboard, session attach, and activity feed all
				stream events as they happen:
			</p>
			<ul className="text-ghost leading-relaxed space-y-2 mb-4">
				<li>
					<strong className="text-fg">Session streaming</strong> --
					<code className="font-mono text-xs text-purple">autopilot attach</code>{' '}
					connects to SSE endpoint for live agent output
				</li>
				<li>
					<strong className="text-fg">Dashboard updates</strong> --
					task status changes, board pins, and activity feed update instantly
				</li>
				<li>
					<strong className="text-fg">No polling overhead</strong> --
					single HTTP connection per subscriber, server pushes events
				</li>
			</ul>

			{/* ── Git Auto-Commit ──────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Git Auto-Commit
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Every agent action that modifies the filesystem is automatically
				committed to Git. This provides a complete audit trail of every
				task creation, status change, message, and code change. Use{' '}
				<code className="font-mono text-xs text-purple">autopilot git log</code>{' '}
				to browse the history.
			</p>

			{/* ── Core Features (existing) ────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Core Features
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				These features form the foundation and have been verified as
				accurate by internal audit:
			</p>
			<ul className="text-ghost leading-relaxed space-y-2">
				<li>
					<strong className="text-fg">Multi-agent orchestration</strong> --
					8 built-in role templates, custom agents, concurrent execution
				</li>
				<li>
					<strong className="text-fg">Workflow engine</strong> --
					YAML-defined state machines with human gates
				</li>
				<li>
					<strong className="text-fg">Persistent memory</strong> --
					per-agent facts, decisions, mistakes, patterns
				</li>
				<li>
					<strong className="text-fg">4-layer context assembly</strong> --
					identity, company state, memory, task context
				</li>
				<li>
					<strong className="text-fg">Skills system</strong> --
					markdown knowledge packages loaded into context
				</li>
				<li>
					<strong className="text-fg">Artifact serving</strong> --
					lazy cold-start preview server for agent outputs
				</li>
				<li>
					<strong className="text-fg">Living Dashboard</strong> --
					widget runtime, theme overrides, dev/prod mode
				</li>
			</ul>
		</article>
	)
}
