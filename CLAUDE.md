<!-- autopilot:start -->
## Autopilot Context

> Generated from .autopilot/ — do not edit this section manually.

### company

# QuestPie

Add company-level context here: team structure, coding standards, architecture decisions, conventions.

This file is synced into CLAUDE.md by `autopilot sync`.

### project

# questpie-root

Add project-specific context here: tech stack, key dependencies, folder structure, domain concepts.

This file is synced into CLAUDE.md by `autopilot sync`.
<!-- autopilot:end -->

## Active Implementation Brief — Operator UI Reset

This repository is **not** being rebuilt from zero.

The current backend, API layer, and data wiring are valid.
The active effort is a **UI shell reset** for `apps/operator-web`.

### Product Truth

The app is a desktop-style operator client connected to the orchestrator.

Primary modes:
- `Dashboard` / `Home`
- `Chat`
- `Tasks`
- `Knowledge`

Primary scopes:
- `company`
- `project`
- `worktree`

Everything else is secondary:
- workflows
- schedules
- scripts
- ephemeral project/worktree filesystem
- integrations
- runtime
- agents

Those should become:
- Knowledge/API-backed resources
- ephemeral worktree/config renderers
- settings/admin surfaces
- secondary inspectors or drawers

### What stays

Keep and reuse:
- orchestrator routes and services
- `apps/operator-web/src/api/*`
- `apps/operator-web/src/hooks/*`
- dashboard/chat/tasks/results/knowledge wiring
- project workspace inspection wiring for ephemeral git diff/developer execution review
- current auth and session setup
- real route contracts

Do not restart:
- backend CRUD
- API adapters
- workspace inspection integration
- task/run/chat composition already wired

### What changes

Replace:
- old multi-page admin shell
- route-heavy page-per-concept UI
- top-level nav for workflows / automations / results / scripts / company / integrations / agents / runtime

The default/home posture is **Dashboard/Home** for daily attention, recent work, and a composer entry point.

### Tech Stack Direction

For the shell rewrite in `apps/operator-web`:
- React + TanStack Router
- TanStack Query
- existing `api-client.ts` / query hooks
- Geist for UI/content
- JetBrains Mono for technical tokens
- shadcn/base UI primitives where already present
- Tiptap for editable markdown/document content
- Monaco only where code/diff/YAML raw editing genuinely needs it
- Knowledge API as the source of truth for company/project knowledge
- project workspace inspection only for ephemeral git workspaces and diffs
- `spawn-agent` / ACP as the primary local coding-agent execution transport
- `agent-install` as the local skills/MCP/AGENTS.md materialization layer

Do not add a parallel data layer or a second API abstraction unless required.

### Rendering Rule

Wherever the product shows AI-generated rich text / draft / document-like content:
- render as Markdown

Wherever such content is editable:
- use Tiptap

Do **not** force this onto:
- code
- JSON
- YAML
- CSV
- PDF
- images
- short utility text inputs

### Architecture Direction

Routes should become thin wrappers.
Move UI orchestration into feature folders and shell layers.

Target direction:

```text
apps/operator-web/src/
  app/
    shell/
      app-shell.tsx
      app-topbar.tsx
      app-sidebar.tsx
      app-statusbar.tsx
  features/
    dashboard/
      components/
      hooks/
      model/
    chat/
      components/
      hooks/
      model/
    tasks/
      components/
      hooks/
      model/
    knowledge/
      components/
      hooks/
      model/
    files/
      components/
      hooks/
      model/
    renderers/
      registry/
      markdown/
      yaml/
      folders/
      artifacts/
      code/
      diff/
```

Use **more smaller files**, not fewer giant files.

Rules:
- route files stay thin
- `*-screen.tsx` = full mode surface
- `*-panel.tsx` = inspector/detail panel
- `*-renderer.tsx` = typed file/folder renderer
- `use-*-screen.ts` = screen orchestration hook
- `*-view-model.ts` = FE-derived projection only

### Incremental Rewrite Plan

Preferred order:

1. cleanup old shell ballast
2. extract shell structure
3. dashboard/home overview and reusable composer
4. tasks list / board / inspector
5. knowledge browser / renderer / markdown editing
6. move developer/config surfaces into secondary ephemeral worktree/config renderers

Do not attempt a giant one-shot rewrite.

### Hard Constraints

- no invented endpoints
- no phantom data sources
- no indexer-first renderer model
- no new business primitives
- do not remove the current dashboard/home posture
- no broad brand-heavy redesign
- no route sprawl
- no persistent company/config/knowledge filesystem as product truth

### Source of Truth Docs

Read these before changing operator-web shell/product posture:
- `docs/internal/operator-ui-v2-spec.md`
- `~/questpie/specs/autopilot/core-architecture-cleanup-proposal.md`
- `~/questpie/specs/autopilot/config-and-state-boundaries.md`
- `~/questpie/specs/autopilot/operator-web-ia.md`
- `~/questpie/specs/autopilot/operator-web-flow-spec.md`
- `~/questpie/specs/autopilot/context-assembly-spec.md`
- `~/questpie/specs/autopilot/filesystem-scope-model.md`

If those docs and current code disagree, prefer:
1. real backend/API truth
2. `operator-ui-v2-spec.md`
3. the canonical specs in `~/questpie/specs/autopilot`

### Expected Output Style

When working on this rewrite:
- make cleanup and structure changes in small passes
- keep build/typecheck green
- remove old assumptions before adding new shell layers
- be explicit about what is deleted, what is moved, and what remains intentionally deferred
