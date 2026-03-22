# Artifacts & Skills Architecture

> How agents create previewable outputs and leverage reusable knowledge.
> Last updated: 2026-03-22

---

## 1. Artifacts: Agent Creates, Human Previews

### Core Insight

**No special artifact system needed.** Agents have Bash tool access. They can:
1. Write code to filesystem
2. Run `bunx vite` / `bun run dev` on any port
3. Pin a live URL to the dashboard
4. Human clicks link → sees live preview

### How It Works

```
Agent (Peter, Designer, etc.):
  1. write_file("/artifacts/landing-v2/src/App.tsx", content)
  2. write_file("/artifacts/landing-v2/package.json", viteConfig)
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
  CLI → "autopilot artifacts" → list of running previews with ports
```

### Artifact Types

| Type | How Agent Creates It | Preview |
|------|---------------------|---------|
| React component | Writes JSX + runs vite dev | Live iframe |
| HTML page | Writes to /artifacts/{name}/index.html | Static file serve |
| Markdown doc | Writes to /knowledge/ or /projects/*/docs/ | Rendered markdown |
| Mermaid diagram | Writes .md with mermaid blocks | Rendered diagram |
| API docs | Writes OpenAPI spec | Swagger UI |
| Design mockup | Writes SVG/HTML | Direct render |

### Filesystem Convention

```
/artifacts/                          # Agent-created previews
├── {name}/                          # Each artifact is a directory
│   ├── package.json                 # Optional — for JS/TS artifacts
│   ├── src/                         # Source files
│   └── .artifact.yaml               # Metadata
└── .registry.yaml                   # Running artifacts index

# .artifact.yaml
name: "Landing Page v2"
type: react                          # react | html | markdown | svg | api-doc
port: 4100                           # Dev server port (if running)
created_by: designer
created_at: "2026-03-22T14:30:00Z"
task_id: task-052
status: running                      # running | stopped | built
url: "http://localhost:4100"
```

### Artifact Router (Lazy Serving with Cold Start)

**Single router process — zero idle cost.** Like serverless but for artifacts.

```
Request → /artifacts/landing-v2/
  │
  ▼
Router checks registry:
  ├── Process running? → proxy to port → reset idle timer
  └── Not running?     → cold start:
                           1. Read .artifact.yaml
                           2. Run build command (if needed)
                           3. Assign port from pool (4100-4199)
                           4. Run serve command
                           5. Wait for health check
                           6. Proxy request
                           7. Start idle timer

Idle timeout (default 5min):
  → No requests for 5 min → kill process → free port
  → Next request → cold start again (~2-3s for Vite)
```

**Artifact definition** (`.artifact.yaml`):
```yaml
name: landing-v2
serve: "bun run dev --port {port}"    # {port} replaced by router
build: "bun install"                   # Run once before first serve
health: "/"                            # Health check path
timeout: 5m                            # Idle timeout before shutdown
```

**Implementation** (`packages/orchestrator/src/artifact/router.ts`):
```typescript
class ArtifactRouter {
  private processes: Map<string, { pid: number; port: number; timer: Timer }>
  private portPool: Set<number>  // 4100-4199

  async route(artifactId: string, request: Request): Promise<Response> {
    let proc = this.processes.get(artifactId)
    if (!proc) {
      proc = await this.coldStart(artifactId)
    }
    this.resetIdleTimer(artifactId)
    return fetch(`http://localhost:${proc.port}${new URL(request.url).pathname}`)
  }

  private async coldStart(artifactId: string): Promise<Process> {
    const config = await readArtifactConfig(artifactId)
    const port = this.allocatePort()
    // Build if needed
    if (config.build) await run(config.build, { cwd: artifactDir })
    // Start serve
    const proc = Bun.spawn(config.serve.replace('{port}', port), ...)
    // Wait for health
    await waitForHealth(`http://localhost:${port}${config.health}`)
    return { pid: proc.pid, port, timer: ... }
  }
}
```

**Benefits:**
- Zero idle resource usage (no permanently running dev servers)
- Cold start ~2-3s (Vite/Bun is fast)
- Port pool managed automatically
- Graceful shutdown on `autopilot stop`
- Simple for agent: just write files + `.artifact.yaml`, router handles the rest

### Dashboard Integration

Dashboard (paid feature) auto-renders artifacts:
- Scans `/artifacts/.registry.yaml` for running artifacts
- Embeds each as iframe card
- Shows metadata (created by, task, type)
- Actions: stop, rebuild, open fullscreen

### CLI Integration

```bash
autopilot artifacts                   # List running artifacts
autopilot artifacts stop landing-v2   # Stop dev server
autopilot artifacts rebuild landing-v2 # Rebuild and restart
autopilot artifacts open landing-v2   # Open in browser
```

---

## 2. Serving Knowledge & Company Data

### Core Insight

**The entire company filesystem should be browsable via HTTP.**
Orchestrator already runs Bun.serve — add static file serving.

```
https://localhost:7778/fs/knowledge/technical/conventions.md
https://localhost:7778/fs/projects/studio/docs/spec.md
https://localhost:7778/fs/tasks/active/task-040.yaml
https://localhost:7778/fs/artifacts/landing-v2/       → iframe redirect to :4100
```

### Implementation

```typescript
// In orchestrator API server
if (url.pathname.startsWith('/fs/')) {
  const fsPath = join(companyRoot, url.pathname.replace('/fs/', ''))
  const file = Bun.file(fsPath)
  if (await file.exists()) {
    // Markdown → render as HTML
    if (fsPath.endsWith('.md')) {
      return renderMarkdown(await file.text())
    }
    // YAML → render as formatted view
    if (fsPath.endsWith('.yaml')) {
      return renderYaml(await file.text())
    }
    // Everything else → raw file
    return new Response(file)
  }
}
```

### Benefits

- Knowledge docs are linkable and shareable
- Agents can reference URLs in messages: "See spec at /fs/projects/studio/docs/spec.md"
- Dashboard renders knowledge as documentation site
- No separate documentation tool needed — FS IS the docs

---

## 3. Skills: Reusable Agent Knowledge

### What Skills Are

Skills = packaged knowledge docs + optional scripts that teach agents
domain expertise. Like Claude Code skills but for company agents.

### Skill Format

```
/skills/
├── catalog.yaml                     # Index of all skills
├── builtin/                         # Ships with Autopilot
│   ├── document-creation.md
│   ├── code-review-checklist.md
│   ├── release-notes.md
│   ├── api-design.md
│   ├── testing-strategy.md
│   └── incident-response.md
├── project/                         # Company-specific
│   ├── our-stack.md
│   ├── deployment-guide.md
│   └── brand-voice.md
└── marketplace/                     # Installed from marketplace
    ├── seo-expert/
    │   ├── skill.yaml
    │   └── content.md
    └── stripe-integration/
        ├── skill.yaml
        └── content.md
```

### Built-in Skills (Ship with Template)

```markdown
# document-creation.md
# Skill: Document Creation

## When to Use
When creating specs, ADRs, plans, or any structured document.

## Spec Template
### Title
### Problem Statement
### Proposed Solution
### Alternatives Considered
### Implementation Plan
### Success Criteria
### Open Questions

## ADR Template
### ADR-{number}: {Title}
- **Date:** YYYY-MM-DD
- **Status:** proposed | accepted | deprecated
- **Decision:** What we decided
- **Context:** Why this decision was needed
- **Consequences:** What this means

## Best Practices
- Start with the "why" before the "what"
- Include diagrams (mermaid) for complex systems
- Reference related tasks and previous decisions
- Keep specs under 2000 words
- Include acceptance criteria as checklist
```

### Skill Loading (Context Assembly)

Skills loaded into Layer 2 (Company State) of context assembly:
```typescript
// In context assembler
const skills = await loadSkillCatalog(companyRoot)
const relevantSkills = skills.filter(s =>
  s.roles.includes(agent.role) || s.roles.includes('all')
)

// Add skill metadata to context (not full content — lazy load)
contextParts.push(`
## Available Skills
${relevantSkills.map(s => `- **${s.name}**: ${s.description}`).join('\n')}

To use a skill, call: skill_request({ skill_id: "${s.id}" })
`)
```

### Skill CLI

```bash
autopilot skill list                  # All available skills
autopilot skill create                # Interactive wizard
autopilot skill install <package>     # From marketplace
autopilot skill publish               # Share to marketplace
```

### Marketplace (Future, Paid)

```bash
# Discover skills
autopilot marketplace search "ecommerce"

# Install
autopilot marketplace install @questpie/skill-stripe
autopilot marketplace install @community/skill-seo-expert

# Publish
autopilot marketplace publish ./skills/project/our-stack.md
```

Skills distributed as:
- GitHub repos (free, community)
- QUESTPIE Marketplace (curated, potentially paid)
- Direct file sharing (copy .md files)

---

## 4. Dashboard (Paid Product)

### Why Paid

Dashboard is the **premium experience** on top of the open-source CLI.

Free (CLI):
- `autopilot artifacts` → list
- `autopilot attach peter` → text stream
- `autopilot inbox` → text list
- Knowledge browsable via `http://localhost:7778/fs/`

Paid (Dashboard):
- Live artifact previews in iframes
- Real-time agent session streaming with rich UI
- Task board with drag-and-drop
- Knowledge rendered as documentation site
- Agent memory visualization
- Cost tracking and budget dashboards
- Approval gates with one-click approve/reject
- Skill marketplace browser

### Technology

- React + TanStack Start (same as current landing page)
- Connects to orchestrator API (REST + WebSocket)
- Reads company FS via `/fs/` endpoint
- Embeds artifacts via iframe
- Real-time updates via WebSocket

### Business Model

```
Free (Open Source):
  - CLI interface
  - All agent capabilities
  - All workflows
  - Knowledge base
  - API access

Pro ($49/month):
  - Dashboard web UI
  - Artifact previews
  - Skill marketplace access
  - Priority support

Business ($299/month):
  - Everything in Pro
  - Managed cloud hosting
  - Multi-user access
  - SSO / SAML
  - SLA

Enterprise (custom):
  - Everything in Business
  - Dedicated infrastructure
  - Custom integrations
  - White-label option
```

---

## 5. Decision Summary

| Decision | Rationale |
|----------|-----------|
| No special artifact system | Agents have Bash + FS. They run dev servers. Simple. |
| FS serving via HTTP | Knowledge and docs become linkable. Dashboard renders them. |
| Skills as markdown | Same as Claude Code skills. Simple, versionable, shareable. |
| Dashboard as paid product | CLI is free. Rich UI is the premium. Open-source core stays free. |
| Marketplace for skills | Community ecosystem. Revenue from curated/premium skills. |
| Artifact ports 4100-4199 | Fixed range, easy to manage, no conflicts with orchestrator. |
