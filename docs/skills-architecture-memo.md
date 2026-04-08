# QUESTPIE Skills Architecture Memo

> Date: 2026-04-08 (revised)
> Status: Proposal
> Author: Architecture review

---

## 0. Design Principle — Use Upstream, Don't Duplicate

Two systems, two jobs:

| Layer | Owner | Responsibility |
|-------|-------|----------------|
| **Open ecosystem** | `skills.sh` / `bunx skills` / `find-skills` | Public discovery, installation, updates, community browsing |
| **Company operating layer** | QUESTPIE Autopilot | Local awareness of installed skills, binding to profiles/workflows/agents, company-private skills, dashboard UX |

**Runtime execution uses native skill loading.** When a skill is installed into `.claude/skills/` or `.agents/skills/`, the underlying runtime (Claude Code, Codex, OpenCode) loads and executes it natively — via `/skill-name` invocation or automatic activation. QUESTPIE does not need to inject skill bodies into prompts. Prompt injection is a fallback only for runtimes that lack native skill support.

QUESTPIE's job is: discover, install/sync, bind, route, and integrate skills into the company context. Not to re-implement skill execution.

---

## 1. Current State — What Actually Exists

### Already Built & Working

| Layer | What Exists | Where |
|-------|-------------|-------|
| **Skill format** | SKILL.md files (frontmatter + markdown body) | `.autopilot/skills/` |
| **Loading** | `loadSkillsDir()` in scope-resolver — supports `name/SKILL.md` and `name.md` | `packages/orchestrator/src/config/scope-resolver.ts` |
| **ResolvedConfig** | `skills: Map<string, string>` field exists and is populated | `scope-resolver.ts:44` |
| **Sync** | `autopilot sync` copies skills to `.claude/skills/` and `.agents/skills/` | `packages/cli/src/commands/sync.ts` |
| **Capability profiles** | YAML profiles reference skills by ID; agent + step profiles merge | `packages/spec/src/schemas/capability-profile.ts` |
| **Profile merging** | Deduplication, agent-first ordering, prompt preservation | `packages/orchestrator/src/services/workflow-engine.ts` |
| **Runtime hints** | `## Active Skills` section with bullet list of names in prompt | `packages/worker/src/runtimes/shared.ts:32-34` |
| **Native runtime loading** | `autopilot sync` copies to `.claude/skills/` → Claude Code loads natively | `packages/cli/src/commands/sync.ts` |
| **Upstream skills CLI** | `skills-lock.json` tracks skills installed via `bunx skills` | Repo root |
| **Dashboard view** | `SkillDetailView` renders SKILL.md with role/tag/script badges | `apps/dashboard-v2/src/features/files/views/skill-detail-view.tsx` |
| **Dashboard creation** | Template registry with interactive skill creation form | `apps/dashboard-v2/src/lib/template-registry.ts` |
| **Pack distribution** | `category: skill` is a valid pack type; packs install via git registries | `packages/spec/src/schemas/pack.ts` |
| **Lockfile** | `.autopilot/packs.lock.yaml` tracks resolved packs + managed files | Same file |

### What's Missing

| Gap | Impact |
|-----|--------|
| **Skills dropped at AuthoredConfig boundary** | `ResolvedConfig.skills` is populated by scope-resolver, but `AuthoredConfig` (defined in `workflow-engine.ts:14-26`) does not include a `skills` field. Skills are logged at `server.ts:88` then discarded — the workflow engine and provider layer never see skill content. |
| **No local skill discovery CLI** | `autopilot skill list/find/show` don't exist |
| **No local runtime discovery tool** | Agent can't query the orchestrator's skill index at runtime |
| **No upstream CLI wrappers** | No `autopilot skill discover` wrapping `bunx skills find` |
| **Prompt hints are bare IDs** | `## Active Skills` lists names without descriptions — agent doesn't know what a skill does without loading it |
| **No skill metadata parsing** | Scope-resolver loads raw file content but doesn't parse frontmatter into structured metadata |

---

## 2. Architecture — Separation of Concerns

