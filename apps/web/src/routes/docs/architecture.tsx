import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/CodeBlock'

export const Route = createFileRoute('/docs/architecture')({
	head: () => ({
		meta: [{ title: 'Architecture — QUESTPIE Autopilot' }],
	}),
	component: Architecture,
})

function Architecture() {
	return (
		<article className="prose-autopilot">
			<h1 className="font-sans text-3xl font-black text-white mb-2">
				Architecture
			</h1>
			<p className="text-muted text-lg mb-8">
				Four layers. Single process. Filesystem-native.
			</p>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				System Overview
			</h2>
			<CodeBlock title="architecture">
				{`\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502                    HUMAN LAYER                     \u2502
\u2502                                                     \u2502
\u2502  CLI: autopilot ask / inbox / attach / approve      \u2502
\u2502  Dashboard: board, tasks, agents, activity, intent  \u2502
\u2502  External: WhatsApp, Telegram, Slack, Email         \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
                       \u2502
                       \u25BC
\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502                ORCHESTRATOR (Bun)                   \u2502
\u2502                                                     \u2502
\u2502  FS Watcher \u00B7 Workflow Engine \u00B7 Agent Spawner       \u2502
\u2502  Context Assembler \u00B7 Memory Extractor              \u2502
\u2502  Cron Scheduler \u00B7 Webhook Server                   \u2502
\u2502  Notification Dispatcher \u00B7 Session Stream          \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
                       \u2502
                       \u25BC
\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502                   AGENT LAYER                      \u2502
\u2502                                                     \u2502
\u2502  8 roles: CEO, Ivan, Peter, Marek, Adam,            \u2502
\u2502           Ops, Marketer, Designer                    \u2502
\u2502                                                     \u2502
\u2502  Each = Claude session with:                        \u2502
\u2502    system prompt + tools + FS scope +                \u2502
\u2502    task context + memory                             \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
                       \u2502
                       \u25BC
\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502              COMPANY CONTAINER                      \u2502
\u2502                                                     \u2502
\u2502  /company/ \u2014 YAML, Markdown, JSON                  \u2502
\u2502  Docker container, git-versioned, isolated           \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				The Orchestrator
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				A single Bun process (~1500 lines of code total) that coordinates
				everything:
			</p>
			<ul className="text-ghost leading-relaxed space-y-2">
				<li>
					<strong className="text-fg">FS Watcher</strong> — monitors the company
					filesystem for changes using chokidar
				</li>
				<li>
					<strong className="text-fg">Workflow Engine</strong> — state machine that
					routes tasks through workflow steps (~300 LOC)
				</li>
				<li>
					<strong className="text-fg">Agent Spawner</strong> — creates Claude
					sessions with assembled context via the Agent SDK
				</li>
				<li>
					<strong className="text-fg">Context Assembler</strong> — builds
					role-scoped system prompts with 4-layer context
				</li>
				<li>
					<strong className="text-fg">Memory Extractor</strong> — uses Claude Haiku
					to extract facts, decisions, and learnings post-session
				</li>
				<li>
					<strong className="text-fg">Cron Scheduler</strong> — runs recurring
					agent tasks from schedules.yaml
				</li>
				<li>
					<strong className="text-fg">Webhook Server</strong> — receives external
					events on port 7777
				</li>
				<li>
					<strong className="text-fg">Session Stream</strong> — WebSocket server
					for real-time agent observation
				</li>
			</ul>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Filesystem Convention
			</h2>
			<CodeBlock title="/company/ structure">
				{`team/          \u2192 Agent definitions, workflows, schedules, policies
tasks/         \u2192 YAML task files organized by status (active/, review/, blocked/)
comms/         \u2192 Agent communication channels and direct messages
knowledge/     \u2192 Company brain \u2014 brand, technical, business, legal docs
projects/      \u2192 Code repos, design assets, marketing materials
context/       \u2192 Agent memories, indexes, snapshots
secrets/       \u2192 Encrypted API keys and credentials
dashboard/     \u2192 Pin files for the dashboard UI
logs/          \u2192 Activity feed, session streams, error logs`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Tech Stack
			</h2>
			<ul className="text-ghost leading-relaxed space-y-1">
				<li>
					<strong className="text-fg">Runtime:</strong> Bun
				</li>
				<li>
					<strong className="text-fg">Language:</strong> TypeScript
				</li>
				<li>
					<strong className="text-fg">AI:</strong> Claude Agent SDK (Anthropic)
				</li>
				<li>
					<strong className="text-fg">FS Watching:</strong> chokidar
				</li>
				<li>
					<strong className="text-fg">Schemas:</strong> Zod
				</li>
				<li>
					<strong className="text-fg">CLI:</strong> Commander.js
				</li>
				<li>
					<strong className="text-fg">Git:</strong> simple-git
				</li>
				<li>
					<strong className="text-fg">Cron:</strong> node-cron
				</li>
			</ul>
		</article>
	)
}
