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
- `Chat`
- `Tasks`
- `Files`

Default/home posture:
- `Chat`

Secondary/deferred surfaces:
- workflows
- schedules
- scripts
- company knowledge
- integrations
- runtime
- agents

These should not behave as primary top-level product areas.

### Keep

Do not replace or throw away:
- orchestrator routes/services
- frontend API adapters in `src/api/*`
- frontend hooks in `src/hooks/*`
- VFS integration
- chat/tasks/results/files real wiring

### Build toward

Prefer this direction:

```text
apps/operator-web/src/
  app/shell/
  features/chat/
  features/tasks/
  features/files/
  features/renderers/
```

Use more smaller files and thinner route files.

### Hard rules

- no invented endpoints
- no phantom data sources
- no dashboard/home comeback
- no new top-level product modes beyond Chat / Tasks / Files
- no giant one-shot rewrite
- no fake file metadata or fake runtime/admin capabilities

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
- `apps/operator-web/DESIGN-PRINCIPLES.md`
- `apps/operator-web/DESIGN-TOKENS.md`
- `apps/operator-web/COMPONENT-CATALOG.md`
- `apps/operator-web/SCREEN-PATTERNS.md`

### Implementation style

- cleanup first, then shell extraction, then feature-by-feature rebuild
- keep build/typecheck green
- preserve working data wiring while replacing old shell assumptions
- prefer explicit deletions over leaving contradictory legacy product posture in place
