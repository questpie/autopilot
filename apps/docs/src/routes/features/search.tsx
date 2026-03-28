import { createFileRoute } from '@tanstack/react-router'
import { Header } from '@/components/landing/Header'
import { Section, SectionHeader } from '@/components/landing/Section'
import { Tag } from '@/components/landing/Tag'

export const Route = createFileRoute('/features/search')({
	head: () => ({
		meta: [
			{ title: 'Search & Knowledge — QuestPie Autopilot' },
			{
				name: 'description',
				content:
					'Universal search across tasks, messages, knowledge, and more. FTS5 full-text + vector semantic search with hybrid RRF ranking.',
			},
			{
				property: 'og:title',
				content: 'Search & Knowledge — QuestPie Autopilot',
			},
			{
				property: 'og:description',
				content:
					'Universal search across tasks, messages, knowledge, and more. FTS5 full-text + vector semantic search with hybrid RRF ranking.',
			},
			{ property: 'og:type', content: 'website' },
			{
				property: 'og:url',
				content: 'https://autopilot.questpie.com/features/search',
			},
			{ property: 'og:site_name', content: 'QUESTPIE Autopilot' },
			{ name: 'twitter:card', content: 'summary_large_image' },
			{
				name: 'twitter:title',
				content: 'Search & Knowledge — QuestPie Autopilot',
			},
		],
		links: [
			{
				rel: 'canonical',
				href: 'https://autopilot.questpie.com/features/search',
			},
		],
	}),
	component: FeatureSearchPage,
})