### 2.1 Upstream Ecosystem (`skills.sh`)

**Treat as the public package manager.** QUESTPIE does not rebuild this.

| Concern | Upstream Primitive | Notes |
|---------|-------------------|-------|
| Public discovery | `bunx skills find <query>` | Searches skills.sh registry |
| Installation | `bunx skills add owner/repo@skill` | Installs to `.claude/skills/` or `.agents/skills/` |
| Updates | `bunx skills update` | Updates installed skills |
| Health check | `bunx skills check` | Validates skill integrity |
| In-agent discovery | `find-skills` skill | Agent-invocable skill that searches the ecosystem |

Skills installed via `bunx skills` are tracked in `skills-lock.json` (repo root). This file is owned by the skills CLI — Autopilot does not read or modify it.

### 2.2 QUESTPIE Local Layer

**QUESTPIE operates over installed skills, regardless of how they got there.**

| Concern | QUESTPIE Primitive | Notes |
|---------|-------------------|-------|
| Local index | Parse all skills in `.autopilot/skills/`, `.claude/skills/`, `.agents/skills/` | In-memory, rebuilt on startup |
| Local discovery CLI | `autopilot skill list`, `autopilot skill show`, `autopilot skill find` | Searches local index only |
| Upstream wrapper | `autopilot skill discover <query>` | Thin wrapper over `bunx skills find` |
| Binding | Capability profiles reference skill IDs | Already works |
| Activation | Skill IDs listed in resolved capabilities per run | Already works |
| Prompt enrichment | `## Active Skills` with `name — description` | Needs frontmatter parsing |
| Native execution | Runtime loads skills from `.claude/skills/` or `.agents/skills/` natively | Already works via sync |
| Company-private skills | `.autopilot/skills/` + pack distribution via private registries | Already works |
| Dashboard UX | Skill browser, detail view, creation wizard | Partially built |

### 2.3 Skill Package Format

**Stay with SKILL.md.** No new format. Compatible with skills.sh, Claude Code, agentskills.io.

```
.autopilot/skills/
├── code-review/
│   └── SKILL.md          # Standard: directory + SKILL.md
├── testing-strategy.md    # Also valid: flat file
```

Frontmatter schema (extend current, all new fields optional):

```yaml
---
name: "Code Review Checklist"
description: "Structured code review with security, perf, and correctness checks"
version: "1.0.0"                    # For update tracking
tags: ["review", "quality", "ci"]   # For local search/discovery
roles: ["developer", "reviewer"]    # Existing — role filtering
author: "questpie"                  # Attribution
scripts: []                         # Existing — optional scripts
---
```

### 2.4 Pack Distribution

Packs remain a distribution vehicle for company-curated skills. A skill pack is `category: skill` with files targeting `skills/`:

```yaml
# pack.yaml
id: code-quality-skills
category: skill
version: 1.0.0
files:
  - src: code-review/SKILL.md
    dest: skills/code-review/SKILL.md
```

This coexists with `bunx skills add` — they target different directories and don't conflict:

| Install Method | Target Directory | Lock Tracking |
|---------------|-----------------|---------------|
| `autopilot sync` (packs) | `.autopilot/skills/` → synced to `.claude/skills/` | `.autopilot/packs.lock.yaml` |
| `bunx skills add` | `.claude/skills/` directly | `skills-lock.json` |
| Manual copy | `.autopilot/skills/` | None (just files) |

### 2.5 Install State

**No new lockfile.** Two existing mechanisms cover it:

- **Pack-installed skills:** tracked in `.autopilot/packs.lock.yaml` (existing)
- **Upstream-installed skills:** tracked in `skills-lock.json` by the skills CLI (existing)
- **Manually added skills:** just files — no lock needed

QUESTPIE may later normalize or import metadata from `skills-lock.json` for a unified view, but that is not required for P0.

### 2.6 Runtime Activation — What "Active Skill" Means

**Primary path: native runtime execution.**

When a skill is installed in the runtime's skill directory, the runtime handles it:
- Claude Code: loads from `.claude/skills/`, agent invokes via `/skill-name`
- Codex/OpenCode: loads from `.agents/skills/`

