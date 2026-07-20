---
status: accepted
---

# Builder interaction flow and editing surface

ADR 0019 fixed the Builder's execution and compute architecture — the sandbox contract, Draft affinity, preview-URL provider, repository layout, change delivery, and deploy adapters. This ADR decides the layer above it: how a person interacts with a Draft — the editing surface, file management, and code-edit flow — and how that reconciles with the Company Drive (ADR 0017). It is grounded by a current (2026-07-20) product-landscape research pass with explicit primary/secondary/unverified sourcing. Every agenda question is resolved and the owner has **accepted** it; implementation is a later phase (Phase 3/4).

The load-bearing product constraint carries over from ADR 0019: the primary operator is **non-technical**, so the Builder must not lead with a developer IDE.

## Decision

### Primary UX paradigm

The Builder is **conversational-first with progressive disclosure** — the Lovable model. The default surface for the non-technical operator is a conversation plus a live Preview, with code hidden; deeper layers (a read-only code view, then editable code, then a full IDE) are revealed on demand for technical users. All of it lives in one application behind a toggle / tab / permission-gated mode, never a second app — every dual-audience product surveyed (Lovable confirmed; Replit likely) does it this way rather than forking into two surfaces.

An IDE-first surface (Cursor / Windsurf style) is rejected as technical-first, against the non-technical target. A conversational-only surface with no code access is rejected because technical users and manual-intervention / code-audit edge cases need the code — which is exactly the "Dev Mode" gap competitors added after launching conversational-only.

### Edit-authorship model

The agent edits files **headlessly** and the editing surface is a passive **view**. A Draft's Agent Run — the same `HarnessV1SandboxProvider` harness from ADR 0019 — reads, writes, and edits files directly in the per-Draft worktree; every editing surface (a diff view, a Monaco editor, or a full IDE) renders that same worktree rather than being the thing that mutates it. This is the dominant 2025-2026 pattern: Claude Code / the Agent SDK is the authoritative example — the agent operates on the filesystem through Read/Write/Edit/Bash and any IDE integration is an explicitly separate optional layer — and the archived `apps/autopilot` already worked this way (agent edits the worktree; humans inspect through read-only list/read/diff routes).

This deliberately reframes the initial "Autopilot as an IDE plugin" hunch: Autopilot is not primarily an IDE extension driving the editor through its API — it is the harness that owns the worktree, and an IDE extension shrinks to a thin, optional add-on that only surfaces Autopilot's presence and diffs inside a full IDE for the technical progressive-disclosure layer. Agent-drives-embedded-IDE-via-extension-API is rejected as the core mutation mechanism: it couples the agent to one extension-API surface (a versioning/compat burden), resists headless and parallel execution, and makes the IDE process a single point of failure for the agent's ability to act at all — and no surveyed product publishes that as its core mechanism. Splitting the edit model by disclosure layer (headless for chat, agent-as-plugin in the full IDE) is rejected as needless complexity — one edit model everywhere is simpler, and the research finds headless is simpler even inside an IDE. Coder's "Tasks" model independently confirms this shape: the AI agent runs as a separate process inside the workspace while the VS Code extension is only a UI sidebar, not the execution engine.

### Code view surface

The middle progressive-disclosure layer is a light, in-product **code view** — standalone Monaco (MIT), a file tree, and a diff view — rendering the Draft's worktree read-mostly, with light direct edits allowed. Monaco fits precisely because it is a same-origin JavaScript widget with no extension host and no iframe/CSP surface of its own (unlike a full embedded web IDE), so it drops straight into the app shell.

Binding constraint (owner): the code view must belong to the app's own theming — it follows the app's resolved dark/light theme and the design-system semantic tokens via a **custom Monaco theme**, never Monaco's default themes. This is not cosmetic: a prior attempt at dropping in Monaco with its default theme broke the product's visual consistency. It mirrors the Mini-app UI Runtime pattern from ADR 0017, where the host injects the resolved theme and semantic tokens rather than letting an embedded surface bring its own look.

