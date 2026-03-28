import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/landing/CodeBlock'
import { Header } from '@/components/landing/Header'

export const Route = createFileRoute('/features/search')({
	head: () => ({
		meta: [
			{ title: 'Search & Knowledge — QuestPie Autopilot' },
			{
				name: 'description',
				content:
					'Universal search across tasks, messages, knowledge, and files. FTS5 full-text + vector semantic search with hybrid RRF ranking. Zero config.',
			},
			{
				property: 'og:title',
				content: 'Search & Knowledge — QuestPie Autopilot',
			},
			{
				property: 'og:description',
				content:
					'FTS5 full-text + vector semantic search with hybrid RRF ranking. Zero external dependencies.',
			},
			{ property: 'og:type', content: 'website' },
			{
				property: 'og:url',
				content: 'https://autopilot.questpie.com/features/search',
			},
			{ property: 'og:site_name', content: 'QUESTPIE Autopilot' },
			{ name: 'twitter:card', content: 'summary_large_image' },
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
				<section className="px-4 py-20 md:px-8 md:py-28 border-b border-lp-border">
					<p className="font-mono text-xs text-lp-muted tracking-[0.15em] uppercase mb-4">
						SEARCH
					</p>
					<h1 className="font-mono text-[32px] sm:text-[48px] font-bold text-white m-0 leading-tight tracking-[-0.03em]">
						Find Everything.
						<br />
						Instantly.
					</h1>
					<p className="font-sans text-base text-lp-muted mt-5 leading-relaxed max-w-[560px]">
						FTS5 keywords and vector embeddings merged via Reciprocal Rank
						Fusion. One query searches tasks, messages, knowledge, files,
						agents, channels, artifacts. No Elasticsearch. No external service.
					</p>
				</section>

				{/* ========== CORE — terminal search ========== */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<p className="font-mono text-xs text-lp-muted tracking-[0.15em] uppercase mb-6">
						TERMINAL SEARCH
					</p>

					<CodeBlock title="terminal — search query">
						{`$ autopilot search "pricing component"

HYBRID SEARCH (FTS5 + vector, RRF k=60)
query: "pricing component"
mode: hybrid
──────────────────────────────────────────────────────

 #  TYPE       SCORE   ENTITY
 1  task       0.891   TASK-47: Build PricingTable component
                       "Implement responsive pricing table with
                        three tiers. Use Stripe price IDs from
                        env. Include annual/monthly toggle."

 2  artifact   0.847   src/components/PricingTable.tsx
                       "export function PricingTable({ plans,
                        interval }: PricingTableProps) {
                          const formatted = plans.map(p =>
                            intl.formatCurrency(p.amount))..."

 3  message    0.793   #task-47 · riley · 14:23
                       "PR #23 approved. PricingTable passes
                        all checks. No security concerns.
                        Performance acceptable."

 4  knowledge  0.724   ui-conventions.md
                       "All pricing components use the <PriceTag>
                        primitive. Currency formatting via
                        intl.formatCurrency. Never hardcode
                        currency symbols."

 5  message    0.681   #dev · max · 09:41
                       "Pushed to main. 3 files changed.
                        src/components/PricingTable.tsx
                        src/lib/stripe.ts"

5 results across 4 entity types (9ms)`}
					</CodeBlock>

					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
						<CodeBlock title="terminal — filtered search">
							{`$ autopilot search "auth" --type knowledge

FTS5 SEARCH (keyword only, filtered)
──────────────────────────────────────────
 1  0.912   auth-flow.md
             "OAuth2 PKCE flow for all external
              providers. Session tokens in
              httpOnly cookies. 24h expiry."

 2  0.834   api-security.md
             "All API routes require Bearer token.
              Rate limit: 100 req/min per agent."

 3  0.756   agent-permissions.md
             "Agents authenticate via company-scoped
              API keys. Rotate monthly."

3 results (4ms)`}
						</CodeBlock>

						<CodeBlock title="terminal — agent using search">
							{`[max] tool:search "error boundary pattern"

  RESULTS (hybrid, 8ms):
  1. knowledge  coding-standards.md
     "All async components must be wrapped
      in an ErrorBoundary. Use <AsyncBoundary>
      from src/components/..."

  2. task  TASK-31: ErrorBoundary refactor
     "Extracted reusable AsyncBoundary."

  3. message  #task-31 · riley · 2026-03-20
     "Fallback UI should show a retry button."

[max] Found pattern. Using <AsyncBoundary>
      from src/components/AsyncBoundary.tsx`}
						</CodeBlock>
					</div>
				</section>

				{/* ========== HOW — hybrid search internals ========== */}
				<section className="px-4 py-16 md:px-8 border-b border-lp-border">
					<p className="font-mono text-xs text-lp-muted tracking-[0.15em] uppercase mb-6">
						HOW HYBRID SEARCH WORKS
					</p>

					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
						<CodeBlock title="search-engine.ts — hybrid search">
							{`// Step 1: FTS5 keyword search
// Porter stemming: "pricing" matches price, priced, prices
const ftsResults = db.all(\`
  SELECT entity_type, entity_id, title,
         snippet(search_index, 3, '', '', '...', 32)
         AS snippet, rank
  FROM search_index
  WHERE search_index MATCH ?
  ORDER BY rank
  LIMIT 20
\`, [query]);

// Step 2: Vector semantic search
// "responsive table" finds "grid layout component"
// even with zero keyword overlap
const embedding = await embed(query);  // 768-dim
const vecResults = db.all(\`
  SELECT entity_type, entity_id, title,
         distance
  FROM vec_search_index
  WHERE embedding MATCH ?
  ORDER BY distance
  LIMIT 20
\`, [embedding]);

// Step 3: Reciprocal Rank Fusion (k=60)
// Merges two ranked lists into one optimal list
// without needing comparable score scales
function rrf(
  fts: RankedResult[],
  vec: RankedResult[],
  k = 60
): MergedResult[] {
  const scores = new Map<string, number>();

  for (let i = 0; i < fts.length; i++) {
    const id = key(fts[i]);
    scores.set(id, (scores.get(id) ?? 0)
      + 1 / (k + i + 1));
  }

  for (let i = 0; i < vec.length; i++) {
    const id = key(vec[i]);
    scores.set(id, (scores.get(id) ?? 0)
      + 1 / (k + i + 1));
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, score]) => ({ id, score }));
}`}
						</CodeBlock>

						<div className="space-y-6">
							<CodeBlock title="search — RRF merge example">
								{`QUERY: "pricing component"

FTS5 RANKED LIST:
 rank 1: TASK-47 (exact keyword match)
 rank 2: pricing.test.tsx
 rank 3: ui-conventions.md
 rank 4: #dev message (max)

VECTOR RANKED LIST:
 rank 1: PricingTable.tsx (semantic: "component")
 rank 2: TASK-47 (semantic: "pricing")
 rank 3: #task-47 message (semantic: "approved")
 rank 4: ui-conventions.md

RRF MERGE (k=60):
 TASK-47:           1/(60+1) + 1/(60+2) = 0.0326
 PricingTable.tsx:  0        + 1/(60+1) = 0.0164
 pricing.test.tsx:  1/(60+3) + 0        = 0.0159
 ui-conventions.md: 1/(60+4) + 1/(60+4) = 0.0312
 #task-47 msg:      0        + 1/(60+3) = 0.0159
 #dev msg:          1/(60+5) + 0        = 0.0154

FINAL ORDER:
 1. TASK-47           0.891  (both lists)
 2. PricingTable.tsx  0.847  (vector rank 1)
 3. #task-47 msg      0.793  (vector rank 3)
 4. ui-conventions.md 0.724  (both lists)
 5. #dev msg          0.681  (FTS only)`}
							</CodeBlock>

							<CodeBlock title="search — embedding providers">
								{`PROVIDER   TYPE    DIMS   COST
─────────  ──────  ─────  ──────────
gemini     cloud   768    API key
e5-small   local   384    free / CPU
nomic      local   768    free / CPU
none       —       —      FTS5 only

# company.yaml
search:
  embedding_provider: "gemini"
  # fallback: FTS5 only when embeddings
  # unavailable or provider: "none"
  hybrid_k: 60
  max_results: 20`}
							</CodeBlock>
						</div>
					</div>
				</section>

				{/* ========== CTA ========== */}
				<section className="px-4 py-16 md:px-8">
					<div className="max-w-md">
						<CodeBlock title="terminal">
							{`$ bun add -g @questpie/autopilot
$ autopilot init my-company
$ autopilot start

  ✓ FTS5 index: 7 entity types
  ✓ Vector index: gemini (768-dim)
  ✓ Hybrid search: RRF k=60
  ✓ Indexed 847 entities in 1.2s`}
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