**QUESTPIE's role at runtime:**

1. **Prompt hints** — `## Active Skills` lists bound skill names with descriptions so the agent knows what's available
2. **Local discovery tool** — `find_skills` MCP tool lets the agent search the orchestrator's local skill index
3. **Fallback injection** — for runtimes without native skill support, `use_skill` can return skill content via MCP

The orchestrator does NOT inject full skill bodies into every prompt. The runtime handles skill content loading.

---

## 3. Minimum Viable Discovery Layer

### Local skill index (P0)

In-memory, rebuilt on orchestrator startup. Parses frontmatter from all skill sources:

```typescript
interface SkillEntry {
  id: string                    // Directory name or filename stem
  name: string                  // From frontmatter
  description: string           // From frontmatter
  tags: string[]                // From frontmatter
  roles: string[]               // From frontmatter
  path: string                  // Filesystem path
  origin: 'autopilot' | 'claude' | 'agents'  // Which directory it came from
}
```

Search = simple keyword filter:

```typescript
function findSkills(query: string, role?: string): SkillEntry[] {
  return Array.from(skillIndex.values())
    .filter(s => {
      if (role && !s.roles.includes(role) && !s.roles.includes('all')) return false
      const q = query.toLowerCase()
      return s.name.toLowerCase().includes(q)
        || s.description.toLowerCase().includes(q)
        || s.tags.some(t => t.toLowerCase().includes(q))
    })
    .slice(0, 10)
}
```

**No SQLite.** ~20-50 skills. A Map and string matching is sufficient.

**No embedding search.** Deferred until catalog exceeds ~100 skills.

---

## 4. CLI Primitives

### P0 — Local awareness + upstream wrappers

```bash
# List all locally installed skills (all directories)
autopilot skill list
# Output:
#   code-review          Structured code review checklist          [review, quality]   .autopilot/skills/
#   d2-diagram-creator   Create D2 diagrams                       [diagram]           .claude/skills/

# Show full skill content
autopilot skill show code-review

# Search locally installed skills
autopilot skill find "review"

# Discover from upstream ecosystem (wraps `bunx skills find`)
autopilot skill discover "presentations"
```

### P1 — Install wrappers

```bash
# Install from upstream (wraps `bunx skills add`)
autopilot skill add owner/repo@skill

# Update upstream-installed skills (wraps `bunx skills update`)
autopilot skill update
```

### P2 — Curated / business layer

```bash
# Browse QUESTPIE-curated skills (future)
autopilot skill browse --source questpie
```

---

## 5. Runtime Primitives (MCP Tools)

### P0 — Local discovery only

Add to the autopilot MCP server:

```typescript
// Search locally installed skills — returns name + description
{
  name: "find_skills",
  description: "Search locally available skills by keyword.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search term" },
    },
    required: ["query"],
  },
}
```

**No `use_skill` tool in P0.** The agent uses the skill via native runtime mechanisms (`/skill-name`). If the agent needs skill content and the runtime doesn't support native loading, `use_skill` becomes a P1 fallback tool.

**No `install_skill` runtime tool.** Installation is a human/CLI concern, not a runtime decision.

---

## 6. Skill Sources Model

| Source | How Skills Get There | Lock Tracking | Available Now |
|--------|---------------------|---------------|---------------|
| **Local authored** | Human writes to `.autopilot/skills/` | None | Yes |
| **Pack-installed** | `autopilot sync` from git registries | `packs.lock.yaml` | Yes |
| **Upstream-installed** | `bunx skills add` to `.claude/skills/` | `skills-lock.json` | Yes |
| **Company-private** | Private git registry → pack sync | `packs.lock.yaml` | Yes |
| **Community** | `bunx skills add` from public repos | `skills-lock.json` | Yes |
| **QUESTPIE curated** | Future: business layer over packs/upstream | TBD | No |

All sources converge at runtime: skills end up in `.claude/skills/` or `.agents/skills/`, and the runtime loads them natively.

---

