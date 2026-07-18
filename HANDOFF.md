# QUESTPIE Autopilot — v2 rebuild HANDOFF

> **Purpose:** hand this to Codex to turn into detailed technical + design specifications, then implement. It is the brief + context + guardrails for a **fresh, deliberate rebuild** of Autopilot as real code. It is NOT the spec — Codex writes the spec from this.

---

## 0. TL;DR — what Codex should produce from this

1. **`SPEC.md` (hard technical spec)** — product flows, data model (via the `/domain-modeling` skill, mapped onto QUESTPIE collections), QUESTPIE integration (which packages, how the headless backend and the operator-web frontend connect), runtime/architecture. Concrete, uncompromising.
2. **`DESIGN-SYSTEM.md` + a running Vite + Storybook design kit** — tokens + ONE canonical primitive set (base-ui + Tailwind v4). No variant sprawl. This is built and reviewed in Storybook *before* any page.
3. **Pass-1 screen specs** — for the 8 main surfaces (below), each as an **ASCII layout + an MD element table** (every element: what it is · how it fills/binds · how it behaves · AI-timing). Pages are then LEGO from the primitives.

Sequence is strict: **data model + flows → design kit in Storybook → pages**. Design-system-first, deliberate, high-fidelity. Not mass-generated.

**Hard first milestone: a running week-1 dogfood MVP** (§1.5) — the Phase-0 surfaces (§8): onboard Firma → Priestory → Ciele → Úlohy → Chat/Kanály with Autopilot as an @mentionable Aktér. Then grow strictly by phase (depth → dashboards/miniapps/automations → vibecoding/deploy last). The `@questpie/ai` package exposes an easy "AI work" primitive from day 1 so contextual AI features are cheap to add later.

---

## 1. Product vision

**Autopilot = the AI-native operating layer for QUESTPIE.** Self-hosted, MIT, one company app where **AI agents are first-class team members (Aktéri)** under the same RBAC as humans. Tagline: *"Run your company · Build your apps · Automate the rest"* — think **Linear (work) + Slack (collab) + Lovable (vibecoding) + Zapier (automation)** on one open stack.

**Phase-1 scope (build this):** the collaborative company app — **Úlohy · Ciele · Chat/Kanály · AI-as-member · Artefakty/Miniappky · Znalosti · Priestory · Automatizácie · Tím**. Vibecoding **Builder** + config-driven **Deploy** are **phase-2** (represent in the data model/flows, build later). **Packs** (cloud registry) are deferred.

**Pillars:** (1) Collaborate — Slack-like, agents are participants beside people; (2) Work — Linear-like Úlohy/Ciele/Projekty; (3) Knowledge — semantic Znalosti agents query before deciding; (4) Automate — durable Workflows + Schedules; (5) Artifacts + Miniapps — hosted interactive tools (like the agent-board); (6) Build/Deploy (phase-2); (7) Agents/MCP/RBAC + Integrations (Slack/GitHub/Email); (8) Skills/Packs (deferred).

**Ubiquitous language (SK):** Firma · Priestor · Aktér (human|agent, peers) · Úloha · Cieľ · Kritérium · Projekt · Vlákno · Kanál · Znalosť · Automatizácia · Miniappka · Artefakt · Beh.

---

## 1.5 Roadmap & phasing — dogfood in week 1, then grow

**Goal: a running MVP the team can dogfood by end of week 1.** Product AND UI evolve together, foundation-first: never a surface without its locked primitives.

