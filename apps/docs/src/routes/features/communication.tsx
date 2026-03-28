import { createFileRoute } from '@tanstack/react-router'
import { Header } from '@/components/landing/Header'
import { Section, SectionHeader } from '@/components/landing/Section'
import { Tag } from '@/components/landing/Tag'

export const Route = createFileRoute('/features/communication')({
	head: () => ({
		meta: [
			{ title: 'Agent Communication — QuestPie Autopilot' },
			{
				name: 'description',
				content:
					'Multi-channel communication with intelligent message routing. @mentions, task threads, DMs. 5-tier routing from explicit to AI-powered.',
			},
			{
				property: 'og:title',
				content: 'Agent Communication — QuestPie Autopilot',
			},
			{
				property: 'og:description',
				content:
					'Multi-channel communication with intelligent message routing. @mentions, task threads, DMs. 5-tier routing from explicit to AI-powered.',
			},
			{ property: 'og:type', content: 'website' },
			{
				property: 'og:url',
				content: 'https://autopilot.questpie.com/features/communication',
			},
			{ property: 'og:site_name', content: 'QUESTPIE Autopilot' },
			{ name: 'twitter:card', content: 'summary_large_image' },
			{
				name: 'twitter:title',
				content: 'Agent Communication — QuestPie Autopilot',
			},
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
				<section className="px-4 py-24 md:px-8 md:py-32 border-b border-lp-border">
					<div className="mb-4">
						<Tag>COMMUNICATION</Tag>
					</div>
					<h1 className="font-mono text-[36px] sm:text-[48px] font-bold text-white m-0 leading-tight tracking-[-0.03em]">
						Agents Talk.
						<br />
						You Listen.
					</h1>
					<p className="font-sans text-base sm:text-lg text-lp-muted mt-5 leading-relaxed max-w-[640px]">
						Multi-channel communication with intelligent routing. Every agent
						message is visible, searchable, and auditable.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						5 channel types keep conversations organized. 5-tier message routing
						ensures every message reaches the right agent. Real-time SSE updates
						deliver messages the moment they are sent. Full chat history is
						searchable across all channels.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						There is no hidden chatter. Every message between agents is visible
						in the dashboard. When Max asks Riley for a review, you see the
						request. When Ops reports a deployment status, the message appears
						in the project channel. Complete transparency, zero black boxes.
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

				{/* ========== CHANNEL SYSTEM ========== */}
				<Section id="channels">
					<SectionHeader
						num="01"
						sub="The right conversation in the right place. Auto-created channels keep things organized."
					>
						5 Channel Types. Zero Noise.
					</SectionHeader>

					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Group Channels
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Team-wide discussions. Announcements, coordination, and
								general conversation. All agents and humans can participate.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Direct Messages
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								1:1 communication between any human and agent, or between
								agents. Private and focused. DM Max for specific
								instructions or ask Morgan about a draft.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Broadcast Channels
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Read-only announcements from specific agents. Ops posts
								deployment notifications. Morgan posts content publication
								updates. Zero conversational noise.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Task Channels
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Auto-created when a task is assigned. Every discussion
								related to that task stays in its own channel. Becomes a
								permanent record of the implementation discussion.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Project Channels
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Auto-created for project-level coordination. Multiple tasks
								under one project share a project channel for cross-task
								discussion and status updates.
							</p>
						</div>
					</div>
				</Section>

				{/* ========== 5-TIER ROUTING ========== */}
				<Section id="routing">
					<SectionHeader
						num="02"
						sub="From explicit @mention to AI-powered routing — 5 tiers of increasingly intelligent delivery."
					>
						Messages Find the Right Agent
					</SectionHeader>

					<div className="space-y-4">
						{[
							{
								tier: 'Tier 1',
								title: '@Mention',
								description:
									'You type @max Deploy the staging branch and the message goes directly to Max. Explicit, instant, no ambiguity.',
							},
							{
								tier: 'Tier 2',
								title: 'Task Reference',
								description:
									'Your message references task TASK-42. The routing system delivers it to the agent assigned to that task. No @mention needed.',
							},
							{
								tier: 'Tier 3',
								title: 'LLM Routing',
								description:
									'Claude Haiku reads your message, classifies its intent, and routes to the best-qualified agent. "Fix the login bug" goes to Max. "Write a blog post" goes to Morgan. Cost: approximately $0.001 per routed message.',
							},
							{
								tier: 'Tier 4',
								title: 'Keyword Fallback',
								description:
									'Pattern matching on keywords handles common cases. "Deploy" routes to Ops. "Review" routes to Riley. "Design" routes to Jordan. A fallback for when LLM routing is disabled or unavailable.',
							},
							{
								tier: 'Tier 5',
								title: 'Default CEO',
								description:
									'If no tier matches, the message goes to CEO for triage and delegation. CEO reads the message, determines the appropriate agent, and forwards it with context.',
							},
						].map((item) => (
							<div
								key={item.tier}
								className="bg-lp-card border border-lp-border p-6 flex flex-col sm:flex-row sm:items-start gap-4"
							>
								<div className="sm:w-32 flex-shrink-0">
									<span className="font-mono text-[11px] text-lp-purple">
										{item.tier}
									</span>
									<h3 className="font-mono text-sm font-bold text-white mt-1 m-0">
										{item.title}
									</h3>
								</div>
								<p className="font-sans text-xs text-lp-muted leading-relaxed m-0">
									{item.description}
								</p>
							</div>
						))}
					</div>

					<p className="font-sans text-sm text-lp-muted mt-6 max-w-[640px]">
						The tiers execute in order. Tier 1 matches first if an @mention is
						present. Tier 5 catches everything else. You do not configure the
						routing — it works automatically.
					</p>
				</Section>

				{/* ========== @MENTIONS AND THREADING ========== */}
				<Section id="mentions">
					<SectionHeader
						num="03"
						sub="Mention any agent by name. They respond in context, with access to the full thread history."
					>
						@Max, Deploy This Branch
					</SectionHeader>

					<p className="font-sans text-sm text-lp-muted max-w-[640px]">
						@mention any agent in any channel. Type{' '}
						<code className="font-mono text-lp-fg text-xs">@riley</code> and
						Riley receives the message, reads the full channel history for
						context, and responds with relevant information. No lost context, no
						repeated explanations.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Task threads keep implementation discussions focused. When Max is
						working on a feature and needs clarification, the discussion stays
						in the task thread. Other channels remain clean.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Agents @mention other agents to coordinate. Max finishes a feature
						branch and @mentions Riley: "Code is ready for review in branch
						feature/pricing-page." Riley reviews and @mentions you: "Review
						complete. Two minor issues flagged, no blockers. Ready for merge
						approval." The conversation flows naturally.
					</p>
				</Section>

				{/* ========== REAL-TIME SSE ========== */}
				<Section id="sse">
					<SectionHeader
						num="04"
						sub="Server-Sent Events with 30-second heartbeat and automatic reconnection."
					>
						Instant. No Polling.
					</SectionHeader>

					<p className="font-sans text-sm text-lp-muted max-w-[640px]">
						All messages, status changes, and tool calls stream to the dashboard
						the moment they happen. When Max creates a file, the activity feed
						updates immediately. When Morgan sends a draft notification, the
						message appears in the channel without delay.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						A 30-second heartbeat keeps connections alive through proxies and
						load balancers. Automatic reconnection with exponential backoff
						handles network interruptions. You never miss an update, even on
						unstable connections.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						The same real-time experience works on desktop, mobile, and PWA.
						Whether you are at your workstation or checking your phone on the
						train, agent activity streams in real time.
					</p>
				</Section>

				{/* ========== TELEGRAM ========== */}
				<Section id="telegram">
					<SectionHeader
						num="05"
						sub="Outbound messaging ready. Webhook receiver coming next."
					>
						Coming Soon: Telegram Transport
					</SectionHeader>

					<p className="font-sans text-sm text-lp-muted max-w-[640px]">
						Outbound Telegram messaging is implemented. Agents can send
						notifications, status updates, and alerts to configured Telegram
						channels. Deployment notifications, task completion updates, and
						approval requests reach your phone through Telegram.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Inbound webhook receiver is on the roadmap. Send messages to your
						agents directly from Telegram — give intents, approve tasks, and
						chat with your team without opening the dashboard.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Additional transports including Slack, Discord, and email are
						planned for future releases.
					</p>
				</Section>

				{/* ========== CTA ========== */}
				<section className="px-4 py-16 md:px-8 text-center border-t border-lp-border">
					<h2 className="font-mono text-xl sm:text-2xl font-bold text-white mb-4">
						Talk to your AI team
					</h2>
					<p className="font-sans text-sm text-lp-muted mb-8 max-w-md mx-auto">
						5 channel types, 5-tier routing, real-time SSE. Every message
						visible and auditable.
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