## 7. Data Model

### SkillManifest (parsed from SKILL.md frontmatter)

```typescript
const SkillManifestSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  version: z.string().default('0.0.0'),
  tags: z.array(z.string()).default([]),
  roles: z.array(z.string()).default(['all']),
  author: z.string().optional(),
  scripts: z.array(z.string()).default([]),
})
```

### SkillIndex (in-memory)

```typescript
interface SkillIndexEntry {
  id: string
  manifest: SkillManifest
  path: string
  origin: 'autopilot' | 'claude' | 'agents'
}
```

### AuthoredConfig extension

Add skills to the config path so the orchestrator can resolve skill metadata at claim time:

```typescript
export interface AuthoredConfig {
  // ... existing fields ...
  skills: Map<string, SkillIndexEntry>   // NEW — parsed skill index
}
```

### ResolvedCapabilities — enrich hints

```typescript
// Current: skills: string[] (bare IDs)
// Proposed: add skill_hints alongside
ResolvedCapabilitiesSchema = z.object({
  skills: z.array(z.string()).default([]),
  skill_hints: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
  })).default([]),
  mcp_servers: z.array(z.string()).default([]),
  context: z.array(z.string()).default([]),
  prompts: z.array(z.string()).default([]),
})
```

This lets `buildPrompt()` emit `## Active Skills\n- code-review — Structured code review checklist` instead of bare IDs, without injecting full skill bodies.

---

## 8. Connections to Other Systems

### Capability Profiles → Skills
Already works. Profile lists skill IDs, merged at run time. P0 enriches with descriptions.

### Agents → Skills
Via capability profiles. No direct agent→skill reference needed.

### Workflows → Skills
Via step-level capability profiles. A workflow step can activate skills for that step only.

### Query/Assistant Mode → Skills
Default agent's capability profile determines available skills. Agent can also use `find_skills` to discover others.

### Dashboard → Skills
- **File browser:** Already renders SKILL.md files with `SkillDetailView`
- **Skill creation:** Already has template in `template-registry.ts`
- **P1:** Add dedicated skill browser page with search/filter
- **P2:** Upstream skill browsing and install from dashboard

### Native Runtimes → Skills
Runtimes load skills from their directories natively. QUESTPIE ensures skills are synced to the right directories. Execution is the runtime's responsibility.

---

## 9. Skill Revision — Capability Improvement from Feedback

### The Problem

A generic upstream skill (e.g. `presentation-builder`) produces correct but generic output. The company has a design system in knowledge (`context/design-system.md`). The agent builds a presentation, the human reviews: "toto nie je podľa nášho dizajn systému." The agent can fix the output — but the skill itself doesn't learn. Next time, same problem.

### Key Constraint: This Is Not a Mid-Run Steer

Mid-run steering for Claude is not fully operational today. Skill revision should NOT be modeled as an implicit steer injected into every run.

**Skill revision is an explicit follow-up task** — a capability-improvement branch triggered by human feedback on a completed run. It runs as a separate task/run, not as a live correction inside the original.

### The Flow

```
1. Task: "sprav prezentáciu o Q1 výsledkoch"
2. Agent uses generic `presentation-builder` skill → produces output
3. Run completes. Human reviews result.
4. Human provides feedback (reply/reject): "použi náš dizajn systém, fonty, farby"

   === Two branches from here ===

   Branch A (output fix): existing on_reply → re-run with feedback context
   Branch B (skill improvement): NEW → follow-up task to revise the skill itself

5. Branch B spawns: "Revise presentation-builder skill to incorporate design system"
6. Agent reads upstream skill + company knowledge → writes local fork
7. Next time Branch A or any new task uses the adapted skill
```

Branch A already works (workflow `on_reply` transitions). Branch B is the new pattern.

### How Branch B Works

**Upstream skill stays upstream.** The agent writes a company-local fork:

1. Follow-up task created (manually or via workflow transition)
2. Agent reads the upstream skill (e.g. `.claude/skills/presentation-builder/SKILL.md`)
3. Agent reads the relevant knowledge (e.g. `.autopilot/context/design-system.md`)
4. Agent reads the feedback from the original run (available as workflow history / prior run summary)
5. Agent writes a **company-local fork** to `.autopilot/skills/presentation-builder/SKILL.md`
6. Local fork shadows the upstream skill (project shadows upstream — existing precedence rule)
7. `autopilot sync` propagates the fork to runtime directories
8. Future runs use the company-adapted version

**The fork preserves upstream structure** but adds company-specific instructions:

```markdown
---
name: "Presentation Builder"
description: "Create presentations following company design system"
tags: ["presentations", "slides"]
forked_from: "upstream/presentation-builder"   # Tracks origin
---

# Presentation Builder

<upstream skill content, adapted>

## Company Design System

- Use Inter font family (headings: Inter Bold, body: Inter Regular)
- Primary: #2563EB, Secondary: #7C3AED
- Slide dimensions: 16:9
- Always include company logo on title slide
- Reference: see context/design-system.md for full guidelines
```

### Modeling Options

**Option 1: Explicit human-triggered follow-up task**

Human reviews output, decides the skill needs improving, creates a task:
```
"Uprav presentation-builder skill aby používal náš dizajn systém"
```

Simple. No new machinery. Agent already has file write access and knowledge context. The task is a normal task that happens to write to `.autopilot/skills/`.

**Option 2: Workflow transition to skill-revision step**

A workflow can include an explicit `improve-skill` step:

```yaml
steps:
  - id: create
    instructions: "Create presentation using active skills"
  - id: review
    type: human_approval
    on_approve: done
    on_reply: create            # Fix output (Branch A)
    on_reject: improve-skill    # Fix skill (Branch B)
  - id: improve-skill
    instructions: "Revise the active skill to incorporate feedback and company knowledge"
    capability_profiles: [skill-author]
    transitions:
      - target: create          # Re-run with improved skill
```

This makes skill revision a first-class workflow step, not an ad-hoc task. The `on_reject` vs `on_reply` distinction maps well: reply = "try again with this feedback", reject = "the approach is wrong, fix the tool."

**Option 3: Orchestrator-suggested follow-up**

After repeated `on_reply` loops on similar feedback (detected via revision count), the orchestrator suggests: "This feedback seems structural. Should I create a task to revise the skill?"

This is the smartest option but requires the most machinery. Defer to P2.

### What Exists vs What's Needed

| Component | Status | Notes |
|-----------|--------|-------|
| Follow-up tasks | **Exists** | `task_spawn_children` MCP tool, manual creation |
| Workflow `on_reply` / `on_reject` transitions | **Exists** | Maps naturally to fix-output vs fix-skill |
| Prior run summary in context | **Exists** | `buildStepContext()` injects workflow history |
| File write from agent | **Exists** | Agents have Bash/file tools |
| Skill shadowing (local overrides upstream) | **Exists** | Precedence rule in scope-resolver |
| Revision loop guard | **Exists** | Max 3 revisions before escalation |
| `forked_from` frontmatter field | **Missing** | Tracks origin for future update/diff |
| `skill-author` capability profile | **Missing** | Profile with relevant knowledge + prompt guidance |
| Post-revision sync | **Missing** | `autopilot sync` after skill write |
| Orchestrator-suggested skill revision | **Missing** | P2 — requires pattern detection |

### Guardrails

- Skill revision is always an **explicit, separate task** — never an implicit side-effect of a normal run
- Revisions should be additive (add company context), not destructive (strip upstream instructions)
- `forked_from` field enables future `autopilot skill diff` to show what changed from upstream
- Skills are files in git — review happens at commit/PR time, not at write time
- The workflow engine's existing revision loop guard (max 3) prevents infinite improve→create→review cycles

### Anti-Patterns to Avoid

- **Don't auto-fork on every feedback.** Not all feedback is about the skill — sometimes the output is just wrong.
- **Don't inject skill revision logic into every run's prompt.** It's a separate capability profile, not a default behavior.
- **Don't build a skill merge engine.** Git handles merges. If upstream updates, the human decides whether to re-fork.
- **Don't model this as mid-run steer.** The run completes, feedback arrives, a new task handles skill revision.