- **Phase 0 — Week-1 dogfood MVP (thin but END-TO-END real).** A real company can run a slice of work through it. Contains: **Onboard the Firma** (workspace setup · **AI provider/model gate** · invite Aktéri incl. Autopilot) → **Priestory** (create/enter a space) → **Ciele** (create + track a goal, basic) → **Úlohy** (list + detail, basic) → **Chat/Kanály** collaboration → **AI integration**: Autopilot is an Aktér you **@mention** in a channel or on a task, it does a simple piece of work and posts back into the thread. Built on the design kit + shell locked first.
- **Phase 1 — Collaborative depth.** Full goal-loop (spec editor · acceptance criteria · breakdown→coverage · review gate · live agent-run), task detail + anchored threads, **Znalosti** (knowledge agents query before deciding), **Tím** + agent profiles, richer chat (threads · DMs · presence).
- **Phase 2 — Insight & automation.** **Dashboardy** · **Artefakty/Miniappky** · **Automatizácie** (schedules + step-graph flows).
- **Phase 3 — Build & ship (LAST).** Vibecoding **Builder** (real git repos · preview · approval · audit) · config-driven **Deploy**.
- **Contextual / deep AI features — progressively, mostly LAST.** BUT the `@questpie/ai` package must expose from day 1 a **simple, first-class framework primitive for "AI work"** — an easy way to bind an AI action/feature to any collection/route under RBAC + MCP + sandbox (e.g. `ai.suggest()/ai.run()`), so any contextual AI feature (name suggestion, summarize, draft, classify, dispatch…) is cheap to sprinkle in incrementally. **Spec this primitive early even though the fancy AI features ship late** — it's the leverage that makes "AI everywhere" trivial later.

**UI evolution (parallel):** tokens + primitives locked in Storybook → **shell** (IA + navigation) → phase-0 screens as LEGO → progressively richer surfaces per phase. Codex sequences the SPEC and implementation along these phases; week-1 MVP is the first hard milestone.

---

## 2. Why v2 — honest learnings (anti-patterns to NOT repeat)

The first attempt built **89 HTML wireframe artboards** fast, via many parallel agents. It failed on coherence. The board is kept **only as inspiration for IA + flows**, never as a visual/impl reference. What went wrong, and the rule it implies:

| What went wrong | Rule for v2 |
|---|---|
| **No real design system** — ~10 button class-combos, 76 inline-styled buttons, badge/chip sprawl (dot/state/pill/tag/scope-chip/gen-chip/qchip…), surfaces "sometimes flat, sometimes white cards" | **ONE hard, enforced design system.** Tokens + a small canonical primitive set, built and locked in Storybook first. A button has one API, N defined variants — not 10 ad-hoc combos. Decide flat-vs-card ONCE and enforce. Lint against inline styles. |
| **No IA / no transitions** — 89 disconnected artboards, you couldn't navigate to half of them | **Define the IA + navigation model + real screen-to-screen transitions** before drawing screens. |
| **Unrealistic AI-interaction timing** — "Autopilot suggests a name instantly as you type" drawn as magic | **Specify realistic AI-interaction timing** per moment: trigger (debounce-on-pause / on-blur / explicit "Navrhni" button), loading + streaming + accept states, latency. No instant magic. |
| **Ungrounded data** — unclear where/how data is stored | **Ground every surface in the data model** (which collection/field, stored vs derived). |
| **Too much at once** — 107-screen coverage before a foundation | **Deliberate, small, high-fidelity.** Pass-1 = 8 core surfaces done properly, LEGO from primitives. |

---

## 3. Approach & stack

