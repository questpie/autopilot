# Wireframe Extraction & Rebuild Plan — Autopilot Operator Web

**Status:** canonical · single source of truth for the UI rebuild
**Direction:** collaborative-Linear rendered in **flat jubli** (warm paper `#FBF9F5`, one coral `#F26A45`, light-first, no decorative shadows)
**Scope:** Phase 1 (goal lifecycle + shell + spaces + tasks + collab). Vibecoding Builder/deploy is Phase 2, deferred.

## TL;DR (the finding in five sentences)

1. The **design language is already pinned in tokens** — `packages/ui/src/styles.css` + the wireframe `tokens.css` carry the exact system the owner cited (paper `#FBF9F5`, coral `#F26A45`, Geist+JetBrains, radii **10/14/18/24**, 4px grid, flat elevation, `--shell-rail: 14.75rem` = **236px**). Nothing needs inventing at the token layer.
2. The **kit (`@questpie/ui`) already ships ~90% of the canonical primitives and templates** — the 3‑band `CompanyShell`, the canonical `SpaceFacetNav`, the full object surface (`ObjectList` + `ObjectViewBar` + `DocumentDetail` + `ContextualThreadPanel`), the generative `CommandPalette`, `MessageComposer`, `ChannelThread`, the `Run*` family, `StatePanel`, and the whole `Actor*` (aktér) family.
3. The **app throws almost all of it away.** Across all of `apps/operator-web/src` there are ~20 imports of `@questpie/ui`; the app uses `CompanyShell` (once, well), `AuthShell`, `InvitationPanel`, `StatePanel`, and `SpaceContext` (once, thinly) — and **never** uses `SpaceFacetNav`, `ObjectList`, `ObjectViewBar`, `DocumentDetail`, `CommandPalette`, `ChannelThread`, `RunDetail`, or `MessageComposer`. Every screen interior is hand-rolled thin Tailwind (e.g. `create-space-dialog.tsx` = 90 LOC bespoke modal; `needs-you.tsx` = 22 LOC).
4. The **one genuinely missing kit cluster is the Goal Lifecycle** — the owner's non‑negotiable (`.seed`, `.focusbar` stepper, `.doc` spec editor, `.crit` acceptance‑criterion rows, `.brow` breakdown, `.coverage` strip, `.confirmbar`, `.suggest` accept/reject diffs, `.qchip`) plus the rail `.aihint` co‑authored suggestion chip. These do not exist in the kit and must be built.
5. So the rebuild is mostly **"consume the kit, build the goal‑lifecycle layer"**: fix/extend a few kit foundations, build the goal‑lifecycle primitives, then rebuild each screen on canonical templates — auth+onboarding → shell → space overview → space create → **goal create (stepper)** → task detail/live‑run.

**Evidence key:** `WF:<screen>` = wireframe screen HTML under `/Users/drepkovsky/.agent-board/projects/questpie-autopilot/wireframes/autopilot-operator-web-product-wireframes/screens/`. `S#.#` = `SCREEN-MAP.md` screen id. Kit/app paths are absolute. Primitive `.class` names are the wireframe's own (from `ELEMENT-LOGIC.md` + `tokens.css`).

---

# Part 1 — Extracted design language (the canonical system)

## 1.1 Source-of-truth hierarchy

Resolve conflicts in this order (higher wins):

1. **`packages/ui/src/styles.css` + wireframe `tokens.css`** — the pinned tokens (palette, radii, spacing, type, elevation, geometry). Rule (top of `tokens.css`): *"no raw color/px lives outside this file."*
2. **`SCREEN-MAP.md`** — the definitive screen list + IA decisions (3‑band shell, chat‑is‑a‑place, ⌘K‑generates, Space=operated surface of a Projekt, goal‑lifecycle deltas).
3. **`CONSISTENCY-AUDIT.md`** — the wireframe's own known drift + the canonical decision for each. **We resolve TO the audit, never copy the drift.**
4. **`ELEMENT-LOGIC.md`** (+ the cluster glossaries) — per‑primitive anatomy, states, and grounding. The three cluster glossaries are 1:1 extracts of it; it is the superset.
5. **`DESIGN-BRIEF.md`** — the OLD dark "Neutral Soft" direction. **Superseded** by SCREEN-MAP's jubli light‑first mandate; reuse only its archetype vocabulary (detail/board/conversation/document/table/composer/canvas/gallery/form‑settings/state‑set), never its dark surfaces or docked rail.