---

## 10. First-Party Skill Catalog (Proposed)

> Note: first-party skills should be designed as good fork targets — generic enough to work out of the box, structured enough that company-specific adaptations slot in cleanly.

Ship as `questpie/*` packs in the default registry. Also publish to skills.sh for public discovery.

| # | Skill ID | Category | Description |
|---|----------|----------|-------------|
| 1 | `presentation-builder` | Content | Create slide decks from briefs (reveal.js, Google Slides outline) |
| 2 | `founder-brief` | Business | Daily/weekly founder briefing from tasks, metrics, blockers |
| 3 | `ecommerce-ops` | Business | Ecommerce operations dashboard: orders, inventory, alerts |
| 4 | `competitor-watch` | Research | Monitor competitor changes, pricing, features |
| 5 | `weekly-report` | Reporting | Generate team/project progress reports from task history |
| 6 | `spec-writer` | Engineering | Write product specs with structured templates (ADR, RFC, PRD) |
| 7 | `repo-onboarding` | Engineering | Analyze a repo and produce onboarding guide for new contributors |
| 8 | `code-review` | Engineering | Structured review checklist (security, perf, correctness) |
| 9 | `release-notes` | Engineering | Generate changelog from commits/PRs with audience-aware tone |
| 10 | `internal-app` | Builder | Scaffold internal tools (admin panels, dashboards, forms) |
| 11 | `api-design` | Engineering | REST/GraphQL API design review and documentation |
| 12 | `incident-response` | Ops | Incident triage, communication templates, postmortem structure |
| 13 | `brand-voice` | Content | Enforce brand tone, terminology, and style across outputs |
| 14 | `meeting-prep` | Productivity | Prepare agenda, talking points, and context from calendar + tasks |
| 15 | `data-analysis` | Analytics | Structured data exploration, visualization, and insight extraction |

---

## 10. Phased Roadmap

### P0 — Local Awareness & Binding

**Goal:** QUESTPIE knows what skills are installed, can search them locally, binds them to profiles/workflows, and relies on native runtime execution.

1. **Add skills to AuthoredConfig**
   - Add `skills: Map<string, SkillIndexEntry>` to `AuthoredConfig` interface (`workflow-engine.ts:14-26`)
   - Wire `ResolvedConfig.skills` through to `AuthoredConfig` in `server.ts:76-86`
   - Parse frontmatter into `SkillIndexEntry` (name, description, tags, roles) instead of storing raw content

2. **Build shared local skill parser/index**
   - Single utility that scans `.autopilot/skills/`, `.claude/skills/`, `.agents/skills/`
   - Parses SKILL.md frontmatter into `SkillIndexEntry`
   - Returns `Map<string, SkillIndexEntry>` — used by both orchestrator and CLI

3. **Enrich prompt hints**
   - Add `skill_hints` to `ResolvedCapabilities`
   - Change `buildPrompt()` from bare `- code-review` to `- code-review — Structured code review checklist`
   - No full body injection — runtime handles skill content natively

4. **Local CLI commands**
   - `autopilot skill list` — all installed skills across all directories
   - `autopilot skill show <id>` — render skill content
   - `autopilot skill find <query>` — keyword search over local index

5. **Upstream wrapper**
   - `autopilot skill discover <query>` — thin wrapper over `bunx skills find`

6. **Local MCP tool**
   - `find_skills` — search locally installed skills, returns name + description

### P1 — Install Wrappers, Smart Activation & Skill Revision

**Goal:** Streamline skill installation, add contextual suggestions, and enable agent-driven skill adaptation.

1. **Install/update wrappers**
   - `autopilot skill add <package>` → wraps `bunx skills add`
   - `autopilot skill update` → wraps `bunx skills update`
   - After install, trigger `autopilot sync` to propagate

2. **Task-context skill suggestion**
   - Orchestrator matches task description against local skill index
   - Injects "Recommended skills" hint in prompt (not auto-activated)