The code view is client-side and reads the worktree through authorized, Draft/Run-scoped read/list/diff routes (the `apps/autopilot` `workspace-inspection` precedent), refreshing on the Run/Channel events ADR 0019 already carries — no new serving mechanism and no sandbox-served surface for the default view. The live Preview (the running app) remains served through ADR 0019's preview-URL provider.

The deepest technical layer is **git sync / clone to the operator's own local IDE** (the Lovable model), reusing ADR 0019's Project Repository and auto-push — not an embedded full web IDE. Embedding a full web IDE (code-server / OpenVSCode Server / Theia) is deliberately **deferred** until a concrete need to keep technical users in-product arises, because the research shows it is genuinely hard: iframe embedding has years of unresolved friction (websocket/proxy/cookie config; Theia's multi-year-open embedding issues and Safari/state-loss breakage; even Coder ships `frame-ancestors 'none'` and tells embedders to run their own reverse proxy). If it is ever adopted it must use **Open VSX** (the Microsoft VS Code Marketplace ToU legally restricts use to Microsoft's own products, so forks may not use it) and must work in both self-hosted and managed substrates. Coder's own product (per-workspace CSP `frame-src`/`connect-src`, an iframe `WorkspaceAppFrame`, `{port}--{app}--{workspace}--{user}` wildcard subdomains, a ws-proxy) is the reference architecture for that later work.

### File management and the Company Drive

The Builder's file surface and the Company Drive stay **separate but linked**. The Company Drive (ADR 0017) is Company-wide navigation over typed references to domain objects — Knowledge, Assets, Integration Packages, Skills, Dashboards, Mini-apps, Projects — that references rather than copies. A Builder file explorer is a Project's source tree: mutable git-worktree state, Project-scoped, with its own Draft / Checkpoint / Change-Request lifecycle. These are different kinds of things and must not be merged.

The link lives at the Project boundary: the Drive references a Project as a domain object, and from a Project the operator enters its Builder, whose file explorer shows the source tree. The Drive does not absorb individual source files — doing so would violate ADR 0017's rule that the Drive references and never copies entities, and would mix immutable domain-object projections with mutable worktree state that has a different lifecycle and permission model. Keeping them fully unlinked is also rejected: the Project would then not be discoverable from the Company's navigation context.

### Diff, Checkpoint, and merge surfacing

The code view stays current by **refreshing on the Run and Channel events ADR 0019 already carries** — it reads the worktree through authorized routes and refetches on the agent's Run activity, with no new realtime layer. Live file-content streaming or a CRDT collaborative-editing layer is rejected as over-engineering for now: the live Preview already shows the running application, so streaming raw file contents would add a sync/conflict layer without a matching need. Manual-refresh-only is rejected as feeling dead during agent work.

Diffs and Checkpoints render the model ADR 0019 already fixed rather than adding a second one: a diff is the Draft against the main line or against a Checkpoint (`project_workspace_checkpoints`), a Checkpoint is a restore/compare point, and a merge into the main line is the Change Request approved in the Autopilot UI (ADR 0019 change delivery). The interaction flow presents this model; it does not own it.

## Status and scope

This ADR is **accepted**. It fixes the Builder's interaction shape — conversational-first with progressive disclosure, agent-edits-headless with the editing surface as a view, a themed in-product Monaco code view with git sync as the deep technical escape, the Company Drive kept separate-but-linked, and event-driven refresh — but not the implementation, which is Phase 3/4 alongside ADR 0019. Embedding a full web IDE (with its Open VSX and reverse-proxy / iframe requirements) is explicitly deferred until a concrete need arises. The load-bearing reframing to carry forward: the initial "IDE substrate with Autopilot as plugins" hunch resolves into "the harness edits the worktree headlessly; every code surface is a themed view onto it," with an IDE extension reduced to an optional thin add-on for the technical layer.