function FeatureSearchPage() {
	return (
		<div className="landing-page">
			<Header />
			<main className="border-lp-border mx-auto max-w-[1200px] border-x lp-grid-bg">
				{/* ========== HERO ========== */}
				<section className="px-4 py-24 md:px-8 md:py-32 border-b border-lp-border">
					<div className="mb-4">
						<Tag>SEARCH</Tag>
					</div>
					<h1 className="font-mono text-[36px] sm:text-[48px] font-bold text-white m-0 leading-tight tracking-[-0.03em]">
						Find Everything.
						<br />
						Instantly.
					</h1>
					<p className="font-sans text-base sm:text-lg text-lp-muted mt-5 leading-relaxed max-w-[640px]">
						FTS5 full-text plus vector semantic search with hybrid RRF ranking.
						Searches tasks, messages, knowledge, files, and more.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Universal search queries 7 entity types from a single input. Hybrid
						search combines keyword accuracy with semantic understanding. 4
						embedding providers give you the choice between cloud and local
						models. Real-time indexing makes new content searchable the moment
						it is created.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						This is not a separate tool. Search is one of the 7 custom agent
						tools. Agents use the same search system you do — when Max needs to
						find your coding standards, he queries the same index you query from
						the command palette.
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

				{/* ========== UNIVERSAL SEARCH ========== */}
				<Section id="universal">
					<SectionHeader
						num="01"
						sub="Tasks, messages, knowledge, agents, channels, files, and artifacts — all searchable from one place."
					>
						One Query. Seven Sources.
					</SectionHeader>

					<p className="font-sans text-sm text-lp-muted max-w-[640px]">
						A single query searches across every entity type in your company.
						Results are ranked by relevance with snippet extraction that shows
						the matching content in context. You see exactly why each result
						matched, not just the entity title.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Filter results by entity type, date range, agent, or channel. The
						Cmd+K command palette includes search results alongside navigation
						— find a task, a message, or a knowledge document without leaving
						the page you are on.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Agents use the same search tool. When Riley needs to check your
						testing standards before a code review, she queries the search
						index. When Morgan needs to find past blog posts before writing a
						new one, she searches the knowledge base. One unified search for
						humans and agents.
					</p>

					<div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mt-8">
						{[
							'Tasks',
							'Messages',
							'Knowledge',
							'Agents',
							'Channels',
							'Files',
							'Artifacts',
						].map((type) => (
							<div
								key={type}
								className="bg-lp-card border border-lp-border p-3 text-center"
							>
								<span className="font-mono text-[11px] text-lp-fg">
									{type}
								</span>
							</div>
						))}
					</div>
				</Section>

				{/* ========== FTS5 ========== */}
				<Section id="fts5">
					<SectionHeader
						num="02"
						sub="SQLite FTS5 with Porter stemming, snippet extraction, and rank scoring. Zero external dependencies."
					>
						Keyword Search That Works
					</SectionHeader>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Real-Time Indexing
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								FTS5 virtual tables are indexed at startup and updated in
								real-time on every write. When you create a task, it is
								indexed immediately. Searchable within milliseconds.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Porter Stemming
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Search for "deploying" and you find results containing
								"deploy," "deployed," and "deployment." Search for "testing"
								and you find "test," "tested," and "tests." No exact-match
								frustration.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Snippet Extraction
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Shows the matching context around each result. You see the
								sentence or paragraph where your search terms appear, not
								just a document title. Rank scoring orders results by
								relevance.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Zero Configuration
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								No Elasticsearch, no Solr, no external search service. FTS5
								runs inside SQLite. It works the moment you start Autopilot.
							</p>
						</div>
					</div>
				</Section>

				{/* ========== VECTOR SEARCH ========== */}
				<Section id="vector">
					<SectionHeader
						num="03"
						sub="sqlite-vec embeddings with KNN retrieval. Find conceptually related content even without keyword matches."
					>
						Search by Meaning, Not Just Words
					</SectionHeader>

					<p className="font-sans text-sm text-lp-muted max-w-[640px]">
						Embeddings are stored in sqlite-vec for efficient K-nearest-neighbor
						retrieval. When you search for "production release process,"
						semantic search finds your document titled "Deployment Guide" even
						though the words do not overlap. Meaning matters, not just keywords.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Configurable embedding dimensions adapt to your provider choice.
						Higher dimensions mean better accuracy. Lower dimensions mean faster
						search and smaller storage.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Vector search works alongside FTS5, not as a replacement. Keyword
						search excels at exact matches — when you know the term, FTS5 is
						fast and precise. Semantic search excels at conceptual matches —
						when you describe what you need in different words than the document
						uses.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Disable vector search entirely for FTS-only mode. Zero cost, zero
						setup, no embedding computation. Enable embeddings when you need
						semantic understanding.
					</p>
				</Section>

				{/* ========== HYBRID RRF ========== */}
				<Section id="hybrid">
					<SectionHeader
						num="04"
						sub="Reciprocal Rank Fusion (k=60) combines FTS5 and vector results into one optimally ranked list."
					>
						Best of Both Worlds
					</SectionHeader>

					<p className="font-sans text-sm text-lp-muted max-w-[640px]">
						The RRF algorithm merges two ranked lists without needing comparable
						scores. FTS5 returns results ranked by keyword relevance. Vector
						search returns results ranked by semantic similarity. RRF takes both
						lists and produces a single merged ranking that captures the best of
						each.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						The k=60 parameter balances keyword precision with semantic recall.
						Exact keyword matches still rank highly. Conceptually related
						content that FTS5 would miss now appears in results.
					</p>
					<p className="font-sans text-sm text-lp-muted mt-4 max-w-[640px]">
						Graceful degradation means the system never breaks. If vector search
						is disabled, hybrid search falls back to FTS5 only. If no embeddings
						exist for an entity, FTS5 handles it. The search always returns
						results, regardless of your configuration.
					</p>
				</Section>

				{/* ========== EMBEDDING PROVIDERS ========== */}
				<Section id="providers">
					<SectionHeader
						num="05"
						sub="4 embedding providers from free local models to cloud multimodal. Default: FTS-only, zero cost."
					>
						Cloud or Local. Your Choice.
					</SectionHeader>

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Gemini
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Cloud-hosted, multimodal embeddings that process both text
								and images. High quality, requires an API key. Best when
								embedding quality matters and you accept cloud processing.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								E5
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Runs locally on your machine. Supports 100+ languages with
								no API key needed. Best for privacy-sensitive deployments
								where data cannot leave your infrastructure.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Nomic
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Runs locally and supports image embeddings alongside text.
								Best for companies with visual content — product images,
								design assets, screenshots.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								None (Default)
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								FTS5-only mode. Zero cost, zero computation, zero
								configuration. Keyword search handles the workload. Add a
								provider when semantic search becomes valuable.
							</p>
						</div>
					</div>
				</Section>

				{/* ========== REAL-TIME INDEXING ========== */}
				<Section id="indexing">
					<SectionHeader
						num="06"
						sub="New content indexed on write. Background reindex at startup. Content hashing skips unchanged entities."
					>
						Searchable in Milliseconds
					</SectionHeader>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								indexOne
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Runs on every write operation. When a task is created, a
								message is sent, or knowledge is uploaded, the search index
								updates immediately. No lag between creation and
								searchability.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								reindexAll
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Runs at startup to catch any gaps. Non-blocking — the system
								is usable while reindexing completes. No downtime, no
								waiting.
							</p>
						</div>
						<div className="bg-lp-card border border-lp-border p-6">
							<h3 className="font-mono text-sm font-bold text-white mb-2">
								Content Hashing
							</h3>
							<p className="font-sans text-xs text-lp-muted leading-relaxed">
								Each entity's content is hashed before indexing. If the hash
								matches the stored hash, the entity is skipped. A reindex of
								10,000 entities where 9,900 are unchanged takes seconds, not
								minutes.
							</p>
						</div>
					</div>

					<p className="font-sans text-sm text-lp-muted mt-6 max-w-[640px]">
						Zero maintenance. No cron jobs, no manual reindex commands, no stale
						results. The index is always current, always consistent, always
						fast.
					</p>
				</Section>

				{/* ========== CTA ========== */}
				<section className="px-4 py-16 md:px-8 text-center border-t border-lp-border">
					<h2 className="font-mono text-xl sm:text-2xl font-bold text-white mb-4">
						Search everything, instantly
					</h2>
					<p className="font-sans text-sm text-lp-muted mb-8 max-w-md mx-auto">
						FTS5 + vector + hybrid RRF. 7 entity types. Zero configuration
						required.
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