3. **Skill revision from feedback (§9)**
   - Add `forked_from` to SKILL.md frontmatter schema
   - Create `skill-author` capability profile with relevant knowledge context + prompt guidance
   - Model skill revision as explicit follow-up task or workflow `on_reject` step — not mid-run steer
   - Add post-revision `autopilot sync` to propagate forked skills

4. **`use_skill` MCP fallback tool**
   - Returns full skill body for runtimes without native skill loading
   - Read-only, no approval needed

5. **Dashboard skill browser**
   - Dedicated `/skills` page with search/filter by tag/role
   - Shows origin (local, pack, upstream, forked)
   - Install button for upstream skills

6. **Ship first-party skills**
   - 5-10 from the catalog above as `questpie/*` packs
   - Also publish to skills.sh
   - Design as good fork targets (see §10 note)

### P2 — Curated Business Layer

**Goal:** QUESTPIE-specific curation and business features on top of the open ecosystem.

1. **QUESTPIE skill catalog**
   - Curated collection with verification, quality review
   - Browsable from dashboard and CLI

2. **Dashboard marketplace UX**
   - Browse upstream + QUESTPIE-curated skills
   - One-click install, ratings, usage stats

3. **Embedding-based search**
   - Only if catalog exceeds ~100 skills

---

## 11. Risks & Tradeoffs

| Risk | Mitigation |
|------|------------|
| **Upstream drift** — skills.sh format or CLI changes | Stay format-compatible. Wrappers are thin — easy to update. |
| **Two lock files** — `packs.lock.yaml` + `skills-lock.json` | Different owners, different concerns. Don't try to unify. |
| **Skill naming collisions** — same skill installed via packs and upstream | Local index deduplicates by ID. `.autopilot/skills/` takes precedence (company intent). |
| **Runtime doesn't support native skills** — some runtimes may not load from skill dirs | `use_skill` MCP fallback delivers content directly. But this is a fallback, not primary path. |
| **Prompt hints without content** — agent sees skill name but can't invoke if runtime didn't load it | Ensure `autopilot sync` runs before agent execution. Skill dirs are the contract. |
| **Overbuilding QUESTPIE layer** — duplicating what skills.sh already does | Principle: wrap upstream, don't reimplement. QUESTPIE adds company context, not package management. |

---

## 12. What Should NOT Be Built Yet

- **QUESTPIE-hosted marketplace** — open ecosystem exists; curate on top later
- **Custom skill registry backend** — git registries + skills.sh cover distribution
- **Skill body injection as primary path** — runtimes handle content loading natively
- **Skill versioning with semver ranges** — overkill at current scale
- **Skill dependencies** (skill A requires skill B) — complexity not justified
- **Dynamic skill hot-reload during a run** — snapshot at sync time is fine
- **Skill analytics** (usage tracking, effectiveness scoring) — premature
- **Paid skill infrastructure** (billing, licensing, DRM) — no marketplace yet
- **SQLite index** — in-memory Map is sufficient at current scale
- **Embedding search** — keyword matching handles the catalog size we'll have for months
- **`skills-lock.json` import/normalization** — different system, different owner; observe, don't merge

---

## 13. Summary

The skill system has two layers with clear ownership:

**`skills.sh` / `bunx skills`** = open ecosystem package manager. Handles public discovery, installation, updates. Already works. QUESTPIE wraps it where useful, never reimplements it.

**QUESTPIE Autopilot** = company operating layer. Handles local awareness, binding to capability profiles and workflows, prompt enrichment, company-private skills, and dashboard UX. Relies on native runtime skill execution — does not inject skill bodies into prompts as primary path.

P0 is deliberately small: add skills to AuthoredConfig (fix the wiring gap), build a shared skill parser/index, add local CLI commands, add one MCP tool, add one upstream wrapper, and enrich prompt hints with descriptions. No marketplace, no body injection, no new lockfile.

The runtime contract is: skills synced to `.claude/skills/` or `.agents/skills/` are loaded natively by the runtime. QUESTPIE ensures they get there and tells the agent what's available.
