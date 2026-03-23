import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/CodeBlock'
import { seoHead } from '@/lib/seo'

export const Route = createFileRoute('/docs/artifacts')({
	head: () => ({ ...seoHead({ title: 'Artifacts', description: 'Agent-created live previews — React apps, HTML pages, and static sites. Artifact router with cold-start, port pool, and idle timeout.', path: '/docs/artifacts', ogImage: 'https://autopilot.questpie.com/og-artifacts.png' }) }),
	component: Artifacts,
})

function Artifacts() {
	return (
		<article className="prose-autopilot">
			<h1 className="font-sans text-3xl font-black text-white mb-2">
				Artifacts
			</h1>
			<p className="text-muted text-lg mb-8">
				Agent-created previews. Agents write code, run dev servers, and
				pin live URLs to the dashboard. You click and see a running app.
			</p>

			{/* ── What Are Artifacts ─────────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				What Are Artifacts
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Artifacts are live previews created by agents. No special system
				needed -- agents have filesystem and terminal access. They write
				code, run a dev server, and pin the URL to the dashboard. You
				click the link and see a running React app, HTML page, or static
				site.
			</p>
			<CodeBlock title="artifact-flow">
				{`Agent (Designer, Developer, etc.):
  1. write_file("/artifacts/landing-v2/src/App.tsx", content)
  2. write_file("/artifacts/landing-v2/package.json", config)
  3. run_command("cd /artifacts/landing-v2 && bun install && bun run dev --port 4100")
  4. pin_to_board({
       group: "artifacts",
       title: "Landing Page v2",
       type: "info",
       content: "Live preview ready",
       metadata: {
         url: "http://localhost:4100",
         type: "react",
         task_id: "task-052"
       }
     })

Human sees:
  Dashboard → "Landing Page v2" card → click → iframe with live React app
  CLI → "autopilot artifacts" → list of running previews with ports`}
			</CodeBlock>

			{/* ── create_artifact Usage ──────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				create_artifact Tool
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				The{' '}
				<code className="font-mono text-xs text-purple">
					create_artifact
				</code>{' '}
				primitive is a convenience wrapper. Under the hood it writes
				files, creates the{' '}
				<code className="font-mono text-xs text-purple">
					.artifact.yaml
				</code>{' '}
				config, and pins the URL. Available to Developer and Design
				agents.
			</p>
			<CodeBlock title="create_artifact.ts">
				{`// React artifact — full Vite + React app
create_artifact({
  name: "landing-v2",
  type: "react",
  files: {
    "src/App.tsx": \`
      export default function App() {
        return (
          <div className="min-h-screen bg-black text-white p-8">
            <h1 className="text-4xl font-bold">Landing Page v2</h1>
            <p className="text-gray-400 mt-4">New design concept</p>
          </div>
        )
      }
    \`,
    "src/main.tsx": \`
      import { createRoot } from 'react-dom/client'
      import App from './App'
      createRoot(document.getElementById('root')!).render(<App />)
    \`
  }
})

// HTML artifact — single page, no build step
create_artifact({
  name: "email-template",
  type: "html",
  files: {
    "index.html": \`
      <!DOCTYPE html>
      <html>
        <body style="font-family: sans-serif; max-width: 600px; margin: auto;">
          <h1>Welcome to QUESTPIE</h1>
          <p>Your company OS is ready.</p>
        </body>
      </html>
    \`
  }
})

// Static artifact — pre-built files served as-is
create_artifact({
  name: "api-docs",
  type: "static",
  files: {
    "index.html": "<!DOCTYPE html>...",
    "openapi.json": "{ ... }",
    "styles.css": "body { ... }"
  }
})`}
			</CodeBlock>

			{/* ── Three Artifact Types ──────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Artifact Types
			</h2>
			<div className="overflow-x-auto mb-4">
				<table className="w-full text-sm border-collapse">
					<thead>
						<tr className="border-b border-border">
							<th className="text-left text-ghost font-mono text-xs py-2 pr-4">
								Type
							</th>
							<th className="text-left text-ghost font-mono text-xs py-2 pr-4">
								How Agent Creates It
							</th>
							<th className="text-left text-ghost font-mono text-xs py-2">
								Preview
							</th>
						</tr>
					</thead>
					<tbody className="text-ghost">
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								react
							</td>
							<td className="py-2 pr-4 text-xs">
								Writes JSX + Vite config, runs{' '}
								<code className="font-mono text-xs text-purple">
									bun run dev
								</code>
							</td>
							<td className="py-2 text-xs">
								Live iframe with HMR
							</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								html
							</td>
							<td className="py-2 pr-4 text-xs">
								Writes HTML/CSS/JS to{' '}
								<code className="font-mono text-xs text-purple">
									/artifacts/{'{name}'}/index.html
								</code>
							</td>
							<td className="py-2 text-xs">
								Static file serving
							</td>
						</tr>
						<tr>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								static
							</td>
							<td className="py-2 pr-4 text-xs">
								Pre-built files (OpenAPI spec, SVG, docs site)
							</td>
							<td className="py-2 text-xs">
								Direct file render
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			{/* ── .artifact.yaml ─────────────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				.artifact.yaml Format
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Every artifact directory contains a{' '}
				<code className="font-mono text-xs text-purple">
					.artifact.yaml
				</code>{' '}
				config file that tells the router how to serve it.
			</p>
			<CodeBlock title="/artifacts/landing-v2/.artifact.yaml">
				{`name: landing-v2
serve: "bun run dev --port {port}"    # {port} replaced by router
build: "bun install"                   # Run once before first serve
health: "/"                            # Health check path
timeout: 5m                            # Idle timeout before shutdown`}
			</CodeBlock>
			<CodeBlock title="filesystem-structure">
				{`/artifacts/                          # Agent-created previews
├── landing-v2/                      # Each artifact is a directory
│   ├── package.json                 # For JS/TS artifacts
│   ├── src/                         # Source files
│   │   └── App.tsx
│   └── .artifact.yaml               # Serve config
├── email-template/
│   ├── index.html
│   └── .artifact.yaml
└── .registry.yaml                   # Running artifacts index`}
			</CodeBlock>

			{/* ── Artifact Router ────────────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Artifact Router
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				The artifact router manages dev server processes with cold-start
				and idle-timeout. Like serverless, but for artifacts -- zero idle
				cost.
			</p>
			<CodeBlock title="artifact-router-flow">
				{`Request → /artifacts/landing-v2/
  │
  ▼
Router checks registry:
  ├── Process running? → proxy to port → reset idle timer
  └── Not running?     → cold start:
                           1. Read .artifact.yaml
                           2. Run build command (bun install)
                           3. Assign port from pool (4100-4199)
                           4. Run serve command (bun run dev --port 4123)
                           5. Wait for health check (GET /)
                           6. Proxy request
                           7. Start idle timer

Idle timeout (default 5min):
  → No requests for 5 min → kill process → free port
  → Next request → cold start again (~2-3s for Vite/Bun)`}
			</CodeBlock>
			<div className="space-y-4 mb-8">
				<div className="border border-border p-4">
					<h3 className="font-sans text-sm font-bold text-white mb-1 mt-0">
						Cold Start
					</h3>
					<p className="text-ghost leading-relaxed mb-0 text-sm">
						When an artifact is accessed for the first time (or after
						idle timeout), the router runs the build command, starts
						the dev server, and waits for the health check to pass.
						Takes ~2-3 seconds with Vite/Bun.
					</p>
				</div>
				<div className="border border-border p-4">
					<h3 className="font-sans text-sm font-bold text-white mb-1 mt-0">
						Port Pool
					</h3>
					<p className="text-ghost leading-relaxed mb-0 text-sm">
						Ports 4100-4199 are reserved for artifacts. The router
						allocates the next available port and releases it when
						the process is stopped.
					</p>
				</div>
				<div className="border border-border p-4">
					<h3 className="font-sans text-sm font-bold text-white mb-1 mt-0">
						Idle Timeout
					</h3>
					<p className="text-ghost leading-relaxed mb-0 text-sm">
						After the configured timeout (default 5 minutes) with no
						requests, the process is killed and the port freed. Zero
						resource usage for inactive artifacts.
					</p>
				</div>
			</div>

			{/* ── Lifecycle ──────────────────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Artifact Lifecycle
			</h2>
			<CodeBlock title="lifecycle-diagram">
				{`created → cold-start → running → idle → stopped
   │                      │                    │
   │   Agent writes       │   Requests keep    │   No requests
   │   files + config     │   it alive         │   for 5 min
   │                      │                    │
   ▼                      ▼                    ▼
.artifact.yaml      Health check passes   Process killed,
written to FS        Port assigned         port freed
                     Proxy active          Next request →
                                           cold-start again`}
			</CodeBlock>

			{/* ── How to View ────────────────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				How to View Artifacts
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Three ways to access artifacts:
			</p>
			<CodeBlock title="terminal">
				{`# CLI — list all artifacts
$ autopilot artifacts
ARTIFACTS — 2 running, 1 stopped

  NAME             TYPE    PORT   STATUS    AGE
  landing-v2       react   4100   running   12m
  email-template   html    4101   running   3m
  api-docs         static  —      stopped   1h

# CLI — open in browser
$ autopilot artifacts open landing-v2
Opening http://localhost:4100 in default browser...

# CLI — stop a running artifact
$ autopilot artifacts stop landing-v2
Stopped landing-v2 (was on port 4100)

# CLI — rebuild
$ autopilot artifacts rebuild landing-v2
Rebuilding landing-v2... done (port 4102)`}
			</CodeBlock>
			<p className="text-ghost leading-relaxed mb-4">
				On the dashboard, artifacts appear as cards in the Artifacts
				section. Click to open in an iframe or fullscreen. The direct
				URL is{' '}
				<code className="font-mono text-xs text-purple">
					http://localhost:7778/artifacts/landing-v2/
				</code>
				.
			</p>

			{/* ── When Agents Create Artifacts ──────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				When Agents Create Artifacts
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Agents create artifacts when the task requires a visual or
				interactive preview:
			</p>
			<ul className="text-ghost leading-relaxed space-y-2 mb-6">
				<li>
					<strong className="text-fg">UI mockups</strong> -- Designer
					agent creates a React artifact to prototype a new feature
				</li>
				<li>
					<strong className="text-fg">Landing pages</strong> --
					Developer builds a complete landing page for review
				</li>
				<li>
					<strong className="text-fg">Demo apps</strong> -- Quick
					prototype to validate an approach before full implementation
				</li>
				<li>
					<strong className="text-fg">Documentation sites</strong> --
					Static HTML docs for an API or library
				</li>
				<li>
					<strong className="text-fg">Content previews</strong> --
					Email templates, marketing pages, blog post layouts
				</li>
			</ul>
			<CodeBlock title="example-agent-interaction">
				{`$ autopilot ask "Create a mockup for the new pricing page"

# Designer agent (Jordan):
#   1. Reads brand guidelines from /knowledge/brand/
#   2. Creates /artifacts/pricing-mockup/ with React components
#   3. Writes .artifact.yaml with serve config
#   4. Pins to dashboard: "Pricing Page Mockup — click to preview"
#
# You see the card on dashboard, click it, review the design
# Give feedback: "Make the CTA button bigger"
# Jordan edits the artifact, you see the change via HMR`}
			</CodeBlock>
		</article>
	)
}