> Note on one drift inside the sources: `SCREEN-MAP.md §0` prose says radii "control 8 / card 12 / panel 16." That is superseded — **`tokens.css` `--radius-sm/md/lg/xl = 10/14/18/24` is canonical** (matches the owner's flag and the shipped kit).

## 1.2 Foundations / tokens — already in the kit, cite them

All values below are live in **`packages/ui/src/styles.css`** (`:root` warm‑light canonical, `[data-theme="dark"]` warm‑dark parity) and mirrored in the wireframe **`tokens.css`**.

### Surface ladder (paper → card → sunk → hover → rail)
| Token | Light | Role |
|---|---|---|
| `--color-canvas` / `--color-bg` | `#FBF9F5` | paper — app + content bg |
| `--color-surface` | `#FFFFFF` | card / panel |
| `--color-surface-mid` | `#F2EEE7` | sunk — muted fill / header |
| `--color-surface-high` | `#ECE6DC` | hover / **nav‑active** warm tint (never coral) |
| `--color-surface-rail` | `#F7F3EC` | left rail — off‑paper |
| `--color-board-bg` | `#EFE9DF` | deeper warm behind artboards |

Depth is expressed by **this ladder + hairline borders**, not shadow.

### Ink, borders, coral, status, agent
- **Ink:** text `#1C1A17` · muted `#5C544A` · subtle `#938A7D` · disabled `#C3BAAD`.
- **Borders (hairlines):** subtle `#EEE8DD` · border `#E4DCCE` · strong `#D3C8B7` · ring `#C3BAAD`.
- **THE one brand accent — coral `--color-primary #F26A45`** (`--color-on-primary #FFFFFF`, quiet tint `#FDEDE6`). CTA / advancing action **only** — never on nav‑active, links, status, or tabs.
- **Statuses (neutral, never a filled red/green badge):** ok `#2E9E5B` (done) · attn `#E0A33C` (needs you) · idle `#C3BAAD` · **run `#F26A45`** (the ONLY status that borrows coral — a live "agent working now" pulse).
- **Agent‑identity pair (separate from CTA coral):** `--color-agent #FDEDE6` tint + `--color-agent-ink #D9542F` ink.

### The two‑coral law (load-bearing — the DNA of the system)
There are **two corals and they are never confused**:
- **CTA coral** (`--color-primary` solid + `--glow-primary`) = *the human's advancing/committing action*. Worn by **`.btn--primary` only** (one per surface) + the mobile raised `＋`. **The agent never presses a coral button.**
- **Agent‑identity coral** (`--color-agent` / `--color-agent-ink`) = *"the AI proposed / authored / is touching this."* Worn by provenance chips, the aktér agent mark, the rail suggestion chip, mentions, and the streaming caret.

Corollaries the whole UI obeys: a proposal is never a filled coral button; **status is never a hue** (it is dot‑shape + word); authorship is coral, **computed signal is neutral** (progress/coverage/counts carry no mark).

### Spacing — 4px grid
`--space-1..8 = 4 · 8 · 12 · 16 · 20 · 24 · 32 · 48`. All padding/gaps compose these; **no inline pixel spacing** (CONSISTENCY‑AUDIT §4).

### Radii — 10 / 14 / 18 / 24
`--radius-sm 10` (controls, chips, inputs) · `--radius-md 14` (buttons, cards, textarea) · `--radius-lg 18` (raised tab `＋`) · `--radius-xl 24` (seed card) · `--radius-pill 999` (avatars, ⌘K bar, scope chips, dots).

### Type — Geist for humans, JetBrains Mono for ids + facts
- `--font: "Geist"` — all human prose.
- `--font-mono: "JetBrains Mono"` — **identifiers, figures, timers, dates, counts, refs** (`hreben/eshop`, `#letná-kampaň`, `0:41`, `€48,2k`, `31. 7.`, `2/4`). Utilities in `styles.css`: `.ui-mono` / `.ui-type-meta` (mono + tabular‑nums), `.ui-eyebrow` (uppercase‑mono group header), `.ui-type-topbar-title`.
- Scale `--text-xs 11 … --text-display 28`; weights 400/500/600/700; `--lead-tight -0.01em`; tabular figures on all facts.

### FLAT elevation — honest depth
`styles.css`/`tokens.css`: all gloss/lift tokens are **explicit no‑ops** (`--lift-1/2`, `--gloss-*`, `--shadow-card/rail = 0 0 transparent`). Only two shadows exist: **`--glow-primary`** (soft coral, on the solid primary button only) and **`--shadow-pop`** (cast **only by floating layers** — menu/popover/modal/sheet/drawer). Everything else is flat fill + hairline.

### Named geometry tokens (resolves CONSISTENCY-AUDIT §4 — no inline widths)
`--shell-rail 14.75rem (236px)` · `--shell-topbar 3.8125rem` · `--detail-aside 23.75rem (380px)` · `--detail-split-min 73.75rem` · `--content-readable 47.5rem` · `--command-palette-width 40rem` · `--run-card-height 9rem` · `--sheet-max 28rem`.

### Status-as-neutral-copy (the exact mapping)
Status = a neutral chip (`.state`, 22px, `--color-surface-mid` bg, hairline, muted text) or a bare marker (`.dot`, 8px) whose **only** color is a small tone dot — never a colored row/badge. In the kit this is `Status` (`components/composites/status.tsx`) + the `[data-status]` CSS (`styles.css` L658–693): neutral surface + ink‑muted + hairline, with the dot alone carrying tone (`running` = coral pulse halo, `done` = green, `attention` = gold, `blocked/failed` = hollow ring). The operator words are **labels over the 9 stored task statuses**, never a parallel color set:

| Stored status | Marker | Slovak label |
|---|---|---|
| backlog · pending | `--idle` | Backlog |
| running | `--run` (coral pulse) | Beží |
| waiting + unmet dep | `--wait`/`--ring` (hollow) | Blokované |
| review · failed | `--attn` (gold) | Na schválenie · Zlyhalo |
| done · approved | `--ok`/`--done` (green) | Hotové · Splnené |

Goal‑lifecycle buckets (`Špecifikuje sa · Aktívne · Pripravené na uzavretie · Hotové`) are **derived**, not stored.

## 1.3 The three reusable layout patterns

### Pattern A — the 3-band co-authored shell  ·  `S0.3`, `WF:company-shell-desktop`
Rail width `--shell-rail` (236px), warm off‑paper (`--color-surface-rail`), three bands:
- **(A) Company attention** — `Domov · Inbox/Potrebuje ťa · Aktivita`
- **(B) Priestory/Spaces** — the co‑authored heart; each Space carries facet tabs + count/presence, and the band header carries the `.aimark` ✦ + a one‑at‑a‑time **`.aihint` suggestion chip** ("Autopilot navrhol view … pridať")
- **(C) Company resources** — `Knižnica · Automatizácie · Tím · Nastavenia`

Top of rail: brand mark + docked ⌘K. Foot: actor card + presence. **Chat is a place, not a docked rail** — the old 420px assistant rail is deleted; threads surface as the Kanál facet, anchored panels on Task/Cieľ detail, and a summonable ⌘K thread drawer. Nav‑active = `--color-surface-high` warm tint (never coral). Mobile <1024px: rail → drawer + bottom tab bar (`Domov · Priestory · ⌘＋ · Inbox · Ja`).

**Kit backing:** `CompanyShell` + `CompanyShellNavigation` (`packages/ui/src/components/templates/company-shell*.tsx`) already implement bands A/B/C via a generic `sections[]` model with item kinds `attention | space | channel | direct | resource`, the ⌘K header button, and the mobile drawer + bottom nav. **Missing:** the `.aihint` suggestion chip (no slot) and facet‑aware **expandable** Space rows (`SpaceNavigationItem` is flat). → extend (F1).

### Pattern B — the stepper creation layout (`.focusbar`)  ·  `S3.2–3.5`, `WF:ciel-novy / ciel-spec / ciel-rozbitie`
A **focused canvas embedded inside the shell content area** (not a cramped modal), driven by a minimal top **`.focusbar`**: back‑to‑Space + breadcrumb + a **step arc `Založ → Špecifikuj → Rozdeľ → Sleduj`** (`.focusbar__step` with `.done` green check / `.active` coral / pending subtle). Confirmed in source: `WF:ciel-spec` uses `focusbar__steps` with `focusbar__step done|active`. Body swaps per stage (seed → spec doc → breakdown → tracked detail); footer carries the one coral advancing action (`.confirmbar`). **Reusable** across Cieľ creation and the Priestor "rich flow."

**Kit backing:** **NONE.** `AuthShell` is a centered `max-w-md` card with a `Krok X z Y` hint — right for auth/onboarding, wrong for an in‑shell multi‑stage document canvas. → **BUILD `CreationStepper` / focus‑shell (F2).**

### Pattern C — facet-tab object surfaces  ·  `S2.1–2.4`, `WF:space-prehlad / ulohy-queue / ciele / kanal-channel-view`
Every Space screen is the same frame: **topbar (`SpaceContext`) → facet tabs (`SpaceFacetNav`) → view bar (`ObjectViewBar`) → object body (grouped dense list or board) or object detail (`DocumentDetail`)**. Canonical facet order (exactly, one active): `Prehľad · Úlohy · Ciele · Kanál · Znalosti · Dashboardy`. Object rows are dense `.wrow` `[marker · type · title · meta · time]`; groups carry sticky uppercase‑mono `.group-head`. Object detail is reading‑first document + anchored thread (`ContextualThreadPanel`, pinned aside ≥`--detail-split-min`, drawer/sheet below).

**Kit backing:** **FULLY BUILT** — `ObjectList` (`templates/object-list.tsx`, composes `SpaceContext` + `StateBand` + `SpaceFacetNav` + `ObjectViewBar` + `SelectionBar` + grouped list/board body + `StatePanel`), `ObjectViewBar`, `DocumentDetail`, `SpaceFacetNav`, `SpaceContext`, `ContextualThreadPanel`. The **app uses none of it** (see Part 2). The wireframe frames this as the App shell (`.app` grid `236px · 1fr · 380px optional thread`) hosting List‑Board / Document‑Split subshells; the docked thread's `380px` = `--detail-aside` (23.75rem), so `ContextualThreadPanel` pins ≥`--detail-split-min` and drawers below — exactly the wireframe's `.thread--anchored` (docked) vs `.thread--pane` (fills the pane, e.g. the Kanál place) placements.

## 1.4 Primitive inventory (wireframe primitive → kit component → status)

Status legend: **EXISTS** (kit has it, canonical) · **EXTEND** (kit has a near‑match, needs work) · **BUILD** (not in kit).

| Wireframe primitive (`.class`) | Purpose | Kit component (`packages/ui/src/…`) | Status |
|---|---|---|---|
| **Aktér avatar** `.avatar` / `.avatar--agent` | Actor identity; human=agent identical, agent differs ONLY by square corner (8px vs pill), warm coral tint, + 6px bottom‑right build‑mark | `components/composites/actor-mark.tsx` (+ `actor.tsx`, `actor-chip.tsx`, `actor-identity.tsx`, `actor-stack.tsx`) | **EXISTS** — human=agent via one `<Avatar>`; differs by `data-kind` + `"A"` fallback + agent tint. **VERIFY** the square‑corner + build‑mark `::after` render matches the wireframe. |
| **Composer** `.composer` | Thread/task message input; @mentions as chips, attachments as context tokens, Enter‑send, reconnecting keeps draft; **send is neutral, not coral** | `components/ai/message-composer.tsx` | **EXISTS** |
| **⌘K palette** `.cmd` / `.cmdbar` | Generative command bar: **Prejdi / Vytvor / Vygeneruj** + active‑scope chip + generate handoff | `components/composites/command-palette.tsx` | **EXISTS** (modes + scope chip + generate block all present) |
| **Facet bar** `.facet` / `.facets` | The signature Space facet tabs (canonical 6, one active) | `components/templates/space-facet-nav.tsx` (`canonicalSpaceFacetOrder`) | **EXISTS** (resolves audit §1) |
| **Topbar** `.topbar` / `.scope-chip` | `icon → identity → context (Projekt chip) → actions (presence + invite)` | `components/templates/space-context.tsx` (`--shell-topbar`) | **EXISTS** (resolves audit §2) |
| **Dense rows** `.wrow` / `.list` | Grouped Linear‑dense object rows `[dot · tag · title · meta]` | `composites/object-row.tsx`, `list-row.tsx`, `work-object-card.tsx`; `templates/object-list.tsx` | **EXISTS** |
| **Group header** `.group-head` (uppercase‑mono) | Sticky section label + count | `composites/state-group.tsx` + `.ui-eyebrow`; `SidebarGroupLabel` | **EXISTS** |
| **Status** `.state` / `.dot` | Status‑as‑neutral‑copy (dot tone + word) | `composites/status.tsx` + `[data-status]` CSS | **EXISTS** |
| **Progress** `.progress` | Derived criteria‑met/total bar + due countdown; no provenance mark | `.work-progress` in `styles.css`; task/goal row meta | **EXISTS** (derived bar) |
| **Thread / Vlákno** `.msgs` / `.msg` | One chat primitive, mixed aktéri, optionally anchored | `components/ai/channel-thread.tsx`, `channel-message.ts`; `composites/contextual-thread-panel.tsx` | **EXISTS** |
| **Tool‑card** `.toolcard` | Agent plan/step card — structured progress, human‑labeled | `components/ai/message-part-list.tsx`, `work-block.tsx`, `work-plan-block.tsx`, `permission-request-block.tsx` | **EXISTS** (as work/plan/part blocks) |
| **Run family** (`run_links` → `.livebar`/`.onit`/`.state--run`) | Beh = a composition, not one class | `components/ai/run-card.tsx`, `run-detail.tsx`, `run-attempt-list.tsx`, `run-permission-list.tsx` (HITL), `run-terminal-panel.tsx`, `run-recap.tsx`, `run-state.ts` | **EXISTS** (primitives) — but the **S4.4 live‑run VIEW** (plan → timeline → recap + intervene/take‑over + HITL pause) must be **composed** → F6 |
| **HITL approval** `.approval` | Mid‑run tool‑call approval card (Povoliť/Zamietnuť, coral Povoliť) | `components/ai/run-permission-list.tsx`, `permission-request-block.tsx` | **EXISTS** |
| **Review gate** `.review` | Plain‑English outcome approval (Zhrnutie · Čo sa zmení · Vyžaduje pozornosť · Istota + deliverable renderer + one coral Approve; NO raw diff) | — | **BUILD** (F7) |
| **State families** `.empty/.noresults/.errorstate/.accessstate/.inline` | 5 semantic states, aria‑busy skeletons | `templates/state-panel.tsx` (`UniversalState`) + `composites/state-band.tsx` | **EXISTS** (resolves audit §3) |
| **Overlays** `.sheet/.menu/.modal/.popover/.drawer/.tabbar` | One controlled component, right shape per device (768/1024 splits) | `composites/adaptive-*` (menu/modal/popover/select/combobox/tooltip/confirm) + `ui/drawer`, `ui/dialog`; mobile nav in `company-shell.tsx` | **EXISTS** |
| **Action** `.btn` / `.btn--primary` | One coral CTA per surface | `components/ui/button.tsx` | **EXISTS** |
| **Provenance** `.prov` / `.prov--ai` / `.aimark` / `.gen-chip` | Authorship marks; mixed authorship = two chips | `components/ai/run-provenance-list.tsx`; provenance in `composites/work-row-detail.tsx` | **EXTEND** — list exists; standalone `.prov` dot, `.aimark` ✦, `.gen-chip` need small primitives |
| **Mention** `.mention` | Inline `@actor`; agent coral vs **human neutral** | rendered in composer/channel | **EXTEND** — kit tints all mentions coral; add a neutral variant keyed on `actor.kind` |
| **Rail suggestion** `.aihint` | Autopilot proposes structure into the rail (co‑authored sidebar) | — | **BUILD** (F1) |
| **Seed composer** `.seed` / `.seed__in` | New‑goal intent canvas (big field + draft/write toggle + scope chip) | — | **BUILD** (F2/goal) |
| **Focus stepper** `.focusbar` | In‑shell stage arc `Založ→Špecifikuj→Rozdeľ→Sleduj` | — | **BUILD** (F2) |
| **Spec document** `.doc` / `.doc-section` | 6‑section co‑authored spec, streaming "Draft·Autopilot" | `templates/document-detail.tsx` (read‑first) | **EXTEND → SpecEditor** (F3) |
| **Acceptance‑criterion row** `.crit` | First‑class, addressable, checkable criterion (the backbone) | — | **BUILD** (F4) |
| **Breakdown row** `.brow` + **coverage** `.coverage` + **binding** `.mapsto` | Staged proposed tasks grouped by criterion + criteria↔tasks coverage gaps | — | **BUILD** (F5) |
| **Confirm bar** `.confirmbar` | Sticky plain‑language staged‑create gate (the one coral commit) | — | **BUILD** (F5) |
| **Suggestion card** `.suggest` | Inline AI accept/reject **diff** (del/ins + reason) | — | **BUILD** (F3) |
| **Clarifying chip** `.qchip` | Non‑blocking inline HITL question, coral‑tinted | — | **BUILD** (F3) |

**Reading:** the shell, object, collaboration, run, overlay, state, and aktér layers are **built and canonical**. The **BUILD** column is almost entirely the **Goal Lifecycle cluster** + the rail `.aihint` chip + the LiveRun assembly — i.e. the owner's non‑negotiable is exactly the gap.

## 1.5 CONSISTENCY-AUDIT resolutions (we resolve TO the audit)

The wireframe HTML drifts; the **kit templates already encode the audit's canonical decisions**. The resolution is therefore "adopt the kit template," not "re‑hand‑roll":

| Audit drift | Canonical decision | How we resolve it |
|---|---|---|
| §1 Facet nav drifts (counts/icons/extra `+`/missing bar) | Exactly `Prehľad·Úlohy·Ciele·Kanál·Znalosti·Dashboardy`, one active, one partial | Adopt `SpaceFacetNav` (`canonicalSpaceFacetOrder` enforces order + single active; `agentAuthored` flag for ✦). Every Space screen renders it. |
| §2 Topbar has no one contract (scope vocab, alignment, breadcrumbs) | Fixed `icon → identity → context → actions`; Space screens show `Projekt: …` + presence + `＋ pozvať` | Adopt `SpaceContext` (named slots + `--shell-topbar`). Utility screens use `PageHeader`. |
| §3 States conflated (bare `.skel`, access‑as‑error) | 5 families: empty / no‑results / error / access / inline; `aria-busy` skeletons | Adopt `StatePanel` (`UniversalState`) + `StateBand` (inline). `ObjectList` already routes loading→skeleton, state→`StatePanel`. |
| §4 Inline spacing/widths recreated | Page‑region classes + tokenized gaps + **named** widths (`--nav-width`, `--panel-width`) | Use `--space-*` + the named geometry tokens (`--shell-rail`, `--detail-aside`, `--content-readable`…). Lint out inline `padding`/`gap`/`width`/`font-size`. |
| §5 Heading/action drift | Exactly one `<h1>` + one active `.btn--primary` per surface; verb+object labels | Templates encode it (`DocumentDetail` one `<h1>`; `ObjectViewBar` one create action). Labels `Vytvoriť úlohu` / `Uložiť znalosť` / `Schváliť výstup`. |

The kit ships story-level guards for this (`consistency.stories.tsx`, `geometry-gate.stories.tsx`) — extend them into regression checks once screens migrate.

---

# Part 2 — GAP MATRIX

One row per Phase‑0 screen. **Wireframe intent** cites `S#`/`WF:`. **Kit template** = what backs it (or `BUILD:`). **Current app** = file + LOC + how it half‑asses. **Fix** = the move.

| Screen | Wireframe intent | Canonical kit template | Current app screen — divergence | Fix |
|---|---|---|---|---|
| **Auth / Sign‑in** (`WF:auth-signin`, `S`) | Centered card, brand + title + email/OAuth, invite‑continuation notice | `AuthShell` (EXISTS) | `components/screens/sign-in-screen.tsx` (246 LOC) — uses `AuthShell` well; **bespoke** invite notice `<div class="rounded-md border …">` (L32‑40) | Keep `AuthShell`; move notice into a kit notice/`StateBand` slot |
| **Onboarding · Company / AI / Work** (`WF:onboarding-first-run`) | Wireframe renders onboarding as **ONE in‑shell first‑run Canvas** inside `.app--norail` (co‑authored rail + Autopilot visible from step 1) — a 5‑step `.setgroup` checklist: workspace · **provider+model (the one mandatory gate)** · meet Autopilot · first goal+project · invite team. NOT centered auth cards. | In‑shell **Canvas** subshell (BUILD‑lite) — or keep `AuthShell` as the KISS path | `onboarding-steps.tsx` (201 LOC) — 4 separate `AuthShell` step cards (company/team/ai/work); capability panels bespoke `<section class="rounded-md border"><ul>` (L63‑72). **Diverges** from the in‑shell canvas, but a defensible KISS simplification. | Decide per appetite: **(KISS)** keep `AuthShell`, move bespoke panels onto kit `Item`/list; **(faithful)** render the first‑run canvas in‑shell so the co‑authored rail is present from step 1. Provider+model stays the one required gate either way. |
| **Onboarding · Team** | Invite humans + **add Autopilot as a peer member** in the ONE member list | `AuthShell` + `InvitationPanel` + `ListRow`/`ActorMark` | Onboarding uses the richer `team-roster.tsx` (284 LOC) — DOES reach `ListRow`/`ActorMark`/`Status`/`AdaptiveConfirm`, closest to canonical; still hand‑rolls the invite `Field` block | Promote `team-roster`; ensure the agent appears inline in the one member list |
| **Company Shell / Sidebar (3‑band)** (`S0.3`, `WF:company-shell-desktop`) | 3‑band co‑authored rail + ⌘K + `.aihint` chip + facet‑aware Spaces; chat is a place | `CompanyShell` + `CompanyShellNavigation` (EXISTS) **+ BUILD `.aihint`, expandable Spaces** | `routes/_authenticated/app/$companySlug.tsx` (246 LOC) — **real `CompanyShell`** (strongest integration); mostly data plumbing. Missing: suggestion chip, expandable Space→facets (kit lacks both) | Extend kit (F1); feed a richer nav model incl. suggestion + facet children |
| **Space Overview / Prehľad** (`S2.1`, `WF:space-prehlad`) | Facet shell + Prehľad: Ciele progress cards, pinned tiles, recent thread, **"Nový cieľ"** | `SpaceContext` (full) + `SpaceFacetNav` + object cards + `DocumentDetail` (compose) | `space-directory.tsx` `SpaceOverview` (69 LOC) — `SpaceContext` **thin** (`title` + hardcoded `meta="#general"` only); wraps `ChannelDirectory`+`ProjectDirectory` as two stacked `<ul>` in `grid gap-10`; **no `SpaceFacetNav`, no view bar** | Rebuild: full `SpaceContext` (project chip + members + invite) + `SpaceFacetNav` + Prehľad cards |
| **Space Directory** (`WF:priestory-directory`) | Directory of Spaces (facet‑aware, suggestion chips) | `ObjectList` / gallery (EXISTS) | `space-directory.tsx` `SpaceDirectory` (part of 69 LOC) — hand‑rolled `<ul class="grid gap-2">` of raw `<button class="border p-3">`; ignores `ObjectList`/`ObjectRow`/`PageHeader` | Rebuild on `ObjectList` + `ObjectRow` (or a Space gallery card) |
| **Space Create (rich flow)** (`WF:priestor-novy`, `S7.2`) | The **Focus shell WITHOUT a step arc** (explicit: "a single focused composer, not a wizard"): `.seed` name + projekt binding + Autopilot‑proposed facet `.suggest` (accept/edit) + members/visibility + sticky `.confirmbar`. NOT a cramped modal. | **BUILD:** `FocusShell` (F2, `steps` omitted) + `AdaptiveModal` for a quick path | `components/screens/create-space-dialog.tsx` (**90 LOC, fully bespoke**) — raw `fixed inset-0 z-50` + `<button class="bg-black/40">` backdrop, manual panel; **ignores** kit `Dialog`/`Drawer`/`AdaptiveModal`; only borrows `Field`/`Input`/`Button`/`StateBand` | Replace with the F2 `FocusShell` (no arc) + Autopilot structure‑proposal panel; keep `AdaptiveModal` only for a lightweight quick‑create |
| **Goal Create (stepper)** ⭐ (`S3.2→3.5`, `WF:ciel-novy/ciel-spec/ciel-rozbitie`) | `.focusbar` stepper `Zámer·Špecifikácia·Rozpad·Sledovanie`: seed → 6‑section co‑authored spec (`.crit` criteria, `.suggest` diffs, `.qchip`) → breakdown (`.brow` + `.coverage` + `.confirmbar`) → tracked detail | **BUILD:** `CreationStepper` (F2) + `SpecEditor` (F3) + `AcceptanceCriterionRow` (F4) + `BreakdownReview`/`CoverageStrip` (F5); `DocumentDetail` for S3.5 | **DOES NOT EXIST** — the app has no goals UI at all | Build the full cluster (F2–F5) on grounded fixtures (goals backend absent — see 3.3) |
| **Task Detail** (`S4.1`, `WF:uloha-detail`) | Reading‑first document + quiet sidebar (status/priority/project/goal/assignee) + **one anchored thread** (mixed aktéri, tool‑cards) + auto‑published banner+Undo | `DocumentDetail` (kind=`task`) + `ContextualThreadPanel` (EXISTS) | **DOES NOT EXIST** (no tasks UI) | Build screen on `DocumentDetail` + thread panel; fixtures |
| **Live Run / HITL** (`S4.4`, `WF:uloha-live-run`) | Plan checklist → human‑labeled step timeline → recap; mid‑run HITL tool‑approval pause, `zasiahni`/`prevezmi`, resumable replay | **COMPOSE `LiveRun`** (F6) from `run-detail`/`run-*`/`run-permission-list` + `MessageComposer` | **DOES NOT EXIST** | Assemble `LiveRun` from existing run primitives + composer; HITL via `RunPermissionList` |
| **Review Gate** (`S4.3`, `WF:uloha-review-gate`) | Reading‑first outcome gate: plain‑English **Zhrnutie · Čo sa zmení · Výstup (deliverable renderer) · Vyžaduje pozornosť · Istota** (NO raw diff) + one coral **"Schváliť výstup"** + "Vyžiadať zmeny" (threaded revision); auto‑published banner + Undo. Docks in Task detail and the Inbox split. | **BUILD:** `ReviewGate` (`.review`, F7) — mid‑run tool HITL stays `RunPermissionList` | **DOES NOT EXIST** | Build `ReviewGate`; dock in Task detail (`.thread--anchored`), Inbox split, and the Cieľ close flow |
| **Channel view** (`S2.3`, `WF:kanal-channel-view`) | Kanál facet: Slack‑like posts + @mention aktéri, agent replies in‑thread, "work spun up" dispatch card, presence | `ChannelThread` + `MessageComposer` (EXISTS) | **DOES NOT EXIST** — `channel-directory.tsx` (52 LOC) is a bespoke **list** of channels, not a channel view | Build Kanál facet on `ChannelThread` + `MessageComposer` |
| **Home / Domov** (`S1.1`, `WF:domov`) | A **Start Composer** generative front door (⌘K‑as‑a‑card, coral "Spustiť") + "Potrebuje ťa · 3" + cross‑Space active Ciele (derived `.progress`/`.coverage`) + live Aktivita | `PageHeader` + a Start‑Composer card (reuse `CommandPalette`/`MessageComposer` inline) + attention `ObjectList` | `company-home.tsx` (30 LOC) — bespoke header (re‑implements `PageHeader` by hand) + single `StatePanel`; **no start composer, no attention/goal cards** | Adopt `PageHeader` + Start‑Composer card + attention/goal `ObjectList` cards |
| **Inbox / Potrebuje ťa** (`S1.2`, `WF:inbox-potrebuje-ta`) | `.split` triage: single‑key disposition (E/A/X/H) list LEFT + the **same `ReviewGate` docked** RIGHT (`.thread--anchored`) | `ObjectList` (triage preset) + `ReviewGate` (F7) in a Document/Split | `needs-you.tsx` (**22 LOC** — thinnest) — `StatePanel` only | Rebuild on `ObjectList` triage preset + docked `ReviewGate` |
| **Aktivita** (`S1.3`, `WF:aktivita`) | Company activity feed, grouped, batched | `PageHeader` + `activity-group-block` | `activity-feed.tsx` (42 LOC) — bespoke header + hand‑rolled `<li>` rows | Adopt `PageHeader` + `components/ai/activity-group-block.tsx` |
| **Team / Tím** (`S7.3`, `WF:tim-clenovia`) | **ONE** member list (humans + agents as peers), roles, invite | `ObjectList`/`ListRow` + `ActorMark` + `InvitationPanel` | In‑app `company-team.tsx` (54 LOC) — bespoke `<ul>` member rows + pending‑invites `<section>` (note: the richer `team-roster` is onboarding‑only) | Unify the in‑app Team on `ListRow`/`ObjectList` + `ActorMark`; agents in the same list |

**Divergence pattern (one line):** the app consumes the kit's **outer shells** (`AuthShell`, `CompanyShell`) and **atomic widgets** (`StatePanel`, `StateBand`, `Field`, `Button`) but **hand‑rolls every content interior**, leaving the kit's entire rich object/collab/run layer dead — while the goal‑lifecycle layer doesn't exist on either side.

---

# Part 3 — REBUILD PLAN

## 3.1 Kit foundations to build / fix first (do these before screens)

Ordered. Each names the wireframe spec + the kit files touched.

**F1 — Complete the 3‑band co‑authored shell.** Spec: `S0.3`, `WF:company-shell-desktop`, primitives `.aihint` + `.aimark` + expandable `.space`.
- Add a **`RailSuggestionChip`** (`.aihint`) primitive (agent‑identity coral tint, spark ✦, streaming label, "pridať" accept) and a suggestion slot in the Priestory section of `company-shell-navigation.tsx` (extend `CompanyNavigationSection`/`SpaceNavigationItem` with optional `suggestion` + `facets` children).
- Add facet‑aware **expandable Space rows** (Space → its facet tabs) in the rail; carry `.aimark` ✦ on agent‑authored sections/facets.
- Files: `packages/ui/src/components/templates/company-shell-navigation.tsx`, `company-shell.tsx`; new `composites/rail-suggestion-chip.tsx`.

**F2 — Build the stepper creation layout (`.focusbar`).** Spec: `S3.2–3.5`, `WF:ciel-spec` (`focusbar__steps`).
- New **`FocusShell`** template (a.k.a. `CreationStepper`): in‑shell (not modal) frame = `.focusbar` (back + breadcrumb + **optional** step arc `Založ→Špecifikuj→Rozdeľ→Sleduj`, done/active/pending) + a stage body slot + a sticky `.confirmbar` footer.
- **The step arc is optional — one component, two modes:** goal‑create shows the 4‑stage arc (`WF:ciel-spec`); **space‑create (`WF:priestor-novy`) omits it** — the same Focus shell as a single focused composer ("not a wizard").
- Include the **`SeedComposer`** (`.seed` big field + `.toggle` draft/write + editable born‑scope `.scope-chip`) as stage 1.
- Files: new `templates/creation-stepper.tsx`, `composites/focusbar.tsx`, `composites/seed-composer.tsx`, `composites/scope-chip.tsx` (editable variant).

**F3 — Build the Spec editor (`.doc` co‑author mode).** Spec: `S3.3`, `WF:ciel-spec`.
- Extend `document-detail.tsx` into an editable **`SpecEditor`**: 6 sections (`Výsledok · Prečo+Kontext · Rozsah · Kritériá · Obmedzenia · Termín`), each with per‑section **`.prov`/`.prov--ai`** provenance dots, streaming "Draft·Autopilot" caret, **`.suggest`** accept/reject diff cards (del/ins + reason), and inline **`.qchip`** clarifying‑question chips.
- Files: new `templates/spec-editor.tsx`; `composites/provenance-mark.tsx` (`.prov`/`.aimark`/`.gen-chip`), `composites/suggestion-card.tsx` (`.suggest`), `composites/clarifying-chip.tsx` (`.qchip`).

**F4 — Build the acceptance‑criterion row (`.crit`).** Spec: `S3.3`/`S3.5`.
- **`AcceptanceCriterionRow`**: checkbox (`--color-ok` when met) + editable text + drag handle + inline `.prov--ai` + `.mapsto`/`.mapsto--gap`. Doubles as the sticky criterion group header in goal detail (tasks nest under it).
- Files: new `composites/acceptance-criterion-row.tsx`, `composites/mapsto-chip.tsx`.

**F5 — Build the breakdown / plan‑review surface.** Spec: `S3.4`, `WF:ciel-rozbitie`.
- **`BreakdownReview`** (grouped‑by‑criterion **`.brow`** staged rows: include check, title, type `.tag`, suggested assignee `.avatar`, priority, `.mapsto`, deps) + **`CoverageStrip`** (`.coverage` criteria↔tasks segments, gold `--gap` for uncovered) + **`ConfirmBar`** (`.confirmbar` plain‑language summary + backlog/start toggle + the one coral commit). Nothing writes until confirm.
- Files: new `templates/breakdown-review.tsx`, `composites/breakdown-row.tsx`, `composites/coverage-strip.tsx`, `composites/confirm-bar.tsx`.

**F6 — Compose the LiveRun view (S4.4).** Spec: `S4.4`, `WF:uloha-live-run`. The run *primitives* exist; assemble the *view*.
- **`LiveRun`**: plan checklist → step timeline (`.toolcard` per step) → recap, with the `.livebar` control cluster (`sleduj · zasiahni · prevezmi`), mid‑run HITL pause via `RunPermissionList`, and resumable/replay + recovery states. Add the intervene/take‑over composer path.
- Files: new `templates/live-run.tsx` composing `components/ai/run-*` + `message-composer.tsx`.

**F7 — Build the Review Gate (`.review`).** Spec: `S4.3`, `WF:uloha-review-gate`.
- **`ReviewGate`**: plain‑English panel `Zhrnutie · Čo sa zmení · Výstup (deliverable renderer) · Vyžaduje pozornosť · Istota (neutral meter)` + `review__bar` (who‑can‑approve note + neutral "Vyžiadať zmeny" + one coral "Schváliť výstup") + auto‑published banner + Undo. Docks in Task detail (`.thread--anchored`), the Inbox split, and the Cieľ close flow. Mid‑run tool HITL stays `RunPermissionList`.
- Files: new `templates/review-gate.tsx`, `composites/deliverable-renderer.tsx` (or reuse the file‑detail renderers).

**Smaller fixes:** neutral **`.mention`** variant keyed on `actor.kind` (kit tints all coral); verify `ActorMark` renders the agent square‑corner + build‑mark; promote `consistency.stories.tsx`/`geometry-gate.stories.tsx` into CI regression guards.

**Deferred (P2):** Generative canvas (`S5.3`), miniappka host/gate (`S5.4/5.5`) — build after the goal loop.

## 3.2 Screen rebuild order (recommended)

Follow `SCREEN-MAP §9`; the goal lifecycle leads but the shell/space frame must exist to hold it.

1. **Auth + Onboarding** — mostly polish: keep `AuthShell` for sign‑in; for onboarding, either keep the `AuthShell` steps (KISS) or lift them into the in‑shell first‑run Canvas (faithful) — either way move the bespoke notice/capability panels onto kit primitives and keep provider+model the one required gate. (`sign-in-screen.tsx`, `onboarding-steps.tsx`, `team-roster.tsx`.)
2. **Shell / Sidebar** — land F1; feed `CompanyShell` a real 3‑band nav model incl. `.aihint` + facet‑aware Spaces. (`$companySlug.tsx`.)
3. **Space Overview (Prehľad) + Space Directory** — full `SpaceContext` + `SpaceFacetNav` + `ObjectList`; delete the two‑stacked‑lists `SpaceOverview`. (`space-directory.tsx`, `spaces.$spaceSlug.tsx`.)
4. **Space Create (rich)** — replace `create-space-dialog.tsx` with `AdaptiveModal` (quick) and/or the F2 focus‑shell + Autopilot structure‑proposal panel.
5. **Goal Create (stepper)** ⭐ — the reason the redesign exists: F2+F3+F4+F5 wired as `Zámer·Špecifikácia·Rozpad·Sledovanie`, then `DocumentDetail` for the tracked Cieľ detail (S3.5). Highest resolution.
6. **Task Detail + Live Run + Review Gate** — `DocumentDetail(kind=task)` + `ContextualThreadPanel`, then the F6 `LiveRun` + HITL and the F7 `ReviewGate` (the same gate powers the Inbox triage split).

Then P1/P2 in SCREEN‑MAP order: **Channel** (`ChannelThread`) → **Home/Inbox/Aktivita** (`PageHeader` + `ObjectList` + `activity-group-block`) → **Team** (`ListRow`/`ObjectList`) → Knowledge/Generative/Automation/Settings.

## 3.3 Backend gaps — build UI on grounded fixtures first

Per `SCREEN-MAP §0` + the ground truth it cites, the data model is not ready for the goal loop. Build these screens **UI‑first against fixtures** (the kit already ships fixtures, e.g. `packages/ui/src/fixtures/hreben-work.ts`), and flag the backend deltas so UI and schema land together:

- **`goals.project`** (nullable) — Cieľ's home Projekt (born‑scoped in a Space; `null` = company‑wide). *(currently absent — goals "hang under the FIRMA")*
- **`goals.spec`** — structured 6‑section JSON with **`criteria[]` as first‑class addressable rows** (`{id, text, met, measurable, provenance, order}`). Replaces `goals.description`. Required for `SpecEditor`, `AcceptanceCriterionRow`, `.coverage`.
- **`goals.targetDate`** — single optional dated outcome (for the progress countdown).
- **`chat_sessions.anchorType += "goal"`** — the goal‑anchored thread (`ContextualThreadPanel` on the Cieľ).
- **Breakdown write:** `task.project = goal.project` + `task.goal = goal.id` + `task.metadata.criterionId` — so a breakdown task is simultaneously the Projekt's work (Space Úlohy facet) and the Cieľ's work (rolls into progress). Never floats to company scope.
- **The `.aihint` proposal store** (no collection yet): `{kind: facet|dashboard|view|channel|space-structure, label, targetScope, actor: Autopilot}` for the co‑authored rail.
- **Per‑actor read cursors** for channel/DM unread counts.

`tasks` already carry both `project` + `goal` FKs + `scopeType`, and `run_links` already models the run states (`pending·claimed·running·completed·failed·cancelled`) — so **Task Detail, Live Run, and Channel can be built against near‑real data**; the **Goal Lifecycle is the one that needs schema work in lockstep with the UI**.

---

## Appendix — canonical file map

**Kit templates** (`packages/ui/src/components/templates/`): `auth-shell`, `company-shell` (+ `company-shell-navigation`), `space-context`, `space-facet-nav`, `object-list`, `object-view-bar`, `document-detail`, `state-panel`, `page-header`, `settings-form`, `invitation-panel`, `task-list*`.
**Kit AI** (`packages/ui/src/components/ai/`): `message-composer`, `channel-thread` (+ `channel-message`), `run-card`, `run-detail`, `run-attempt-list`, `run-permission-list`, `run-terminal-panel`, `run-recap`, `run-state`, `work-block`, `work-plan-block`, `activity-group-block`, `message-part-list`, `permission-request-block`, `artifact-block`.
**Kit composites** (`packages/ui/src/components/composites/`): `actor*` (mark/chip/identity/stack), `command-palette`, `contextual-thread-panel`, `object-row`, `list-row`, `work-object-card`, `state-band`, `state-group`, `status`, `selection-bar`, `quick-add-row`, `adaptive-*`, `surface`, `technical-tag`, `virtualization-tail`, `work-row-detail`, `brand-mark`.
**Tokens/styles:** `packages/ui/src/styles.css` (canonical) · wireframe `tokens.css`.
**To BUILD:** `rail-suggestion-chip`, `focus-shell` (a.k.a. `creation-stepper`), `focusbar`, `seed-composer`, `scope-chip` (editable), `spec-editor`, `provenance-mark`, `suggestion-card`, `clarifying-chip`, `acceptance-criterion-row`, `mapsto-chip`, `breakdown-review`, `breakdown-row`, `coverage-strip`, `confirm-bar`, `live-run`, `review-gate`, `deliverable-renderer`.

**Wireframe source of truth:** `/Users/drepkovsky/.agent-board/projects/questpie-autopilot/wireframes/autopilot-operator-web-product-wireframes/` — `SCREEN-MAP.md`, `CONSISTENCY-AUDIT.md`, `ELEMENT-LOGIC.md`, `tokens.css`, `screens/*.html`.
