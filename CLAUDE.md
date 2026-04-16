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
- `Chat`
- `Tasks`
- `Files`

Primary scopes:
- `company`
- `project`
- `worktree`

Everything else is secondary:
- workflows
- schedules
- scripts
- company knowledge
- integrations
- runtime
- agents

Those should become:
- file-backed renderers
- settings/admin surfaces
- secondary inspectors or drawers

### What stays

Keep and reuse:
- orchestrator routes and services
- `apps/operator-web/src/api/*`
- `apps/operator-web/src/hooks/*`
- task/chat/results/files/VFS wiring
- current auth and session setup
- real route contracts

Do not restart:
- backend CRUD
- API adapters
- VFS integration
- task/run/chat composition already wired

### What changes

Replace:
- dashboard/home posture
- old multi-page admin shell
- route-heavy page-per-concept UI
- top-level nav for workflows / automations / results / scripts / company / integrations / agents / runtime

The default/home posture is **Chat**, not dashboard or inbox.

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
- VFS as the source of truth for Files

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
    chat/
      components/
      hooks/
      model/
    tasks/
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
3. chat-first home and reusable composer
4. tasks list / board / inspector
5. files browser / renderer / markdown editing
6. move config-like surfaces into Files renderers

Do not attempt a giant one-shot rewrite.

### Hard Constraints

- no invented endpoints
- no phantom data sources
- no indexer-first renderer model
- no new business primitives
- no dashboard comeback
- no broad brand-heavy redesign
- no route sprawl

### Source of Truth Docs

Read these before changing operator-web shell/product posture:
- `docs/internal/operator-ui-v2-spec.md`
- `apps/operator-web/DESIGN-PRINCIPLES.md`
- `apps/operator-web/DESIGN-TOKENS.md`
- `apps/operator-web/COMPONENT-CATALOG.md`
- `apps/operator-web/SCREEN-PATTERNS.md`

If those docs and current code disagree, prefer:
1. real backend/API truth
2. `operator-ui-v2-spec.md`
3. the v2 design docs in `apps/operator-web`

### Expected Output Style

When working on this rewrite:
- make cleanup and structure changes in small passes
- keep build/typecheck green
- remove old assumptions before adding new shell layers
- be explicit about what is deleted, what is moved, and what remains intentionally deferred
