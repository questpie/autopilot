<!-- autopilot:start -->
## Autopilot Agents

> Generated from .autopilot/ — do not edit this section manually.

- **Developer** (`dev`) — developer: Implements features, fixes bugs, writes tests. Follows existing codebase patterns.
<!-- autopilot:end -->

## Operator UI Reset Guardrails

These instructions apply when working on `apps/operator-web`.

### Active direction

We are **not** rebuilding the backend or API layer.
We are rebuilding the **UI shell and feature composition** incrementally.

Primary product modes:
- `Dashboard` / `Home`
- `Chat`
- `Tasks`
- `Knowledge`

Default/home posture:
- `Dashboard` / `Home` for daily attention, recent work, and a composer entry point

Secondary/deferred surfaces:
- workflows
- schedules
- scripts
- project workspace inspection as a Git/provider diff and run review surface
- integrations
- runtime
- agents

These should not behave as primary top-level product areas.

### Keep

Do not replace or throw away:
- orchestrator routes/services
- frontend API adapters in `src/api/*`
- frontend hooks in `src/hooks/*`
- Knowledge API integration
- project workspace inspection / diff wiring for ephemeral git run review, connected to Git provider adapters
- dashboard/chat/tasks/results/knowledge real wiring

### Build toward

Prefer this direction:

```text
apps/operator-web/src/
  app/shell/
  features/dashboard/
  features/chat/
  features/tasks/
  features/knowledge/
  features/workspace-inspection/ # developer-only project Git/provider diff / run review
  features/renderers/
```

Use more smaller files and thinner route files.

### Hard rules

- no invented endpoints
- no phantom data sources
- do not remove the current dashboard/home posture; keep it as a thin operator overview, not an admin panel
- no new primary top-level product modes beyond Dashboard/Home / Chat / Tasks / Knowledge
- no giant one-shot rewrite
- no fake file metadata or fake runtime/admin capabilities
- no persistent company/config/knowledge filesystem as product truth
- no virtual filesystem URI model; use explicit Knowledge APIs or project workspace inspection APIs
- no hardcoded GitHub-only project surface; route GitHub/GitLab/generic Git behavior through provider adapters
- local coding-agent execution should go through `spawn-agent` / ACP rather than new hand-rolled CLI adapters
- local skills/MCP/AGENTS.md materialization should go through `agent-install`

### Rendering rules

- AI-generated rich text / draft / document content -> Markdown rendering
- editable markdown/document content -> Tiptap
- code/diff/YAML raw editing -> keep code-oriented editors

Do not use Tiptap for:
- code
- JSON
- YAML
- CSV
- PDF
- images
- short utility inputs

### Docs to read first

- `docs/internal/operator-ui-v2-spec.md`
- `~/questpie/specs/autopilot/core-architecture-cleanup-proposal.md`
- `~/questpie/specs/autopilot/config-and-state-boundaries.md`
- `~/questpie/specs/autopilot/operator-web-ia.md`
- `~/questpie/specs/autopilot/operator-web-flow-spec.md`
- `~/questpie/specs/autopilot/context-assembly-spec.md`
- `~/questpie/specs/autopilot/filesystem-scope-model.md`

### Implementation style

- cleanup first, then shell extraction, then feature-by-feature rebuild
- keep build/typecheck green
- preserve working data wiring while replacing old shell assumptions
- prefer explicit deletions over leaving contradictory legacy product posture in place
- do not treat company knowledge as a generic filesystem explorer; use the Knowledge/resource model first
- use filesystem only for project source and ephemeral git execution workspaces: checkout, edit, test, commit, cleanup
- represent shared agent outputs as Knowledge resources/artifacts with provenance, not as shared filesystem state