- **New repo:** `questpie-autopilot-v2` (local) → link to `github.com/questpie/autopilot` (replaces old content — **the owner does the remote push/overwrite; a destructive remote op must not be automated**). The old `questpie-autopilot` repo and `questpie-cms/apps/autopilot` are **archived** (inspiration only).
- **App:** **TanStack Start** (React 19, Vite 8, Tailwind v4) over headless QUESTPIE.
- **Design kit:** **Vite + Storybook**, primitives on **`@base-ui/react`** (v1.x) + Tailwind v4 tokens. (shadcn patterns as reference; base-ui as the headless primitive layer.) The kit is a `packages/ui` workspace.
- **Data/query:** `@questpie/tanstack-query` (QUESTPIE's query integration) against the headless backend.
- **Monorepo:** turbo + bun (mirror the QUESTPIE ecosystem conventions).

---

## 4. What Codex specifies (deliverables, in order)

1. **Data model + flows (`SPEC.md`)** — run `/domain-modeling` on the phase-1 domain (§6). Produce: entities + relations (mapped onto existing QUESTPIE collections, §6), the derived/computed fields (progress, coverage, "čaká na teba"…), and the **user flows** (§8 surfaces as connected journeys with transitions + AI-timing). State where each datum lives and how it's read/written (QUESTPIE collections/routes/MCP).
2. **QUESTPIE integration** — how operator-web (TanStack Start) talks to the headless QUESTPIE backend: which packages (§5), auth/RBAC/session, realtime (for chat/live-runs), the AI harness + MCP + sandbox for agent execution. Concrete package + API choices.
3. **Design system** (`DESIGN-SYSTEM.md` + Storybook) — tokens (decide the visual language: the old "Neutral Soft" dark is one option; the wireframes explored a warm flat "jubli" look — **pick ONE, justify, lock**), then the canonical primitives (§7). Build in Storybook, review, THEN pages.
4. **Pass-1 screen specs** — §8, each as ASCII + MD element docs, LEGO from the locked primitives.

---

## 5. QUESTPIE build-on surface (packages available)

`packages/`: **questpie** (core framework — collections/routes/RBAC/codegen), **ai** (agent harness/worker fleet), **mcp** (MCP-over-OAuth tools under RBAC), **sandbox** (miniapp/artifact runner), **workflows** (durable step-graph automations), **tanstack-query** (frontend query integration), **admin** (CMS back-office — reference, not reused), **executor**, **openapi**, **create-questpie**, **vite-plugin-iconify**, plus adapters **hono/elysia/next**. Operator-web consumes the headless backend + `ai`/`mcp`/`sandbox`/`workflows` primitives. Codex: specify exactly which and how.

---

## 6. Domain / data model (existing autopilot collections — the starting entities)

`actors` (human|agent peers), `goals`, `tasks`, `task-relations`, `chat-sessions`, `chat-messages`, `projects`, `project-workspace-sessions|runs|checkpoints` (vibecoding), `activity`, `agent-memory` + `memory-settings`, `schedules` + `schedule-executions`, `change-requests`, `environments`, `secrets`, `scripts`, `models` + `providers`, `assets`, `document-store` (miniapp storage), `run-links`, `preview-sessions`, `admin-audit-log`.

**Goal-loop deltas surfaced by the wireframe exploration (validate via /domain-modeling):** `goals.spec` (6-section structured JSON: Výsledok · Prečo&Kontext · Rozsah · Kritériá prijatia · Obmedzenia · Termín), **acceptance criteria as first-class rows** (task↔criterion binding → coverage), `goals.project` (nullable → company-wide goals), `goals.targetDate`, `chat_sessions.anchorType='goal'`, per-actor read cursor + realtime presence for chat. Derived: goal progress = criteria.met/total, coverage seg = per-criterion bound-tasks>0, "čaká na teba" = tasks in [backlog,review,waiting,failed].

---

## 7. Design-system non-negotiables (the primitive set)

Codex locks these in Storybook, ONE API each, defined variants only:
- **Button** — variants: primary (the single advancing CTA) · secondary · ghost · danger; sizes sm/md; states default/hover/active/disabled/loading. **Agent-identity color ≠ CTA color** (two distinct roles, never blurred).
- **Badge/Status** — ONE system: a status pill (labelled, warm-muted tones per state — running/attn/done/idle/blocked/failed — never loud red/green), a neutral tag, a count, a provenance chip (AI vs human). Kill the dot/state/pill/tag/scope-chip/gen-chip/qchip sprawl → a small set with props.
- **Surface** — decide flat OR card ONCE (recommend: mostly flat with hairline separation, cards only for genuinely elevated/interactive groupings) and enforce.
- **Actor chip + presence** — human and agent render identically (agent = one subtle mark). One component.
- **Inputs/fields, menu/dropdown (→ mobile sheet), modal (→ sheet), tabs, tooltip/popover, toast, table/list-row, sheet/drawer** — adaptive (desktop ↔ <768 mobile), on base-ui.
- **Overlays adaptive at 768** (dropdown/tooltip/modal → bottom sheet), **shell at 1024** (rail → bottom-nav + drawer). Inputs 16px on coarse pointer; 44px tap targets.
- Tokens only — no raw hex/px in components; theme via CSS vars (light + dark).

---

## 8. Surfaces by phase (build in this order — high-fidelity, deliberate)

**Phase-0 — week-1 dogfood MVP** (thin but end-to-end real):
1. **Shell** — the app frame + IA + navigation (rail bands: attention / Priestory-with-facets / resources; ⌘K palette; the collaborative-Linear spine). *Implies the whole IA.*
2. **Onboarding** — Firma setup · **AI provider/model gate** · invite Aktéri incl. Autopilot (basic Tím) · first Priestor/Cieľ.
3. **Priestory** — create/enter a Priestor (overview + facet tabs). (Directory-at-scale = later.)
4. **Ciele** — create + track a goal, basic lifecycle. (Spec-editor/breakdown depth = phase-1.)
5. **Úlohy** — list + task detail, basic. (Board-at-scale/review/live-run = phase-1.)
6. **Chat/Kanály** — channel collaboration where **Autopilot is an @mentionable Aktér** that does a simple piece of work and posts back into the thread (the week-1 AI integration).

**Phase-1 — collaborative depth** (right after MVP):
7. **Ciele depth** — spec editor (6 sections) · acceptance criteria · breakdown→coverage · review gate · live agent-run.
8. **Úlohy depth** — queue/board at scale · task detail as document + one anchored mixed-Aktér thread.
9. **Znalosti** — Knižnica browse + document detail (AI-draft + provenance) + inline reference.
10. **Tím** — full Aktér directory (human/agent peers, RBAC) + agent-profile config.

**Phase-2:** Dashboardy · Artefakty/Miniappky · **Automatizácie** (list + step-graph editor + executions). **Phase-3 (last):** Builder · Deploy.

---

## 9. Personas & scenarios (from the exploration — reuse)

- **Marek Hraško** — founder/operator, DTC brand "Hrebeň" (combs/hats). Runs the company; wants Autopilot to do work under his approval.
- **Lucia Bartošová** — marketing doer; @mentions Autopilot, curates its output.
- **Zuzana Kováčová** — fractional brand editor; the review/gate persona.
- **Tomáš** — technical; config, providers, integrations.
- **Autopilot** (+ role agents Architekt/Developer/Critic) — first-class Aktér peer.
- **Anchor scenario:** "In a Projekt, start a new Cieľ → specify it → break into Úlohy → keep them under the Projekt → track to done." Every surface must serve a real job in this scenario.

---

## 10. Inspiration assets (mine for IA + flows, NOT visuals)

Old wireframe board: `~/.agent-board/projects/questpie-autopilot/wireframes/autopilot-operator-web-product-wireframes/` — 89 artboards + docs worth reading: **COVERAGE-MAP.md** (107-screen E2E inventory, priorities), **SCREEN-MAP.md** (goal-loop screen specs), **PERSONAS-SCENARIOS.md**, **ELEMENT-LOGIC.md** (per-element data-fill + generative glossary), **JUBLI-ADAPTIVE.md** (mobile adaptive patterns), **CONSISTENCY-AUDIT.md** (the sprawl analysis). Autopilot backend context: `questpie-cms/apps/autopilot/CONTEXT.md`. Product vision page: questpie.com/autopilot.

---

## 11. Method — design-kit-first, then LEGO pages

1. Lock tokens + primitives in Storybook (reviewed, no sprawl).
2. For each pass-1 surface, write an **ASCII layout** + an **MD element table** (element · what · data-binding (stored/derived) · behavior/states · AI-timing) — the page's contract.
3. Implement the page as pure composition of locked primitives. If a page needs something not in the kit → add it to the kit + Storybook FIRST, then use it.
4. Verify each surface deliberately (Storybook + the running app), not by mass screenshot.

---

## 12. Guardrails (non-negotiable)

- Design-system-first; nothing ad-hoc; no inline-style variant sprawl; lint it.
- Realistic AI-interaction timing everywhere; no instant magic.
- Clear IA + navigation + transitions before screens.
- Grounded data (collection/field, stored vs derived) for every element.
- Deliberate + small (pass-1 = 8 surfaces) over broad coverage.
- SK product language, Hrebeň scenario, Aktér human/agent parity.
